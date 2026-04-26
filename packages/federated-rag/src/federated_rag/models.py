"""Shared data models for the federated connector layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ConnectorType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MONGODB = "mongodb"
    CSV = "csv"
    XLSX = "xlsx"
    REST_API = "rest_api"
    S3 = "s3"
    FILE = "file"


class SyncMode(str, Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    CDC = "cdc"


class ChangeType(str, Enum):
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    SCHEMA_CHANGE = "schema_change"


class SourceStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    SYNCING = "syncing"


@dataclass
class ColumnSchema:
    name: str
    data_type: str
    nullable: bool
    is_primary_key: bool
    is_foreign_key: bool
    default_value: Optional[str] = None
    foreign_key_ref: Optional[str] = None
    description: Optional[str] = None
    sample_values: list[Any] = field(default_factory=list)


@dataclass
class TableSchema:
    name: str
    columns: list[ColumnSchema]
    schema_name: Optional[str] = None
    row_count: Optional[int] = None
    description: Optional[str] = None


@dataclass
class InformationSchema:
    source_id: str
    source_type: ConnectorType
    tables: list[TableSchema]
    raw_schema: dict[str, Any]
    extracted_at: datetime


@dataclass
class ChangeEvent:
    source_id: str
    workspace_id: str
    change_type: ChangeType
    resource_name: str
    timestamp: datetime
    primary_key: Optional[dict[str, Any]] = None
    before: Optional[dict[str, Any]] = None
    after: Optional[dict[str, Any]] = None


@dataclass
class DataSourceRegistration:
    id: str
    workspace_id: str
    connector_type: ConnectorType
    connector_config: dict[str, Any]
    display_name: str
    sync_mode: SyncMode
    created_at: datetime
    updated_at: datetime
    status: SourceStatus = SourceStatus.DISCONNECTED
    description: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    schema_snapshot: Optional[InformationSchema] = None
    error_message: Optional[str] = None
