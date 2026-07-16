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


class ToolRef(BaseModel):
    """One component an agent uses, mirrored from the manifest."""
    kind: ToolKind
    label: str                       # display name
    detail: str = ""                 # catalog.schema / index / instance


class AgentBase(BaseModel):
    name: str
    endpoint: str = ""               # serving endpoint name (for live verify)
    app_url: str = ""                # Databricks App URL, if deployed as an App
    model: str = ""
    workspace: str = ""
    tools: list[ToolRef] = Field(default_factory=list)


class AgentCreate(AgentBase):
    """Payload to register a new agent (or auto-register on deploy)."""
    pass


class AgentUpdate(BaseModel):
    """Partial update; every field optional."""
    name: Optional[str] = None
    endpoint: Optional[str] = None
    app_url: Optional[str] = None
    model: Optional[str] = None
    workspace: Optional[str] = None
    tools: Optional[list[ToolRef]] = None


class Agent(AgentBase):
    """A stored registry entry."""
    id: str
    registered_at: str               # ISO-8601
    updated_at: str                  # ISO-8601
    status: AgentStatus = AgentStatus.unknown
    requests_24h: Optional[int] = None   # filled by live verify (Phase 3)
