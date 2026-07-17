# Deploying Agent Brick Builder as a Databricks App

This deploys the builder **itself** as a Databricks App — the UI and its
FastAPI backend served from one origin. (This is separate from the agents a
user builds and deploys *with* the tool.)

Phase A scope: the App serves the existing Builder and Agent Library. The
Library reads its registry backend (or sample data when empty). On-behalf-of
deploy and live eval/serving status arrive in later phases — see
[agent-app-plan.md](./agent-app-plan.md).

## Prerequisites

- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/install.html)
  authenticated to your workspace (`databricks auth login`).
- [Node.js](https://nodejs.org/) ≥ 20 (to build the client locally — the App
  runtime is Python-only and cannot run npm).
- Apps enabled in your workspace.

## 1. Build the client

The Databricks Apps runtime installs `requirements.txt` and runs `app.yaml`'s
command, but it does **not** build the frontend. Build it first so
`client/dist` exists and ships with the App:

```bash
cd agent-builder
./scripts/build.sh
```

This runs the client build with `VITE_BASE=/` so assets resolve from the App
root. Output: `agent-builder/client/dist`.

## 2. Deploy the App

From the `agent-builder` directory (the App root — it contains `app.yaml`,
`requirements.txt`, `server/`, and the built `client/dist`):

```bash
# First time: create the app
databricks apps create agent-brick-builder

# Upload source + built client, then deploy.
# NOTE: `databricks sync` honors .gitignore, which excludes client/dist. Pass
# --include 'client/dist/**' so the built frontend actually uploads — without
# it the App starts but serves no UI.
databricks sync . /Workspace/Users/<you>/agent-brick-builder-src \
  --include 'client/dist/**'
databricks apps deploy agent-brick-builder \
  --source-code-path /Workspace/Users/<you>/agent-brick-builder-src
```

The App starts `python server/app.py`, which binds `DATABRICKS_APP_PORT` and
serves both the API (`/api/...`) and the built client (everything else, with
SPA fallback so `/library` deep-links work).

## 3. Configuration

`app.yaml` sets environment variables:

| Var | Purpose |
|---|---|
| `AGENT_REGISTRY_PATH` | Where the Library registry JSON lives. **For durability across restarts, point this at a mounted UC volume** — the default (`data/registry.json`) lives in the container and is lost on redeploy. |

## Notes / known limitations (Phase A)

- **CDN dependencies.** The client currently loads Tailwind and Google Fonts
  from public CDNs. The App's browser context needs outbound access to them,
  or the UI styling degrades. Bundling these locally is a follow-up.
- **Registry durability.** Until `AGENT_REGISTRY_PATH` points at a volume,
  redeploying resets the registry.
- **Auth.** Phase A serves the UI/registry only. Writing DABs into a user's
  workspace on-behalf-of the user (OBO) comes in Phase B/C.

## Local development (unchanged)

You don't need the App to develop:

```bash
# backend
cd agent-builder/server && uvicorn app:app --reload --port 8001
# client (separate terminal)
cd agent-builder/client && npm run dev
```

The client's `.env.local` points at `http://localhost:8001`; the Library falls
back to sample data if the backend isn't running.
