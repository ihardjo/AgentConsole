"""Source-level access control service.

Extends workspace membership with fine-grained, per-source permissions.
Each user's access to a data source is one of:
  full        -- read content + schema + query results
  read        -- read content + query results (no admin)
  schema_only -- view schema metadata only (no content in query results)
  denied      -- no access at all

Role-based defaults apply when no explicit override exists:
  owner / admin -> full
  editor        -> read
  viewer        -> schema_only

See: Architecture Plan Section 3.7 -- Source-Level Access Control.
"""

from __future__ import annotations

import json
from enum import Enum
from pathlib import Path
from typing import Optional

from federated_rag.workspace_manager import WorkspaceManager


class AccessLevel(str, Enum):
    FULL = "full"
    READ = "read"
    SCHEMA_ONLY = "schema_only"
    DENIED = "denied"


_LEVEL_RANK: dict[AccessLevel, int] = {
    AccessLevel.FULL: 3,
    AccessLevel.READ: 2,
    AccessLevel.SCHEMA_ONLY: 1,
    AccessLevel.DENIED: 0,
}

_ROLE_DEFAULTS: dict[str, AccessLevel] = {
    "owner": AccessLevel.FULL,
    "admin": AccessLevel.FULL,
    "editor": AccessLevel.READ,
    "viewer": AccessLevel.SCHEMA_ONLY,
}

_DEFAULT_STORAGE = Path.home() / ".flowise" / "federated_acl.json"


def level_sufficient(effective: AccessLevel, required: AccessLevel) -> bool:
    """Return True if *effective* meets or exceeds *required*."""
    return _LEVEL_RANK[effective] >= _LEVEL_RANK[required]


def default_access_for_role(role: str) -> AccessLevel:
    """Return the default source access level for a workspace role."""
    return _ROLE_DEFAULTS.get(role, AccessLevel.DENIED)


class AccessControlService:
    """Source-level RBAC for federated data sources.

    Works alongside WorkspaceManager: workspace membership determines
    baseline access, and explicit per-source overrides can raise or
    lower a user's level.
    """

    def __init__(
        self,
        workspace_manager: WorkspaceManager,
        storage_path: Path = _DEFAULT_STORAGE,
    ) -> None:
        self._ws = workspace_manager
        self._storage_path = storage_path
        self._overrides: dict[str, str] = {}  # "user_id:source_id" -> level
        self._load()

    # ------------------------------------------------------------------
    # Query helpers (used before calling FederatedLightRAG.query_with_acl)
    # ------------------------------------------------------------------

    def get_accessible_sources(
        self, user_id: str, workspace_id: str,
    ) -> list[str]:
        """Return source IDs the user can include in query results.

        A source is accessible if the user's effective level is >= READ.
        """
        role = self._ws.get_user_role(user_id, workspace_id)
        if role is None:
            return []

        sources = self._ws.get_workspace_sources(workspace_id)
        return [
            s.id for s in sources
            if level_sufficient(
                self._effective_level(user_id, s.id, role),
                AccessLevel.READ,
            )
        ]

    def get_schema_visible_sources(
        self, user_id: str, workspace_id: str,
    ) -> list[str]:
        """Return source IDs for which the user can view schema metadata.

        A source is schema-visible if effective level is >= SCHEMA_ONLY.
        """
        role = self._ws.get_user_role(user_id, workspace_id)
        if role is None:
            return []

        sources = self._ws.get_workspace_sources(workspace_id)
        return [
            s.id for s in sources
            if level_sufficient(
                self._effective_level(user_id, s.id, role),
                AccessLevel.SCHEMA_ONLY,
            )
        ]

    # ------------------------------------------------------------------
    # Access checks
    # ------------------------------------------------------------------

    def check_source_access(
        self,
        user_id: str,
        source_id: str,
        workspace_id: str,
        required_level: AccessLevel,
    ) -> bool:
        """Return True if the user's effective level meets *required_level*."""
        role = self._ws.get_user_role(user_id, workspace_id)
        if role is None:
            return False
        effective = self._effective_level(user_id, source_id, role)
        return level_sufficient(effective, required_level)

    def get_effective_level(
        self,
        user_id: str,
        source_id: str,
        workspace_id: str,
    ) -> Optional[AccessLevel]:
        """Return the user's effective access level, or None if not a member."""
        role = self._ws.get_user_role(user_id, workspace_id)
        if role is None:
            return None
        return self._effective_level(user_id, source_id, role)

    # ------------------------------------------------------------------
    # Grant / revoke
    # ------------------------------------------------------------------

    def grant_source_access(
        self,
        admin_id: str,
        target_user_id: str,
        source_id: str,
        workspace_id: str,
        level: AccessLevel,
    ) -> bool:
        """Set an explicit access level for *target_user_id* on *source_id*.

        Only workspace owners and admins can grant.
        Returns False if the granting user lacks permission or the target
        is not a workspace member.
        """
        if not self._is_admin(admin_id, workspace_id):
            return False
        if self._ws.get_user_role(target_user_id, workspace_id) is None:
            return False

        key = f"{target_user_id}:{source_id}"
        self._overrides[key] = level.value
        self._save()
        return True

    def revoke_source_access(
        self,
        admin_id: str,
        target_user_id: str,
        source_id: str,
        workspace_id: str,
    ) -> bool:
        """Remove an explicit override, reverting to role-based default.

        Returns False if the admin lacks permission or no override exists.
        """
        if not self._is_admin(admin_id, workspace_id):
            return False

        key = f"{target_user_id}:{source_id}"
        if key not in self._overrides:
            return False
        del self._overrides[key]
        self._save()
        return True

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _effective_level(
        self, user_id: str, source_id: str, role: str,
    ) -> AccessLevel:
        key = f"{user_id}:{source_id}"
        if key in self._overrides:
            return AccessLevel(self._overrides[key])
        return default_access_for_role(role)

    def _is_admin(self, user_id: str, workspace_id: str) -> bool:
        role = self._ws.get_user_role(user_id, workspace_id)
        return role in ("owner", "admin")

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self) -> None:
        if self._storage_path.exists():
            self._overrides = json.loads(self._storage_path.read_text())
        else:
            self._overrides = {}

    def _save(self) -> None:
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._storage_path.write_text(json.dumps(self._overrides, indent=2))
