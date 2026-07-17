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
import re

from pydantic import BaseModel, Field

# agentops-stacks template repo the config.json drives.
TEMPLATE_REPO = "https://github.com/databricks-solutions/agentops-stacks"

# Guard against path traversal in client-supplied file names.
_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9._-]+$")


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


def _base_dir(email: str | None, project_name: str) -> str:
    """Target dir: /Workspace/Users/<email>/<project> (home fallback if no email)."""
    if email:
        return posixpath.join("/Workspace/Users", email, project_name)
    # No forwarded email (local/default creds): use the caller's home via me().
    return project_name  # resolved against home by caller when needed


def write_project(user_client, email: str | None, req: DeployRequest) -> DeployResult:
    """Write all files under the user's workspace dir; return path + next steps.

    `user_client` is a databricks.sdk.WorkspaceClient (see auth.py).
    """
    from databricks.sdk.service.workspace import ImportFormat

    project = _sanitize_project_name(req.project_name)

    # Resolve the owning user's home if we weren't handed an email.
    resolved_email = email
    if not resolved_email:
        try:
            resolved_email = user_client.current_user.me().user_name
        except Exception:
            resolved_email = None

    base = _base_dir(resolved_email, project)
    if not base.startswith("/Workspace/"):
        # Fall back to the SDK user's home directory.
        home = user_client.current_user.me().user_name
        base = posixpath.join("/Workspace/Users", home, project)
        resolved_email = home

    # Create the project dir (and parents) up front.
    user_client.workspace.mkdirs(base)

    for rel, content in req.files.items():
        _validate_rel_path(rel)
        dest = posixpath.join(base, rel)
        parent = posixpath.dirname(dest)
        if parent and parent != base:
            user_client.workspace.mkdirs(parent)
        user_client.workspace.upload(
            path=dest,
            content=content.encode("utf-8"),
            format=ImportFormat.RAW,
            overwrite=True,
        )

    commands = [
        f"cd {base}",
        f"databricks bundle init {TEMPLATE_REPO} --config-file config.json",
        "databricks bundle deploy -t dev",
    ]
    return DeployResult(workspace_path=base, user=resolved_email or "unknown", commands=commands)
