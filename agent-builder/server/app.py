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

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from auth import caller_email, service_principal_client
from deploy import DeployRequest, DeployResult, write_project
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


@app.get("/api/whoami")
def whoami(request: Request) -> dict:
    """Diagnostic: report which auth-related request headers the App forwards,
    without leaking secrets. Used to confirm on-behalf-of-user token delivery.
    """
    interesting = {
        k: v
        for k, v in request.headers.items()
        if k.lower().startswith("x-forwarded") or k.lower() in ("authorization",)
    }
    # Redact values; only report presence + length so we never log a token.
    header_report = {k: f"present(len={len(v)})" for k, v in interesting.items()}

    # Decode ONLY the scope claim from the forwarded JWT (scope names are not
    # secret; we never return the token itself). This tells us definitively
    # which scopes the browser-minted user token carries.
    scopes = None
    tok = request.headers.get("x-forwarded-access-token")
    if tok and tok.count(".") == 2:
        import base64
        import json as _json
        try:
            payload_b64 = tok.split(".")[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)  # pad
            claims = _json.loads(base64.urlsafe_b64decode(payload_b64))
            scopes = claims.get("scope")
        except Exception:
            scopes = "unable-to-decode"

    return {
        "forwarded_headers": header_report,
        "has_user_token": "x-forwarded-access-token" in {k.lower() for k in request.headers},
        "token_scopes": scopes,
    }


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


# ── Deploy: write a rendered project into a shared workspace path ────────────
# Written by the app service principal (no user-auth scope needed), namespaced
# by the requesting user for attribution.
@app.post("/api/deploy", response_model=DeployResult)
def deploy(req: DeployRequest, request: Request) -> DeployResult:
    email = caller_email(request)
    try:
        result = write_project(service_principal_client(), email, req)
    except ValueError as e:
        # Bad input (invalid path / project name).
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # SDK / workspace errors
        raise HTTPException(status_code=502, detail=f"workspace write failed: {type(e).__name__}: {e}")

    # Auto-register so the agent shows up in the Library. Best-effort: a
    # registry write failure must not fail the deploy itself.
    try:
        from models import ToolRef

        # Prefer the builder's human-facing name; fall back to agent/project id.
        agent_name = req.display_name or req.initial_agent_name or req.project_name
        tools = [ToolRef(kind=t.kind, label=t.label, detail=t.detail) for t in req.tools]
        existing = next((a for a in store.list() if a.name == agent_name), None)
        payload = AgentCreate(
            name=agent_name,
            workspace=result.user,
            model=req.model,
            endpoint=req.endpoint,
            tools=tools,
        )
        if existing is None:
            store.create(payload)
        else:
            # Re-deploy of the same agent: refresh its recorded components.
            store.update(existing.id, AgentUpdate(**payload.model_dump()))
    except Exception:
        pass

    return result


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
