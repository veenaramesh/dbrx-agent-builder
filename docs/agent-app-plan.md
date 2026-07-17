# Agent Brick Builder → deployable Databricks App

Status: **draft / for review** · Last updated: 2026-07-17

This is the working plan for turning Agent Brick Builder from a static
client-side tool into a self-service **Databricks App**. It captures the
vision, the key decisions, the architecture, and a phased build so we can
iterate on it before writing more code.

---

## 1. Vision

Agent Brick Builder becomes a Databricks App that lets a user, entirely from
their browser:

1. **Design** an agent visually (Builder tab — already built).
2. **Deploy** it into **their own workspace** as an
   [agentops-stacks](https://github.com/databricks-solutions/agentops-stacks)
   Declarative Automation Bundle (DAB).
3. **Monitor** everything they've built in the **Agent Library** tab — not a
   static list, but a live view of each agent's contents, deployment status,
   and **production readiness** (did its evaluation clear the gates).

The Library shifts from "a registry you maintain by hand" to "a dashboard of
your workspace's agents and their health."

---

## 2. Decisions (locked for v1)

| Decision | Choice | Why |
|---|---|---|
| **Deploy model** | App **writes the rendered DAB into the user's workspace**; the user runs `databricks bundle deploy` (or a one-click Deploy job). | Ships the full design→workspace→deploy loop without betting on the fragile "bundle deploy from inside a container" path. One-click deploy can layer on later. |
| **Identity** | **On-behalf-of the logged-in user** (OBO). Files and resources land in the user's workspace, as them, with their permissions. | Matches "users deploy *their own* agents." Avoids resources being owned by the app service principal. |
| **Production readiness** | **Latest MLflow eval run vs `gates.yml`.** "Ready" = the newest run tagged `eval_result=pass` cleared the `block` tier. | Concrete and *already emitted by the template* — no invention. See §4. **Note:** this is the v1 definition; expected to iterate as we learn what "ready" should mean (e.g. staleness, traffic, human sign-off). |
| **Registry storage** | JSON file (Phase 1, done). Migratable to Lakebase later. | Simple start; interface already abstracts it. |

### Explicitly deferred (not v1)
- App fully running `bundle deploy` itself (one-click, no user step).
- Auto-discovery of agents not created through this tool (best-effort
  `serving-endpoints` import as a "suggest agents" helper).
- Multi-user registry isolation / RBAC beyond what OBO gives us.

---

## 3. Target architecture

```
Databricks App  (single container, single origin — no CORS)
├── FastAPI backend  (agent-builder/server)
│     • serves the built React client (client/dist) at /
│     • /api/agents…            registry CRUD                (Phase 1, done)
│     • /api/deploy             render DAB + write to user workspace (Phase C)
│     • /api/agents/{id}/verify live serving + eval status   (Phase D)
│     • per-request WorkspaceClient built from the user's
│       forwarded token (OBO)                                (Phase B)
│
└── React client  (agent-builder/client)
      • Builder tab — canvas; "Deploy" calls /api/deploy
      • Library tab — cards with contents + live status + readiness badge
```

### Data sources, disambiguated
Three different signals the Library shows, from three different places:

| Signal | Source | Notes |
|---|---|---|
| Tools an agent **uses** | Stored manifest (captured at register/deploy) | Easy; already have the manifest shape. |
| Tools that have **run** / traffic | Serving endpoint metrics / MLflow traces | Live; Phase D (traffic first, traces later). |
| **Eval status / prod-ready** | Latest MLflow run's `eval_result` tag + metrics vs `gates.yml` | Live; Phase D. See §4. |

---

## 4. How "production readiness" works (grounded in the template)

agentops-stacks already does the hard part. From the rendered project:

- **`src/agents/<name>/eval/gates.yml`** — tiered gates:
  - `block` — must not regress vs champion, or must clear a `floor`. A failure
    **blocks promotion**. (e.g. `safety: floor 4.0`, and when UC functions are
    enabled, `tool_call_correctness: floor 3.5`.)
  - `warn` — regressions within `tolerance` allowed but flagged.
  - `info` — logged, never blocks.
- **`eval/utils.py`** tags every eval run: `client.set_tag(run_id,
  "eval_result", "pass" | "fail")`, plus `git_sha`.
- **`find_champion()`** already queries
  `mlflow.search_runs(experiment, "tags.eval_result = 'pass'")` and takes the
  latest — i.e. the current champion.

So the Library's readiness read is a thin wrapper over what already exists:

```
readiness(agent):
  runs = mlflow.search_runs(agent.experiment_id, order_by=[start_time DESC])
  if none: → "Not evaluated"
  latest = runs[0]
  if latest.tags.eval_result == "pass": → "Ready for production"
  else: → "Failing gates"   (+ show which block-tier scorers failed)
```

We surface the per-scorer breakdown (block-tier PASS/FAIL) on the card so the
badge is explainable, not a black box.

---

## 5. Phased build

Each phase is independently useful and testable. Recommended order A→B→C→D.

### Phase A — App packaging *(deployable at all)*
- `app.yaml` — command launches uvicorn serving the API + `client/dist`.
- Build step so `client/dist` is present in the deployed App.
- `databricks.yml` (or docs) to deploy **the builder itself** as an App.
- The backend already mounts `client/dist` at `/`, so this is mostly config.
- **Done when:** the App deploys and serves the existing Builder + Library
  (Library still reads the registry / sample data).

### Phase B — On-behalf-of-user auth *(foundation for C and D)*
- Databricks Apps forward the caller's identity as
  `X-Forwarded-Access-Token`. Backend reads it per request and builds a
  Databricks SDK `WorkspaceClient` acting **as that user**.
- Fallback to the app service principal for non-user contexts (health, cron).
- **Done when:** an authenticated request can list the caller's own workspace
  objects (proves OBO works end-to-end).

### Phase C — Deploy = write DAB into the user's workspace *(the loop)*
- Move DAB rendering from client (`codegen/project.ts`) to a backend
  `/api/deploy` (reuse the same mapping logic; share types).
- Write rendered files to `/Workspace/Users/<user>/<project>/` via the
  Workspace Import API, **as the user** (Phase B).
- Response: target path + exact `databricks bundle deploy -t dev` command
  (and/or scaffold a Deploy job). Auto-register the agent in the Library with
  its manifest + experiment id.
- Keep the existing ZIP download as an offline fallback.
- **Done when:** clicking Deploy in the App lands a working DAB in the user's
  workspace and the agent appears in the Library.

### Phase D — Library live signals *(the payoff)*
- `POST /api/agents/{id}/verify` (as the user):
  - **Serving status** → `GET /api/2.0/serving-endpoints/{name}`
    (ready/updating/failed, traffic).
  - **Eval readiness** → MLflow search per §4.
- Library cards gain: readiness badge, block-tier gate breakdown, last-eval
  timestamp, serving status. The "sample data" banner disappears when live.
- **Done when:** a deployed, evaluated agent shows an accurate
  Ready/Failing/Not-evaluated badge sourced from MLflow.

---

## 6. Reuse vs. build

**Reuse**
- Client codegen (`buildBundleConfig` / `buildAgentOpsStacksConfig`).
- Registry backend (Phase 1 — CRUD + JSON store, done).
- Eval `eval_result` tags the template already emits.

**Build new**
- App packaging (`app.yaml`, deploy config).
- OBO auth layer (per-request user `WorkspaceClient`).
- `/api/deploy` (render + workspace-write).
- `/api/agents/{id}/verify` (serving + MLflow reads).
- Readiness UI on Library cards.

---

## 7. Risks / open questions

- **OBO + workspace-write cannot be fully tested in this dev sandbox** (no
  workspace, no outbound network). Needs a real-workspace smoke test at deploy
  time. Everything else is buildable/validatable locally.
- **`bundle deploy` still needs the user's CLI/job** in v1 (by design). If the
  manual step is friction, that's the trigger to revisit one-click deploy.
- **Experiment id linkage** — the Library needs each agent's MLflow experiment
  to read eval runs. Capture it at deploy/register time (the DAB defines a
  per-agent experiment) rather than guessing later.
- **Registry durability on the App** — point `AGENT_REGISTRY_PATH` at a
  mounted UC volume, or migrate to Lakebase, so restarts don't lose the list.
- **Codegen duplication** — moving render to the backend risks two copies of
  the mapping logic. Decide: port to Python once, or keep TS authoritative and
  have the backend call a shared contract. (Leaning: port the mapping to
  Python in Phase C; keep the client for the ZIP fallback.)

---

## 8. Decision log
- 2026-07-17 — v1 decisions locked: write-to-workspace deploy, OBO auth,
  eval-vs-gates readiness (see §2).
- 2026-07-17 — Plan approved; starting Phase A. Production-readiness accepted
  as v1 (eval-vs-gates) with the explicit expectation of iterating on the
  definition in future improvements.
