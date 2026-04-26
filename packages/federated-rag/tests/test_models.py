from __future__ import annotations

from datetime import datetime, timezone

from federated_rag.models import (
    ChangeType,
    ColumnSchema,
    ConnectorType,
    DataSourceRegistration,
    InformationSchema,
    SourceStatus,
    SyncMode,
    TableSchema,
)


def test_connector_type_values():
    assert ConnectorType.POSTGRESQL == "postgresql"
    assert ConnectorType.MYSQL == "mysql"
    assert ConnectorType.MONGODB == "mongodb"
    assert ConnectorType.CSV == "csv"
    assert ConnectorType.FILE == "file"


def test_sync_mode_values():
    assert SyncMode.MANUAL == "manual"
    assert SyncMode.SCHEDULED == "scheduled"
    assert SyncMode.CDC == "cdc"


def test_change_type_values():
    assert ChangeType.INSERT == "insert"
    assert ChangeType.UPDATE == "update"
    assert ChangeType.DELETE == "delete"
    assert ChangeType.SCHEMA_CHANGE == "schema_change"


def test_source_status_values():
    assert SourceStatus.CONNECTED == "connected"
    assert SourceStatus.DISCONNECTED == "disconnected"
    assert SourceStatus.ERROR == "error"
    assert SourceStatus.SYNCING == "syncing"


def test_column_schema_defaults():
    col = ColumnSchema(
        name="id",
        data_type="integer",
        nullable=False,
        is_primary_key=True,
        is_foreign_key=False,
    )
    assert col.name == "id"
    assert col.is_primary_key is True
    assert col.default_value is None
    assert col.foreign_key_ref is None
    assert col.description is None
    assert col.sample_values == []


def test_table_schema_defaults():
    col = ColumnSchema(
        name="name", data_type="text", nullable=True,
        is_primary_key=False, is_foreign_key=False,
    )
    table = TableSchema(name="users", columns=[col])
    assert table.name == "users"
    assert table.schema_name is None
    assert table.row_count is None
    assert len(table.columns) == 1


def test_information_schema_creation():
    now = datetime.now(tz=timezone.utc)
    schema = InformationSchema(
        source_id="src_001",
        source_type=ConnectorType.POSTGRESQL,
        tables=[],
        raw_schema={},
        extracted_at=now,
    )
    assert schema.source_id == "src_001"
    assert schema.source_type == ConnectorType.POSTGRESQL


def test_data_source_registration_defaults():
    now = datetime.now(tz=timezone.utc)
    reg = DataSourceRegistration(
        id="ds_001",
        workspace_id="ws_001",
        connector_type=ConnectorType.POSTGRESQL,
        connector_config={"host": "localhost"},
        display_name="HR Database",
        sync_mode=SyncMode.MANUAL,
        created_at=now,
        updated_at=now,
    )
    assert reg.status == SourceStatus.DISCONNECTED
    assert reg.description is None
    assert reg.last_synced_at is None
    assert reg.schema_snapshot is None
    assert reg.error_message is None
