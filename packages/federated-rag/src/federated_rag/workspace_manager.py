"""Workspace manager bridging Flowise workspaces to LightRAG namespaces.

Extends LightRAG's native ``workspace`` field (a storage namespace) with
user membership, data source registration, and per-workspace settings.

See: Architecture Plan Section 4.3 -- Workspace Manager.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from federated_rag.models import ConnectorType, SyncMode
from federated_rag.source_registry import DataSourceRegistry


@dataclass
class WorkspaceSettings:
    llm_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-large"
    chunk_size: int = 1200
    chunk_overlap: int = 100
    default_retrieval_mode: str = "mix"
    enable_schema_aware_retrieval: bool = True
    enable_citations: bool = True


@dataclass
class Workspace:
    id: str
    name: str
    owner_id: str
    organization_id: str
    description: str
    settings: WorkspaceSettings
    created_at: datetime
    updated_at: datetime


@dataclass
class WorkspaceMembership:
    user_id: str
    workspace_id: str
    role: str  # owner / admin / editor / viewer
    added_at: datetime


_DEFAULT_STORAGE = Path.home() / ".flowise" / "federated_workspaces.json"


class WorkspaceManager:
    """Manages workspaces, membership, and data source registration.

    Each workspace maps 1:1 to a LightRAG ``POSTGRES_WORKSPACE`` namespace.
    """

    def __init__(
        self,
        registry: DataSourceRegistry,
        storage_path: Path = _DEFAULT_STORAGE,
    ) -> None:
        self._registry = registry
        self._storage_path = storage_path
        self._workspaces: dict[str, dict] = {}
        self._memberships: list[dict] = []
        self._load()

    def create_workspace(
        self,
        name: str,
        owner_id: str,
        org_id: str,
        description: str = "",
        settings: Optional[WorkspaceSettings] = None,
    ) -> Workspace:
        ws_id = f"ws_{uuid.uuid4().hex[:12]}"
        now = datetime.now(tz=timezone.utc)
        ws_settings = settings or WorkspaceSettings()

        record = {
            "id": ws_id,
            "name": name,
            "owner_id": owner_id,
            "organization_id": org_id,
            "description": description,
            "settings": asdict(ws_settings),
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        self._workspaces[ws_id] = record

        self._memberships.append({
            "user_id": owner_id,
            "workspace_id": ws_id,
            "role": "owner",
            "added_at": now.isoformat(),
        })

        self._save()
        return self._to_workspace(record)

    def get_workspace(self, workspace_id: str) -> Optional[Workspace]:
        record = self._workspaces.get(workspace_id)
        if record is None:
            return None
        return self._to_workspace(record)

    def list_workspaces(self, user_id: str) -> list[Workspace]:
        ws_ids = {
            m["workspace_id"]
            for m in self._memberships
            if m["user_id"] == user_id
        }
        return [
            self._to_workspace(self._workspaces[ws_id])
            for ws_id in ws_ids
            if ws_id in self._workspaces
        ]

    def delete_workspace(self, workspace_id: str) -> bool:
        if workspace_id not in self._workspaces:
            return False
        del self._workspaces[workspace_id]
        self._memberships = [
            m for m in self._memberships if m["workspace_id"] != workspace_id
        ]
        for source in self._registry.list_sources(workspace_id):
            self._registry.remove(source.id)
        self._save()
        return True

    def add_member(
        self, user_id: str, workspace_id: str, role: str = "viewer"
    ) -> bool:
        if workspace_id not in self._workspaces:
            return False
        for m in self._memberships:
            if m["user_id"] == user_id and m["workspace_id"] == workspace_id:
                return False  # already a member
        self._memberships.append({
            "user_id": user_id,
            "workspace_id": workspace_id,
            "role": role,
            "added_at": datetime.now(tz=timezone.utc).isoformat(),
        })
        self._save()
        return True

    def remove_member(self, user_id: str, workspace_id: str) -> bool:
        before = len(self._memberships)
        self._memberships = [
            m for m in self._memberships
            if not (m["user_id"] == user_id and m["workspace_id"] == workspace_id)
        ]
        if len(self._memberships) < before:
            self._save()
            return True
        return False

    def get_members(self, workspace_id: str) -> list[WorkspaceMembership]:
        return [
            WorkspaceMembership(
                user_id=m["user_id"],
                workspace_id=m["workspace_id"],
                role=m["role"],
                added_at=datetime.fromisoformat(m["added_at"]),
            )
            for m in self._memberships
            if m["workspace_id"] == workspace_id
        ]

    def get_user_role(self, user_id: str, workspace_id: str) -> Optional[str]:
        for m in self._memberships:
            if m["user_id"] == user_id and m["workspace_id"] == workspace_id:
                return m["role"]
        return None

    def register_data_source(
        self,
        workspace_id: str,
        connector_type: ConnectorType,
        config: dict[str, Any],
        display_name: str,
        sync_mode: SyncMode = SyncMode.MANUAL,
        description: Optional[str] = None,
    ):
        if workspace_id not in self._workspaces:
            raise ValueError(f"Workspace not found: {workspace_id}")
        return self._registry.register(
            workspace_id=workspace_id,
            connector_type=connector_type,
            config=config,
            display_name=display_name,
            sync_mode=sync_mode,
            description=description,
        )

    def get_workspace_sources(self, workspace_id: str):
        return self._registry.list_sources(workspace_id)

    # -- persistence --

    def _load(self) -> None:
        if self._storage_path.exists():
            data = json.loads(self._storage_path.read_text())
            self._workspaces = data.get("workspaces", {})
            self._memberships = data.get("memberships", [])
        else:
            self._workspaces = {}
            self._memberships = []

    def _save(self) -> None:
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "workspaces": self._workspaces,
            "memberships": self._memberships,
        }
        self._storage_path.write_text(json.dumps(data, indent=2))

    def _to_workspace(self, record: dict) -> Workspace:
        return Workspace(
            id=record["id"],
            name=record["name"],
            owner_id=record["owner_id"],
            organization_id=record["organization_id"],
            description=record["description"],
            settings=WorkspaceSettings(**record["settings"]),
            created_at=datetime.fromisoformat(record["created_at"]),
            updated_at=datetime.fromisoformat(record["updated_at"]),
        )
