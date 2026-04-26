"""JSON-backed data source registry with encrypted credentials.

Stores DataSourceRegistration records in a local JSON file. The
connector_config (containing passwords, connection strings) is encrypted
at rest using Fernet, mirroring the Flowise credential-encryption pattern.

For production, replace the JSON backend with a PostgreSQL table.

See: Architecture Plan Section 4.3 -- Workspace Manager (data source registry).
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from federated_rag.crypto import decrypt_config, encrypt_config
from federated_rag.models import (
    ConnectorType,
    DataSourceRegistration,
    SourceStatus,
    SyncMode,
)

_DEFAULT_STORAGE = Path.home() / ".flowise" / "federated_sources.json"
_DEFAULT_KEY = Path.home() / ".flowise" / "federated_encryption.key"


class DataSourceRegistry:
    """CRUD registry for data source registrations with encrypted configs."""

    def __init__(
        self,
        storage_path: Path = _DEFAULT_STORAGE,
        key_path: Path = _DEFAULT_KEY,
    ) -> None:
        self._storage_path = storage_path
        self._key_path = key_path
        self._sources: dict[str, dict] = {}
        self._load()

    def register(
        self,
        workspace_id: str,
        connector_type: ConnectorType,
        config: dict,
        display_name: str,
        sync_mode: SyncMode = SyncMode.MANUAL,
        description: Optional[str] = None,
    ) -> DataSourceRegistration:
        source_id = f"ds_{uuid.uuid4().hex[:12]}"
        now = datetime.now(tz=timezone.utc)
        encrypted = encrypt_config(config, self._key_path)

        record = {
            "id": source_id,
            "workspace_id": workspace_id,
            "connector_type": connector_type.value,
            "encrypted_config": encrypted,
            "display_name": display_name,
            "sync_mode": sync_mode.value,
            "status": SourceStatus.DISCONNECTED.value,
            "description": description,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_synced_at": None,
            "error_message": None,
        }
        self._sources[source_id] = record
        self._save()
        return self._to_registration(record)

    def get(self, source_id: str) -> Optional[DataSourceRegistration]:
        record = self._sources.get(source_id)
        if record is None:
            return None
        return self._to_registration(record)

    def list_sources(self, workspace_id: str) -> list[DataSourceRegistration]:
        return [
            self._to_registration(r)
            for r in self._sources.values()
            if r["workspace_id"] == workspace_id
        ]

    def remove(self, source_id: str) -> bool:
        if source_id not in self._sources:
            return False
        del self._sources[source_id]
        self._save()
        return True

    def update_status(
        self,
        source_id: str,
        status: SourceStatus,
        error_message: Optional[str] = None,
    ) -> None:
        record = self._sources.get(source_id)
        if record is None:
            return
        record["status"] = status.value
        record["error_message"] = error_message
        record["updated_at"] = datetime.now(tz=timezone.utc).isoformat()
        self._save()

    def get_decrypted_config(self, source_id: str) -> Optional[dict]:
        record = self._sources.get(source_id)
        if record is None:
            return None
        return decrypt_config(record["encrypted_config"], self._key_path)

    def set_last_synced(self, source_id: str) -> None:
        record = self._sources.get(source_id)
        if record is None:
            return
        now = datetime.now(tz=timezone.utc)
        record["last_synced_at"] = now.isoformat()
        record["updated_at"] = now.isoformat()
        self._save()

    # -- persistence --

    def _load(self) -> None:
        if self._storage_path.exists():
            self._sources = json.loads(self._storage_path.read_text())
        else:
            self._sources = {}

    def _save(self) -> None:
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._storage_path.write_text(json.dumps(self._sources, indent=2))

    def _to_registration(self, record: dict) -> DataSourceRegistration:
        return DataSourceRegistration(
            id=record["id"],
            workspace_id=record["workspace_id"],
            connector_type=ConnectorType(record["connector_type"]),
            connector_config={},  # never expose encrypted config in the model
            display_name=record["display_name"],
            sync_mode=SyncMode(record["sync_mode"]),
            status=SourceStatus(record["status"]),
            description=record.get("description"),
            created_at=datetime.fromisoformat(record["created_at"]),
            updated_at=datetime.fromisoformat(record["updated_at"]),
            last_synced_at=(
                datetime.fromisoformat(record["last_synced_at"])
                if record.get("last_synced_at")
                else None
            ),
            error_message=record.get("error_message"),
        )
