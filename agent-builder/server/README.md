# Agent Library backend

Thin FastAPI service backing the **Agent Library** tab: a registry of agents
and the components they use. Phase 1 stores the registry in a JSON file.

## Run locally

```bash
cd agent-builder/server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

The client's `.env.local` already points at `http://localhost:8001`
(`VITE_API_URL`). Start the client (`npm run dev` in `agent-builder/client`)
and the Agent Library tab will read/write live registry data. If the backend
is not running, the tab falls back to sample data.

## API

| Method | Path                      | Purpose                          |
|--------|---------------------------|----------------------------------|
| GET    | `/api/health`             | liveness                         |
| GET    | `/api/agents`             | list registry entries            |
| GET    | `/api/agents/{id}`        | one entry                        |
| POST   | `/api/agents`             | register an agent                |
| PATCH  | `/api/agents/{id}`        | update an entry                  |
| DELETE | `/api/agents/{id}`        | remove an entry                  |

## Storage

Registry lives at `AGENT_REGISTRY_PATH` (default `data/registry.json`).
On a Databricks App, set it to a mounted UC volume path so the registry
survives restarts.

## Databricks App deployment (later)

Build the client (`npm run build`) so `client/dist` exists; this service
mounts it at `/` and serves UI + API from one origin (no CORS). Live status
verification via `GET /api/2.0/serving-endpoints/{name}` (using the App's own
service-principal auth) is a later phase.
