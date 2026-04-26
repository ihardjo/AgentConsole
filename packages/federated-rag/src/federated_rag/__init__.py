"""Federated data source connector layer for LightRAG.

Connects client-owned warehouses and vector DBs into a unified
knowledge graph with workspace isolation, RBAC, and provenance tracking.
"""

from federated_rag.connector_base import BaseConnector
from federated_rag.connector_file import FileConnector
from federated_rag.crypto import decrypt_config, encrypt_config
from federated_rag.models import (
    ChangeEvent,
    ChangeType,
    ColumnSchema,
    ConnectorType,
    DataSourceRegistration,
    InformationSchema,
    SourceStatus,
    SyncMode,
    TableSchema,
)

__all__ = [
    "BaseConnector",
    "ChangeEvent",
    "ChangeType",
    "ColumnSchema",
    "ConnectorType",
    "DataSourceRegistration",
    "FileConnector",
    "InformationSchema",
    "SourceStatus",
    "SyncMode",
    "TableSchema",
    "decrypt_config",
    "encrypt_config",
]
