"""Data models for the Agent Library registry.

The registry is the source of truth for "which agents exist". An entry is
created either when a user adds an agent manually or when the builder deploys
one (auto-register). Contents (tools / retrievers / lakebase) come from the
agentops-stacks manifest captured at register time — no code parsing needed.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ToolKind(str, Enum):
    uc_function = "uc_function"
    vector_search = "vector_search"
    lakebase = "lakebase"


class AgentStatus(str, Enum):
    unknown = "unknown"      # never verified against the workspace
    ready = "ready"
    updating = "updating"
    failed = "failed"


# Promotion lifecycle. The builder lives in dev; readiness = "cleared the bar to
# advance to the next stage".
class Stage(str, Enum):
    dev = "dev"
    test = "test"
    staging = "staging"
    prod = "prod"


STAGE_ORDER = [Stage.dev, Stage.test, Stage.staging, Stage.prod]


def next_stage(stage: Stage) -> Stage | None:
    i = STAGE_ORDER.index(stage)
    return STAGE_ORDER[i + 1] if i + 1 < len(STAGE_ORDER) else None


def experiment_for(project: str, stage: Stage | str) -> str:
    """MLflow experiment path an agentops-stacks bundle creates for a given
    project + deploy target. Matches the template's resources/experiment.yml:
        name: /Shared/${bundle.name}_${bundle.target}
    where bundle.name == input_project_name and target == the stage.
    """
    s = stage.value if isinstance(stage, Stage) else str(stage)
    return f"/Shared/{project}_{s}"


class CheckStatus(str, Enum):
    pass_ = "pass"
    warn = "warn"
    fail = "fail"
    manual = "manual"     # requires a human action (e.g. sign-off)
    unknown = "unknown"   # couldn't be determined (no data / not deployed)


class ReadinessCheck(BaseModel):
    key: str                          # e.g. "deployment", "eval", "usage"
    label: str
    status: CheckStatus
    detail: str = ""                  # human-readable explanation
    blocking: bool = True             # does a non-pass block promotion?


class Readiness(BaseModel):
    """Computed scorecard for promoting to the next stage."""
    verified_at: str                  # ISO-8601
    target_stage: Optional[str] = None  # the stage this readiness is *for* advancing to
    ready: bool = False               # all blocking checks pass (or manually signed off)
    checks: list[ReadinessCheck] = Field(default_factory=list)


class ToolRef(BaseModel):
    """One component an agent uses, mirrored from the manifest."""
    kind: ToolKind
    label: str                       # display name
    detail: str = ""                 # catalog.schema / index / instance


class AgentBase(BaseModel):
    name: str
    project: str = ""                # bundle/project name; used to derive the
                                     # per-stage experiment (/Shared/<project>_<stage>)
    endpoint: str = ""               # serving endpoint name (for live verify)
    app_url: str = ""                # Databricks App URL, if deployed as an App
    experiment: str = ""             # explicit MLflow experiment override (else derived)
    experiment_id: str = ""          # resolved MLflow experiment id (for a link); set on verify
    bundle_path: str = ""            # workspace folder the deployed DAB lives in
    model: str = ""
    workspace: str = ""
    stage: Stage = Stage.dev
    tools: list[ToolRef] = Field(default_factory=list)


class AgentCreate(AgentBase):
    """Payload to register a new agent (or auto-register on deploy)."""
    pass


class AgentUpdate(BaseModel):
    """Partial update; every field optional."""
    name: Optional[str] = None
    project: Optional[str] = None
    endpoint: Optional[str] = None
    app_url: Optional[str] = None
    experiment: Optional[str] = None
    experiment_id: Optional[str] = None
    bundle_path: Optional[str] = None
    model: Optional[str] = None
    workspace: Optional[str] = None
    stage: Optional[Stage] = None
    tools: Optional[list[ToolRef]] = None


class Agent(AgentBase):
    """A stored registry entry."""
    id: str
    registered_at: str               # ISO-8601
    updated_at: str                  # ISO-8601
    status: AgentStatus = AgentStatus.unknown
    requests_24h: Optional[int] = None       # filled by live verify
    # Promotion sign-off (manual gate)
    signed_off_by: Optional[str] = None
    signed_off_at: Optional[str] = None
    # Last computed readiness scorecard
    readiness: Optional[Readiness] = None
