from __future__ import annotations

from pathlib import Path

import pytest

from federated_rag.models import ConnectorType, SourceStatus, SyncMode
from federated_rag.source_registry import DataSourceRegistry


@pytest.fixture()
def registry(tmp_path: Path) -> DataSourceRegistry:
    return DataSourceRegistry(
        storage_path=tmp_path / "sources.json",
        key_path=tmp_path / "test.key",
    )


PG_CONFIG = {
    "host": "hr-db.internal",
    "port": 5432,
    "user": "readonly",
    "password": "s3cret",
    "database": "hr_production",
}


def test_register_and_get(registry: DataSourceRegistry):
    reg = registry.register(
        workspace_id="ws_001",
        connector_type=ConnectorType.POSTGRESQL,
        config=PG_CONFIG,
        display_name="HR Database",
    )
    assert reg.id.startswith("ds_")
    assert reg.display_name == "HR Database"
    assert reg.connector_type == ConnectorType.POSTGRESQL
    assert reg.status == SourceStatus.DISCONNECTED

    fetched = registry.get(reg.id)
    assert fetched is not None
    assert fetched.display_name == "HR Database"


def test_get_returns_none_for_missing(registry: DataSourceRegistry):
    assert registry.get("ds_nonexistent") is None


def test_list_by_workspace(registry: DataSourceRegistry):
    registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB A")
    registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB B")
    registry.register("ws_002", ConnectorType.POSTGRESQL, PG_CONFIG, "DB C")

    ws1 = registry.list_sources("ws_001")
    assert len(ws1) == 2
    assert {s.display_name for s in ws1} == {"DB A", "DB B"}

    ws2 = registry.list_sources("ws_002")
    assert len(ws2) == 1


def test_remove(registry: DataSourceRegistry):
    reg = registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB X")
    assert registry.remove(reg.id) is True
    assert registry.get(reg.id) is None
    assert registry.remove(reg.id) is False


def test_update_status(registry: DataSourceRegistry):
    reg = registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB Y")
    registry.update_status(reg.id, SourceStatus.CONNECTED)
    assert registry.get(reg.id).status == SourceStatus.CONNECTED


def test_update_status_with_error(registry: DataSourceRegistry):
    reg = registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB E")
    registry.update_status(reg.id, SourceStatus.ERROR, "Connection refused")
    fetched = registry.get(reg.id)
    assert fetched.status == SourceStatus.ERROR
    assert fetched.error_message == "Connection refused"


def test_credentials_encrypted_on_disk(registry: DataSourceRegistry, tmp_path: Path):
    registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "Encrypted DB")
    raw = (tmp_path / "sources.json").read_text()
    assert "s3cret" not in raw
    assert "hr-db.internal" not in raw


def test_get_decrypted_config(registry: DataSourceRegistry):
    reg = registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB Z")
    config = registry.get_decrypted_config(reg.id)
    assert config == PG_CONFIG


def test_set_last_synced(registry: DataSourceRegistry):
    reg = registry.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "DB S")
    assert registry.get(reg.id).last_synced_at is None
    registry.set_last_synced(reg.id)
    assert registry.get(reg.id).last_synced_at is not None


def test_persistence_across_instances(tmp_path: Path):
    path = tmp_path / "sources.json"
    key = tmp_path / "test.key"

    r1 = DataSourceRegistry(storage_path=path, key_path=key)
    r1.register("ws_001", ConnectorType.POSTGRESQL, PG_CONFIG, "Persistent DB")

    r2 = DataSourceRegistry(storage_path=path, key_path=key)
    sources = r2.list_sources("ws_001")
    assert len(sources) == 1
    assert sources[0].display_name == "Persistent DB"
