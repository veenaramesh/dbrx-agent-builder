"""Agent Brick Builder backend — FastAPI.

Renders an agentops-stacks bundle from the builder canvas and writes it into the
user's workspace (POST /api/deploy). Observability of deployed agents lives in a
separate read-only app (dbrx-agent-library), so there is no registry, readiness,
or verify logic here.

When served by a Databricks App, the built frontend (client/dist) is mounted at
/ so the App serves both API and UI from one origin — no CORS.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from auth import caller_email, service_principal_client
from deploy import DeployRequest, DeployResult, write_project


app = FastAPI(title="Agent Brick Builder API", version="0.1.0")

# CORS: for local dev the client runs on :3001 and the API on :8001. In the
# Databricks App deployment the frontend is served same-origin, so CORS is a
# no-op there. ALLOWED_ORIGINS can lock this down in production.
_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# ── Deploy: write a rendered project into a shared workspace path ────────────
# Written by the app service principal (no user-auth scope needed), namespaced
# by the requesting user for attribution. The builder expands the full
# agentops-stacks bundle in-container (see deploy.py) and lands it in the
# workspace; the user then runs `databricks bundle deploy` as themselves.
@app.post("/api/deploy", response_model=DeployResult)
def deploy(req: DeployRequest, request: Request) -> DeployResult:
    email = caller_email(request)
    try:
        return write_project(service_principal_client(), email, req)
    except ValueError as e:
        # Bad input (invalid path / project name).
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # SDK / workspace errors
        raise HTTPException(status_code=502, detail=f"workspace write failed: {type(e).__name__}: {e}")


# ── Static frontend (Databricks App deployment) ─────────────────────────────
# If a built client is present, serve it. Harmless in local dev (the dist dir
# usually won't exist there since Vite serves the UI itself).
_DIST = Path(__file__).resolve().parent.parent / "client" / "dist"
if _DIST.is_dir():
    from fastapi.responses import FileResponse

    _ASSETS = _DIST / "assets"
    if _ASSETS.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS)), name="assets")

    _INDEX = _DIST / "index.html"

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str, request: Request):
        # /api is handled by the routes above; never mask it with the SPA.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="not found")
        # Serve a real static file if one exists (favicon, etc.); else the SPA.
        candidate = _DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_INDEX))


# ── Entrypoint ──────────────────────────────────────────────────────────────
# Databricks Apps inject the port to bind via DATABRICKS_APP_PORT and expect
# the process to listen on 0.0.0.0. Locally this defaults to 8001 (matching the
# client's VITE_API_URL).
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("DATABRICKS_APP_PORT", os.environ.get("PORT", "8001")))
    uvicorn.run(app, host="0.0.0.0", port=port)
