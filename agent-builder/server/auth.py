"""On-behalf-of-user auth for the Databricks App.

A Databricks App runs as a service principal, but we want file writes to land
in the *logged-in user's* workspace, owned by them. The Apps proxy forwards the
user's identity on every request:

  X-Forwarded-Access-Token   — the user's OAuth access token
  X-Forwarded-Email / -User  — the user's identity (informational)

`user_workspace_client()` builds a Databricks SDK WorkspaceClient authenticated
as that user from the forwarded token. When there's no forwarded token (local
dev, health checks, cron), it falls back to the SDK's default credential chain
(a CLI profile locally, or the app service principal in the App).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Request

# Header the Databricks Apps proxy sets with the end user's OAuth token.
_USER_TOKEN_HEADER = "x-forwarded-access-token"
_USER_EMAIL_HEADER = "x-forwarded-email"
_USER_NAME_HEADER = "x-forwarded-preferred-username"


@dataclass
class UserContext:
    """Resolved caller identity + an SDK client acting as them."""
    client: object          # databricks.sdk.WorkspaceClient
    email: str | None
    on_behalf_of_user: bool  # True if built from the forwarded user token


def _host() -> str | None:
    # In an App the SDK resolves the host from the environment; locally it comes
    # from the default profile. DATABRICKS_HOST overrides both when set.
    return os.environ.get("DATABRICKS_HOST")


def user_workspace_client(request: Request) -> UserContext:
    """Build a WorkspaceClient for the caller.

    Prefers the forwarded user token (acts as the user). Falls back to the
    default credential chain when absent.
    """
    # Imported lazily so importing this module never requires the SDK to be
    # installed (keeps unit tests and non-Databricks contexts light).
    from databricks.sdk import WorkspaceClient

    token = request.headers.get(_USER_TOKEN_HEADER)
    email = request.headers.get(_USER_EMAIL_HEADER) or request.headers.get(_USER_NAME_HEADER)

    if token:
        return UserContext(
            client=WorkspaceClient(host=_host(), token=token, auth_type="pat"),
            email=email,
            on_behalf_of_user=True,
        )

    # No forwarded token: default credentials (CLI profile locally, or the app
    # service principal inside the App).
    return UserContext(client=WorkspaceClient(), email=email, on_behalf_of_user=False)
