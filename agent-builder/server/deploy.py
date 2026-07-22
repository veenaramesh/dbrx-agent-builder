"""Write a rendered agentops-stacks project into a user's workspace.

The client renders the project files (config.json, manifest, README, optional
CI/CD) and posts them here. `config.json` is the *answers file* for the
agentops-stacks DAB template — on its own it is not a runnable bundle.

To land the *whole* bundle (databricks.yml, src/agents/<name>/…, eval/gates.yml,
resources/, CI/CD workflows) we expand the template in-container by running

    databricks bundle init <TEMPLATE_REPO> --config-file config.json

into a temp dir, then upload the entire expanded tree to the user's workspace
via the SDK. `bundle init` runs fully non-interactively from the config and
clones the public template with the CLI's embedded git (no `git` binary needed)
— it only needs outbound HTTPS to github.com and the `databricks` CLI binary.

If the CLI or GitHub egress is unavailable (e.g. a locked-down container), we
fall back to writing just the posted files (config.json + manifest + README)
and surface the two commands to run manually from a workspace terminal, so a
deploy never hard-fails.
"""

from __future__ import annotations

import logging
import platform
import posixpath
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile

from pydantic import BaseModel, Field

log = logging.getLogger("agent-builder.deploy")

# agentops-stacks template repo the config.json drives.
TEMPLATE_REPO = "https://github.com/databricks-solutions/agentops-stacks"

# Databricks CLI used for `bundle init`. Resolution order:
#   1. DATABRICKS_CLI_PATH env (explicit binary path) — skips any download.
#   2. `databricks` on PATH, IF it meets the template's minimum version.
#   3. Download the pinned release zip (DATABRICKS_CLI_VERSION) into a cache dir.
# The Databricks Apps runtime ships an older CLI on PATH (e.g. v0.251.0) than
# the agentops-stacks template requires (min v1.1.0), so a version check gates
# whether we can reuse the PATH/cached binary or must download the pinned one.
_CLI_PATH_ENV = os.environ.get("DATABRICKS_CLI_PATH")
_CLI_VERSION = os.environ.get("DATABRICKS_CLI_VERSION", "1.9.0")
_CLI_MIN_VERSION = os.environ.get("DATABRICKS_CLI_MIN_VERSION", "1.1.0")
_CLI_CACHE_DIR = os.environ.get("DATABRICKS_CLI_CACHE_DIR", "/tmp/agent-builder/cli")

# Set AGENT_BUNDLE_EXPAND=0 to force the legacy config-only behavior (no init).
_EXPAND_BUNDLE = os.environ.get("AGENT_BUNDLE_EXPAND", "1") != "0"

# Shared workspace root the app service principal writes into. Files are owned
# by the SP (not the end user), and namespaced per-user for attribution. Set
# AGENT_DEPLOY_ROOT to override (e.g. a folder the SP has write access to). When
# unset, we fall back to the SP's own home directory, which is always writable.
_DEPLOY_ROOT = os.environ.get("AGENT_DEPLOY_ROOT")  # e.g. /Workspace/Shared/agent-builder

# Guard against path traversal in client-supplied file names.
_SAFE_SEGMENT = re.compile(r"^[A-Za-z0-9._@-]+$")


class DeployToolRef(BaseModel):
    kind: str
    label: str
    detail: str = ""


class DeployRequest(BaseModel):
    project_name: str = Field(min_length=1)
    initial_agent_name: str = ""
    display_name: str = ""   # human-facing name from the builder, used in the Library
    model: str = ""          # initial agent's LLM model
    endpoint: str = ""       # initial agent's serving endpoint
    tools: list[DeployToolRef] = Field(default_factory=list)
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


def _parse_version(text: str) -> tuple[int, ...] | None:
    """Extract a dotted version tuple from CLI text like 'Databricks CLI v1.9.0'."""
    m = re.search(r"(\d+)\.(\d+)\.(\d+)", text or "")
    return tuple(int(g) for g in m.groups()) if m else None


def _cli_meets_min(cli: str) -> bool:
    """True if `cli --version` reports at least _CLI_MIN_VERSION.

    The agentops-stacks template enforces a minimum CLI version; a binary older
    than that fails `bundle init` before it clones, so it's unusable for us.
    """
    minimum = _parse_version(_CLI_MIN_VERSION)
    if not minimum:
        return True  # no/invalid minimum configured → don't gate
    try:
        out = subprocess.run([cli, "--version"], capture_output=True, text=True, timeout=15)
    except Exception:
        return False
    got = _parse_version(out.stdout) or _parse_version(out.stderr)
    if not got:
        return False
    return got >= minimum


def _resolve_cli() -> str | None:
    """Path to a usable `databricks` CLI binary, or None if unavailable.

    Prefers DATABRICKS_CLI_PATH, then a `databricks` on PATH, then a cached or
    freshly-downloaded pinned release. A PATH/cached binary is only reused if it
    meets the template's minimum version — the Apps runtime ships an older CLI
    than agentops-stacks requires, so we download the pinned one when needed.
    Returns None (rather than raising) so the caller falls back to config-only.
    """
    if _CLI_PATH_ENV and os.path.isfile(_CLI_PATH_ENV) and os.access(_CLI_PATH_ENV, os.X_OK):
        # An explicit path is trusted as-is (operator opt-in).
        return _CLI_PATH_ENV

    found = shutil.which("databricks")
    if found and _cli_meets_min(found):
        return found

    cached = os.path.join(_CLI_CACHE_DIR, "databricks")
    if os.path.isfile(cached) and os.access(cached, os.X_OK) and _cli_meets_min(cached):
        return cached

    try:
        return _download_cli(cached)
    except Exception as e:  # network / platform / zip errors
        log.warning("databricks CLI download failed; falling back to config-only: %s", e)
        return None


def _cli_asset_name() -> str:
    """Release asset for the current OS/arch, e.g. databricks_cli_0.240.0_linux_amd64.zip.

    The Databricks Apps runtime is Linux; this also covers local dev on macOS.
    """
    sysname = platform.system().lower()  # 'linux' | 'darwin'
    goos = "darwin" if sysname == "darwin" else "linux"
    machine = platform.machine().lower()
    goarch = "arm64" if machine in ("arm64", "aarch64") else "amd64"
    return f"databricks_cli_{_CLI_VERSION}_{goos}_{goarch}.zip"


def _download_cli(dest: str) -> str:
    """Download + unzip the pinned CLI release to `dest`; return its path."""
    asset = _cli_asset_name()
    url = (
        f"https://github.com/databricks/cli/releases/download/"
        f"v{_CLI_VERSION}/{asset}"
    )
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    log.info("downloading databricks CLI %s from %s", _CLI_VERSION, url)
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        zip_path = tmp.name
    try:
        urllib.request.urlretrieve(url, zip_path)  # noqa: S310 (fixed github host)
        with zipfile.ZipFile(zip_path) as zf:
            # The archive contains a top-level `databricks` binary.
            with zf.open("databricks") as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
        os.chmod(dest, 0o755)
    finally:
        try:
            os.unlink(zip_path)
        except OSError:
            pass
    return dest


def _expand_bundle(cli: str, project: str, config_json: str) -> dict[str, bytes] | None:
    """Run `databricks bundle init` and return {rel_path: bytes} for the whole
    expanded bundle, or None if init fails.

    The template writes the bundle under an inner `input_root_dir` directory; we
    strip that prefix so files land directly under the workspace project dir.
    """
    with tempfile.TemporaryDirectory(prefix="agent-builder-init-") as work:
        cfg_path = os.path.join(work, "config.json")
        with open(cfg_path, "w", encoding="utf-8") as fh:
            fh.write(config_json)
        out_dir = os.path.join(work, "out")
        try:
            proc = subprocess.run(
                [cli, "bundle", "init", TEMPLATE_REPO,
                 "--config-file", cfg_path, "--output-dir", out_dir],
                capture_output=True, text=True, timeout=180,
                # bundle init needs no workspace auth; keep the env minimal but
                # preserve PATH/HOME so the CLI can resolve its own temp/cache.
                env={**os.environ},
            )
        except Exception as e:  # timeout / OSError
            log.warning("bundle init failed to run: %s", e)
            return None
        if proc.returncode != 0:
            log.warning("bundle init exited %s: %s", proc.returncode, proc.stderr.strip()[:500])
            return None

        # Collect the expanded tree. The template roots everything under
        # <input_root_dir>/, which equals the project name in our config.
        files: dict[str, bytes] = {}
        inner_root = os.path.join(out_dir, project)
        walk_root = inner_root if os.path.isdir(inner_root) else out_dir
        for dirpath, _dirs, names in os.walk(walk_root):
            for name in names:
                abs_path = os.path.join(dirpath, name)
                rel = os.path.relpath(abs_path, walk_root)
                # Normalize to forward slashes for the workspace path join.
                rel = rel.replace(os.sep, "/")
                with open(abs_path, "rb") as fh:
                    files[rel] = fh.read()
        return files or None


def write_project(sp_client, email: str | None, req: DeployRequest) -> DeployResult:
    """Write the rendered project into a shared workspace path as the app
    service principal, namespaced by the requesting user for attribution.

    `sp_client` is a WorkspaceClient authenticated as the app SP (see auth.py).
    Files are owned by the SP, not the end user.

    When possible we expand the full agentops-stacks bundle via `bundle init`
    and upload the entire tree. If the CLI/GitHub egress is unavailable, we fall
    back to writing just the posted files (config.json + manifest + README).
    """
    from databricks.sdk.service.workspace import ImportFormat

    project = _sanitize_project_name(req.project_name)
    root = _resolve_root(sp_client)
    base = posixpath.join(root, _user_segment(email), project)

    # Decide what to write: the full expanded bundle, or just the posted files.
    files: dict[str, bytes]
    expanded = False
    config_json = req.files.get("config.json")
    cli = _resolve_cli() if (_EXPAND_BUNDLE and config_json) else None
    if cli:
        bundle = _expand_bundle(cli, project, config_json)
        if bundle:
            files = bundle
            expanded = True
    if not expanded:
        # Fallback: posted files as-is (config-only behavior). These paths are
        # client-supplied, so validate them against traversal.
        for rel in req.files:
            _validate_rel_path(rel)
        files = {rel: content.encode("utf-8") for rel, content in req.files.items()}

    # Create the project dir (and parents) up front.
    sp_client.workspace.mkdirs(base)

    # Expanded-bundle paths come from our own `bundle init` output (trusted),
    # so they are not re-validated here — os.walk cannot produce traversal.
    for rel, content in files.items():
        dest = posixpath.join(base, rel)
        parent = posixpath.dirname(dest)
        if parent and parent != base:
            sp_client.workspace.mkdirs(parent)
        # AUTO uploads arbitrary files as-is (config.json, README.md, yaml, py).
        # There is no RAW format; SOURCE would require a notebook language.
        sp_client.workspace.upload(
            path=dest,
            content=content,
            format=ImportFormat.AUTO,
            overwrite=True,
        )

    if expanded:
        # The runnable bundle is already in the workspace — just deploy it.
        commands = [f"cd {base}", "databricks bundle deploy -t dev"]
    else:
        # Only the config landed; the user still needs to init the template.
        commands = [
            f"cd {base}",
            f"databricks bundle init {TEMPLATE_REPO} --config-file config.json",
            "databricks bundle deploy -t dev",
        ]
    return DeployResult(workspace_path=base, user=email or "unknown", commands=commands)
