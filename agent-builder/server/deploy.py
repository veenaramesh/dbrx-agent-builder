"""Write a rendered agentops-stacks project into a user's workspace.

The client renders the project files (config.json, manifest, README, optional
CI/CD) and posts them here. We write them into the user's workspace via the
SDK — as the user when a forwarded token is present (see auth.py) — then return
the location and the CLI next-steps.

We do NOT run `databricks bundle init/deploy` here: that needs the CLI binary,
git, and GitHub access the App container can't be assumed to have. v1 lands the
inputs in the user's workspace and shows the two commands to run from a
workspace terminal. (In-container init is a possible later enhancement.)
"""

from __future__ import annotations

import base64
import posixpath
import os
import re

from pydantic import BaseModel, Field

# agentops-stacks template repo the config.json drives.
TEMPLATE_REPO = "https://github.com/databricks-solutions/agentops-stacks"

# Shared workspace root the app service principal writes into. Files are owned
# by the SP (not the end user), and namespaced per-user for attribution. Set
# AGENT_DEPLOY_ROOT to override (e.g. a folder the SP has write access to). When
# unset, we fall back to the SP's own home directory, which is always writable.
_DEPLOY_ROOT = os.environ.get("AGENT_DEPLOY_ROOT")  # e.g. /Workspace/Shared/agent-builder

# Guard against path traversal in client-supplied file names.
_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9._@-]+$")


class DeployRequest(BaseModel):
    project_name: str = Field(min_length=1)
    initial_agent_name: str = ""
    files: dict[str, str]


class DeployResult(BaseModel):
    workspace_path: str
    user: str
    commands: list[str]


def _sanitize_project_name(name: str) -> str:
    if not _SAFE_SEGMENT.match(name):
        raise ValueError(f"invalid project_name: {name!r}")
    return name


def _validate_rel_path(rel: str) -> str:
    """Reject absolute paths and traversal; allow nested forward-slash paths."""
    if not rel or rel.startswith("/") or "\\" in rel:
        raise ValueError(f"invalid file path: {rel!r}")
    parts = rel.split("/")
    for seg in parts:
        if seg in ("", ".", "..") or not _SAFE_SEGMENT.match(seg):
            raise ValueError(f"invalid file path segment in: {rel!r}")
    return rel


def _user_segment(email: str | None) -> str:
    """A filesystem-safe per-user folder name for attribution."""
    if not email:
        return "unknown"
    return "".join(c if _SAFE_SEGMENT.match(c) else "_" for c in email)


def _resolve_root(sp_client) -> str:
    """The shared root to write under. AGENT_DEPLOY_ROOT if set, else the app
    service principal's own home dir (always writable by the SP)."""
    if _DEPLOY_ROOT:
        return _DEPLOY_ROOT.rstrip("/")
    # SP home, e.g. /Workspace/Users/<sp-uuid>
    sp_name = sp_client.current_user.me().user_name
    return posixpath.join("/Workspace/Users", sp_name, "agent-builder")


def write_project(sp_client, email: str | None, req: DeployRequest) -> DeployResult:
    """Write the rendered project into a shared workspace path as the app
    service principal, namespaced by the requesting user for attribution.

    `sp_client` is a WorkspaceClient authenticated as the app SP (see auth.py).
    Files are owned by the SP, not the end user.
    """
    from databricks.sdk.service.workspace import ImportFormat

    project = _sanitize_project_name(req.project_name)
    root = _resolve_root(sp_client)
    base = posixpath.join(root, _user_segment(email), project)

    # Create the project dir (and parents) up front.
    sp_client.workspace.mkdirs(base)

    for rel, content in req.files.items():
        _validate_rel_path(rel)
        dest = posixpath.join(base, rel)
        parent = posixpath.dirname(dest)
        if parent and parent != base:
            sp_client.workspace.mkdirs(parent)
        # AUTO uploads arbitrary files as-is (config.json, README.md, yaml).
        # There is no RAW format; SOURCE would require a notebook language.
        sp_client.workspace.upload(
            path=dest,
            content=content.encode("utf-8"),
            format=ImportFormat.AUTO,
            overwrite=True,
        )

    commands = [
        f"cd {base}",
        f"databricks bundle init {TEMPLATE_REPO} --config-file config.json",
        "databricks bundle deploy -t dev",
    ]
    return DeployResult(workspace_path=base, user=email or "unknown", commands=commands)
