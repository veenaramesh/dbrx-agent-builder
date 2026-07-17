"""Agent Library backend — FastAPI.

Phase 1: registry CRUD backed by a JSON file. Runs locally (uvicorn on 8001,
matching the client's VITE_API_URL) and inside a Databricks App.

Later phases add:
  - POST /api/agents/{id}/verify → live status via GET /api/2.0/serving-endpoints/{name}
    using the App's own auth (Databricks SDK default credentials).

When served by a Databricks App, the built frontend (agent-builder/client/dist)
is mounted at / so the App serves both API and UI from one origin — no CORS.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models import Agent, AgentCreate, AgentUpdate
from store import RegistryStore

app = FastAPI(title="Agent Library API", version="0.1.0")

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

store = RegistryStore()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/agents", response_model=list[Agent])
def list_agents() -> list[Agent]:
    return store.list()


@app.get("/api/agents/{agent_id}", response_model=Agent)
def get_agent(agent_id: str) -> Agent:
    agent = store.get(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return agent


@app.post("/api/agents", response_model=Agent, status_code=201)
def create_agent(payload: AgentCreate) -> Agent:
    return store.create(payload)


@app.patch("/api/agents/{agent_id}", response_model=Agent)
def update_agent(agent_id: str, patch: AgentUpdate) -> Agent:
    agent = store.update(agent_id, patch)
    if agent is None:
        raise HTTPException(status_code=404, detail="agent not found")
    return agent


@app.delete("/api/agents/{agent_id}", status_code=204, response_class=Response)
def delete_agent(agent_id: str) -> Response:
    if not store.delete(agent_id):
        raise HTTPException(status_code=404, detail="agent not found")
    # 204 must not carry a body; return an explicit empty Response so FastAPI
    # doesn't try to JSON-encode None (which asserts on the 204 status).
    return Response(status_code=204)


# ── Static frontend (Databricks App deployment) ─────────────────────────────
# If a built client is present, serve it. Harmless in local dev (the dist dir
# usually won't exist there since Vite serves the UI itself).
#
# The client is a single-page app with client-side routing (/, /library). We
# serve hashed build assets from /assets and fall back to index.html for any
# other non-/api path, so deep links and hard refreshes work.
_DIST = Path(__file__).resolve().parent.parent / "client" / "dist"
if _DIST.is_dir():
    from fastapi import Request
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
