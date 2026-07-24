# Hosting Agent Brick Builder on GitHub Pages

The builder is a **static, client-side app** — all bundle generation happens in
the browser (no backend). It's hosted on GitHub Pages.

> Observing deployed agents lives in a separate app (`dbrx-agent-library`).
> Designing/rendering a bundle is all this tool does.

## How it deploys

`.github/workflows/deploy.yml` builds `agent-builder/client` and publishes
`dist/` to Pages on every push to `main`. The production build uses the base
path `/dbrx-agent-builder/` (see `client/vite.config.ts`), and a `404.html`
copy of `index.html` provides the SPA fallback for deep links / refreshes.

Enable it once in the repo: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

Live at: https://veenaramesh.github.io/dbrx-agent-builder/

## What the "Download bundle" button produces

With no backend, the primary action downloads a ZIP containing:

- `config.json` — the agentops-stacks DAB template answers file
- `agents_manifest.json` — full manifest of agents + shared components
- `README.md` — the exact commands to run
- a CI/CD workflow file (if enabled)

The user then runs, as themselves:

```bash
databricks bundle init https://github.com/databricks-solutions/agentops-stacks \
  --config-file config.json
databricks bundle deploy -t dev
```

(Requires Databricks CLI **v1.1.0+**, the template's minimum.)

## Optional: write directly to a workspace (backend mode)

The client keeps a `deployToWorkspace()` path that writes the bundle straight
into the user's workspace via a backend. It's **inactive on Pages** and only
engages when `VITE_API_URL` is set at build time (pointing at a FastAPI backend
exposing `POST /api/deploy`). Not needed for the static hosting above.

## Local development

```bash
cd agent-builder/client
npm install
npm run dev        # serves at http://localhost:3001

# preview a production (Pages-base) build:
npm run build && npm run preview
```
