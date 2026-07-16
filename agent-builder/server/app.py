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

from fastapi import FastAPI, HTTPException
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


@app.delete("/api/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: str) -> None:
    if not store.delete(agent_id):
        raise HTTPException(status_code=404, detail="agent not found")


# ── Static frontend (Databricks App deployment) ─────────────────────────────
# If a built client is present, serve it at the root. Harmless in local dev
# (the dist dir usually won't exist there since Vite serves the UI itself).
_DIST = Path(__file__).resolve().parent.parent / "client" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="frontend")
