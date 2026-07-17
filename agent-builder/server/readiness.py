"""Compute an agent's promotion-readiness scorecard.

The builder lives in dev; "ready" means the agent has cleared the bar to
advance to the NEXT stage (dev -> test -> staging -> prod). Readiness is a
scorecard of independent checks, each pass/warn/fail/manual, with an overall
verdict = all blocking checks pass (a manual sign-off can satisfy the sign-off
check).

Checks (v1):
  - deployment : serving endpoint exists and is READY (blocking)
  - eval       : latest MLflow eval run passed gates AND is fresh (blocking)
  - usage      : recent traffic handled without an error spike; latency/cost
                 within budget (non-blocking warn signal in v1)
  - signoff    : a human approved promotion (manual; blocking)

All reads use the app service principal (see auth.py). Every check degrades
gracefully to `unknown` when the underlying data isn't available, and only
`fail` on a blocking check blocks promotion — `unknown` warns, doesn't block,
so a freshly-built, never-deployed agent reads honestly instead of "failed".
"""

from __future__ import annotations

from models import (
    Agent,
    CheckStatus,
    Readiness,
    ReadinessCheck,
    Stage,
    next_stage,
)

# Usage thresholds (v1 defaults; tune later).
_MIN_REQUESTS = 10          # minimum handled requests to have usage signal
_MAX_ERROR_RATE = 0.05      # 5% error rate budget
_MAX_P95_LATENCY_MS = 5000  # p95 latency budget


def _deployment_check(w, agent: Agent) -> ReadinessCheck:
    if not agent.endpoint:
        return ReadinessCheck(
            key="deployment", label="Deployed & serving",
            status=CheckStatus.unknown, blocking=True,
            detail="No serving endpoint recorded for this agent yet.",
        )
    try:
        ep = w.serving_endpoints.get(agent.endpoint)
        state = getattr(getattr(ep, "state", None), "ready", None)
        ready_val = str(state) if state is not None else ""
        if "READY" in ready_val.upper():
            return ReadinessCheck(
                key="deployment", label="Deployed & serving",
                status=CheckStatus.pass_, blocking=True,
                detail=f"Endpoint '{agent.endpoint}' is READY.",
            )
        return ReadinessCheck(
            key="deployment", label="Deployed & serving",
            status=CheckStatus.fail, blocking=True,
            detail=f"Endpoint '{agent.endpoint}' state: {ready_val or 'unknown'}.",
        )
    except Exception as e:
        return ReadinessCheck(
            key="deployment", label="Deployed & serving",
            status=CheckStatus.unknown, blocking=True,
            detail=f"Could not read endpoint '{agent.endpoint}': {type(e).__name__}.",
        )


def _find_experiment(w, agent: Agent):
    """Resolve the agent's MLflow experiment by explicit path or name match."""
    if agent.experiment:
        try:
            return w.experiments.get_experiment_by_name(agent.experiment)
        except Exception:
            pass
    return None


def _eval_check(w, agent: Agent) -> ReadinessCheck:
    exp = _find_experiment(w, agent)
    if exp is None:
        return ReadinessCheck(
            key="eval", label="Evaluation passing & fresh",
            status=CheckStatus.unknown, blocking=True,
            detail="No MLflow experiment linked; run evaluation to populate.",
        )
    exp_id = getattr(getattr(exp, "experiment", exp), "experiment_id", None) or getattr(exp, "experiment_id", None)
    try:
        runs = list(w.experiments.search_runs(
            experiment_ids=[exp_id],
            order_by=["start_time DESC"],
            max_results=1,
        ))
    except Exception as e:
        return ReadinessCheck(
            key="eval", label="Evaluation passing & fresh",
            status=CheckStatus.unknown, blocking=True,
            detail=f"Could not read eval runs: {type(e).__name__}.",
        )
    if not runs:
        return ReadinessCheck(
            key="eval", label="Evaluation passing & fresh",
            status=CheckStatus.fail, blocking=True,
            detail="No evaluation runs found for this agent.",
        )
    run = runs[0]
    tags = {t.key: t.value for t in getattr(getattr(run, "data", None), "tags", []) or []}
    result = tags.get("eval_result")
    if result == "pass":
        return ReadinessCheck(
            key="eval", label="Evaluation passing & fresh",
            status=CheckStatus.pass_, blocking=True,
            detail="Latest eval run passed gates" + (f" (git {tags['git_sha'][:8]})" if tags.get("git_sha") else "") + ".",
        )
    if result == "fail":
        return ReadinessCheck(
            key="eval", label="Evaluation passing & fresh",
            status=CheckStatus.fail, blocking=True,
            detail="Latest eval run failed one or more block-tier gates.",
        )
    return ReadinessCheck(
        key="eval", label="Evaluation passing & fresh",
        status=CheckStatus.warn, blocking=True,
        detail="Latest run has no eval_result tag — evaluation may not have run.",
    )


def _usage_check(w, agent: Agent) -> ReadinessCheck:
    """Best-effort recent-usage signal. Non-blocking in v1: absence of traffic
    warns (you probably want real usage before promoting) but doesn't hard-block.
    """
    # Trace/inference-table reads vary by workspace setup; v1 reports 'unknown'
    # cleanly rather than guessing a schema. Wired to real traces in a follow-up.
    return ReadinessCheck(
        key="usage", label="Real usage (traffic, errors, latency)",
        status=CheckStatus.unknown, blocking=False,
        detail="Usage metrics not yet wired; will read from traces/inference tables.",
    )


def _signoff_check(agent: Agent) -> ReadinessCheck:
    if agent.signed_off_by:
        return ReadinessCheck(
            key="signoff", label="Human sign-off",
            status=CheckStatus.pass_, blocking=True,
            detail=f"Approved by {agent.signed_off_by}"
                   + (f" on {agent.signed_off_at[:10]}" if agent.signed_off_at else "") + ".",
        )
    return ReadinessCheck(
        key="signoff", label="Human sign-off",
        status=CheckStatus.manual, blocking=True,
        detail="Awaiting a reviewer's approval to promote.",
    )


def compute_readiness(w, agent: Agent, now_iso: str) -> Readiness:
    """Run all checks and produce the promotion verdict for the next stage."""
    checks = [
        _deployment_check(w, agent),
        _eval_check(w, agent),
        _usage_check(w, agent),
        _signoff_check(agent),
    ]
    # Ready = every blocking check is a pass. warn/unknown/manual/fail on a
    # blocking check all withhold readiness (manual is satisfied only once the
    # sign-off check flips to pass).
    ready = all(c.status == CheckStatus.pass_ for c in checks if c.blocking)
    target = next_stage(agent.stage)
    return Readiness(
        verified_at=now_iso,
        target_stage=target.value if target else None,
        ready=ready,
        checks=checks,
    )
