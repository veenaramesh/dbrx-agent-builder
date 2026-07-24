# Agent Brick Builder backend

Thin FastAPI service backing the builder. It renders an agentops-stacks bundle
from the canvas and writes it into the user's workspace.

Observability of deployed agents is a separate read-only app
(`dbrx-agent-library`) — there is no registry or readiness logic here.

## Run locally

```bash
cd agent-builder/server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

The client's `.env.local` already points at `http://localhost:8001`
(`VITE_API_URL`). Start the client (`npm run dev` in `agent-builder/client`).

## API

| Method | Path            | Purpose                                                       |
|--------|-----------------|---------------------------------------------------------------|
| GET    | `/api/health`   | liveness                                                      |
| POST   | `/api/deploy`   | expand the agentops-stacks bundle + write it to the workspace |

`/api/deploy` runs as the app service principal. It expands the full bundle
in-container via `databricks bundle init` (see `deploy.py`) and lands it in a
shared workspace path; the user then runs `databricks bundle deploy` as
themselves.

## Databricks App deployment

Build the client (`../scripts/build.sh`) so `client/dist` exists; this service
mounts it at `/` and serves UI + API from one origin (no CORS). See
`docs/deploy-app.md`.
