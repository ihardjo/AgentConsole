"""Federated data source connector layer for LightRAG.

Connects client-owned warehouses and vector DBs into a unified
knowledge graph with workspace isolation, RBAC, and provenance tracking.
"""

from federated_rag.acl_filter import build_context_string, filter_query_results
from federated_rag.connector_base import BaseConnector
from federated_rag.connector_file import FileConnector
from federated_rag.crypto import decrypt_config, encrypt_config
from federated_rag.federated_lightrag import FederatedLightRAG, LightRAGProtocol
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
from federated_rag.provenance import (
    decode_source_id,
    encode_source_id,
    make_file_path,
    parse_file_path,
    tag_custom_kg,
)
from federated_rag.source_registry import DataSourceRegistry
from federated_rag.workspace_manager import (
    Workspace,
    WorkspaceManager,
    WorkspaceMembership,
    WorkspaceSettings,
)

__all__ = [
    "BaseConnector",
    "ChangeEvent",
    "ChangeType",
    "ColumnSchema",
    "ConnectorType",
    "DataSourceRegistration",
    "DataSourceRegistry",
    "FederatedLightRAG",
    "FileConnector",
    "InformationSchema",
    "LightRAGProtocol",
    "SourceStatus",
    "SyncMode",
    "TableSchema",
    "Workspace",
    "WorkspaceManager",
    "WorkspaceMembership",
    "WorkspaceSettings",
    "build_context_string",
    "decode_source_id",
    "decrypt_config",
    "encode_source_id",
    "encrypt_config",
    "filter_query_results",
    "make_file_path",
    "parse_file_path",
    "tag_custom_kg",
]
