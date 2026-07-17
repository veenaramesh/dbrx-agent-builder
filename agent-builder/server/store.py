"""JSON-file registry store.

Phase 1 storage: a single JSON file holding all registry entries. Simple,
migratable to Lakebase later behind the same interface. All writes are
serialized with a lock and written atomically (temp file + rename) so a
crash mid-write can't corrupt the registry.

The storage path is configurable via AGENT_REGISTRY_PATH; it defaults to a
file under the app's working directory. On a Databricks App, point it at a
mounted UC volume for durability across restarts.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from models import Agent, AgentCreate, AgentUpdate

# Default to a writable location. On a Databricks App the synced source dir is
# read-only, so a relative path there would fail; /tmp is always writable.
# Point AGENT_REGISTRY_PATH at a mounted UC volume for durability across
# restarts (see docs/deploy-app.md).
_DEFAULT_PATH = os.environ.get(
    "AGENT_REGISTRY_PATH", os.path.join(tempfile.gettempdir(), "agent-builder", "registry.json")
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RegistryStore:
    def __init__(self, path: str = _DEFAULT_PATH) -> None:
        self._path = Path(path)
        self._lock = threading.Lock()
        # Do NOT write on init — that would crash at import time if the path is
        # not yet writable. The parent dir is created lazily on first write;
        # reads tolerate a missing file (see _read_all).

    # ── low-level file IO ────────────────────────────────────────────────
    def _read_all(self) -> list[dict]:
        try:
            with self._path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write_all(self, rows: list[dict]) -> None:
        # create the parent dir lazily (init does not, so import never writes)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # atomic write: temp file in same dir, then rename
        tmp = self._path.with_suffix(self._path.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
        tmp.replace(self._path)

    # ── public API ───────────────────────────────────────────────────────
    def list(self) -> list[Agent]:
        return [Agent(**row) for row in self._read_all()]

    def get(self, agent_id: str) -> Agent | None:
        for row in self._read_all():
            if row.get("id") == agent_id:
                return Agent(**row)
        return None

    def create(self, payload: AgentCreate) -> Agent:
        with self._lock:
            rows = self._read_all()
            ts = _now()
            agent = Agent(
                id=uuid.uuid4().hex,
                registered_at=ts,
                updated_at=ts,
                **payload.model_dump(),
            )
            rows.append(agent.model_dump())
            self._write_all(rows)
            return agent

    def update(self, agent_id: str, patch: AgentUpdate) -> Agent | None:
        with self._lock:
            rows = self._read_all()
            for i, row in enumerate(rows):
                if row.get("id") == agent_id:
                    changes = patch.model_dump(exclude_none=True)
                    row.update(changes)
                    row["updated_at"] = _now()
                    rows[i] = row
                    self._write_all(rows)
                    return Agent(**row)
            return None

    def delete(self, agent_id: str) -> bool:
        with self._lock:
            rows = self._read_all()
            new_rows = [r for r in rows if r.get("id") != agent_id]
            if len(new_rows) == len(rows):
                return False
            self._write_all(new_rows)
            return True
