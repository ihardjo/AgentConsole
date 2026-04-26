"""MongoDB connector with schema inference and content streaming.

Connects to MongoDB via motor (async driver), infers schema by sampling
documents from each collection, and streams collection documents as
LightRAG-compatible custom KG batches.

See: Architecture Plan Section 4.1.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

from motor.motor_asyncio import AsyncIOMotorClient

from federated_rag.connector_base import BaseConnector
from federated_rag.models import (
    ColumnSchema,
    ConnectorType,
    InformationSchema,
    TableSchema,
)

BATCH_SIZE = 100
SAMPLE_SIZE = 100  # docs to sample for schema inference


class MongoDBConnector(BaseConnector):
    """MongoDB connector using motor with schema inference.

    Since MongoDB is schemaless, schema is inferred by sampling documents
    from each collection and merging observed field types.
    """

    connector_type = ConnectorType.MONGODB

    def __init__(
        self, batch_size: int = BATCH_SIZE, sample_size: int = SAMPLE_SIZE,
    ) -> None:
        self._client: AsyncIOMotorClient | None = None
        self._db = None
        self._config: dict[str, Any] | None = None
        self._batch_size = batch_size
        self._sample_size = sample_size
        self._schema_cache: InformationSchema | None = None

    async def connect(self, config: dict[str, Any]) -> bool:
        """Connect to MongoDB.

        Required config keys: host, database.
        Optional: port (27017), username, password, auth_source.
        Alternatively: connection_string (full URI).
        """
        try:
            self._config = config
            if "connection_string" in config:
                uri = config["connection_string"]
            else:
                host = config["host"]
                port = config.get("port", 27017)
                username = config.get("username", "")
                password = config.get("password", "")
                auth_source = config.get("auth_source", "admin")
                if username and password:
                    uri = f"mongodb://{username}:{password}@{host}:{port}/?authSource={auth_source}"
                else:
                    uri = f"mongodb://{host}:{port}"

            self._client = AsyncIOMotorClient(
                uri, serverSelectionTimeoutMS=5000,
            )
            self._db = self._client[config["database"]]
            # Verify connectivity
            await self._client.admin.command("ping")
            return True
        except Exception:
            self._client = None
            self._db = None
            return False

    async def disconnect(self) -> None:
        if self._client:
            self._client.close()
            self._client = None
        self._db = None
        self._config = None
        self._schema_cache = None

    async def test_connection(self) -> bool:
        if not self._client:
            return False
        try:
            await self._client.admin.command("ping")
            return True
        except Exception:
            return False

    async def extract_schema(self) -> InformationSchema:
        """Infer schema by sampling documents from each collection."""
        if not self._db or not self._config:
            raise RuntimeError("Not connected. Call connect() first.")

        collection_names = await self._db.list_collection_names()
        tables: list[TableSchema] = []

        for coll_name in sorted(collection_names):
            if coll_name.startswith("system."):
                continue

            coll = self._db[coll_name]
            doc_count = await coll.estimated_document_count()
            sample = await coll.find().limit(self._sample_size).to_list(
                length=self._sample_size,
            )

            columns = infer_columns(sample)
            tables.append(
                TableSchema(
                    name=coll_name,
                    columns=columns,
                    schema_name=self._config["database"],
                    row_count=doc_count,
                )
            )

        info = InformationSchema(
            source_id=self._config["database"],
            source_type=ConnectorType.MONGODB,
            tables=tables,
            raw_schema={
                "collections": collection_names,
                "sample_size": self._sample_size,
            },
            extracted_at=datetime.now(tz=timezone.utc),
        )
        self._schema_cache = info
        return info

    async def extract_content(
        self,
        resource_filter: Optional[list[str]] = None,
        since: Optional[datetime] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield custom KG batches from each collection."""
        if not self._schema_cache:
            await self.extract_schema()
        assert self._schema_cache is not None

        for table in self._schema_cache.tables:
            if resource_filter and table.name not in resource_filter:
                continue
            async for batch_kg in self._stream_collection(table, since):
                yield batch_kg

    async def list_resources(self) -> list[dict[str, Any]]:
        if not self._schema_cache:
            await self.extract_schema()
        assert self._schema_cache is not None

        return [
            {
                "name": t.name,
                "type": "collection",
                "schema": t.schema_name,
                "row_count": t.row_count,
                "column_count": len(t.columns),
            }
            for t in self._schema_cache.tables
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _stream_collection(
        self, table: TableSchema, since: Optional[datetime],
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream documents from a collection in batches."""
        assert self._db is not None
        coll = self._db[table.name]

        query: dict[str, Any] = {}
        if since:
            ts_field = _find_timestamp_field(table)
            if ts_field:
                query[ts_field] = {"$gt": since}

        batch: list[dict] = []
        async for doc in coll.find(query):
            batch.append(doc)
            if len(batch) >= self._batch_size:
                yield docs_to_kg(table, batch)
                batch = []

        if batch:
            yield docs_to_kg(table, batch)


# ----------------------------------------------------------------------
# Pure helper functions (testable without MongoDB)
# ----------------------------------------------------------------------


def infer_columns(sample: list[dict]) -> list[ColumnSchema]:
    """Infer column schemas from a sample of MongoDB documents.

    Merges field types across all sampled documents. The _id field is
    treated as a primary key.
    """
    field_types: dict[str, set[str]] = {}
    field_count: dict[str, int] = {}
    total = len(sample)

    for doc in sample:
        for key, value in _flatten_doc(doc).items():
            field_types.setdefault(key, set()).add(_mongo_type(value))
            field_count[key] = field_count.get(key, 0) + 1

    columns: list[ColumnSchema] = []
    for field_name in sorted(field_types):
        types = field_types[field_name]
        type_str = " | ".join(sorted(types)) if len(types) > 1 else next(iter(types))
        present_in_all = field_count[field_name] >= total
        columns.append(
            ColumnSchema(
                name=field_name,
                data_type=type_str,
                nullable=not present_in_all,
                is_primary_key=(field_name == "_id"),
                is_foreign_key=False,
            )
        )

    return columns


def docs_to_kg(
    table: TableSchema, docs: list[dict],
) -> dict[str, Any]:
    """Convert a batch of MongoDB documents to LightRAG custom KG format."""
    chunks: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    db_name = table.schema_name or "mongodb"
    file_path = f"mongodb://{db_name}/{table.name}"

    for doc in docs:
        doc_id = doc.get("_id")
        if doc_id is not None:
            chunk_id = f"{table.name}__id={doc_id}"
            entity_name = f"{table.name}:{doc_id}"
        else:
            doc_hash = hashlib.md5(
                json.dumps(doc, default=str, sort_keys=True).encode(),
            ).hexdigest()[:8]
            chunk_id = f"{table.name}__hash_{doc_hash}"
            entity_name = f"{table.name}:hash_{doc_hash}"

        flat = _flatten_doc(doc)
        field_texts = [
            f"{k}: {v}" for k, v in flat.items() if k != "_id"
        ]
        content = f"{table.name} document — " + ", ".join(field_texts)

        chunks.append({
            "source_id": chunk_id,
            "content": content,
            "file_path": file_path,
            "chunk_order_index": 0,
        })

        entities.append({
            "entity_name": entity_name,
            "entity_type": table.name,
            "description": content,
            "source_id": chunk_id,
            "file_path": file_path,
        })

    return {
        "chunks": chunks,
        "entities": entities,
        "relationships": [],
    }


def _flatten_doc(doc: dict, prefix: str = "") -> dict[str, Any]:
    """Flatten a nested MongoDB document into dot-notation keys."""
    flat: dict[str, Any] = {}
    for key, value in doc.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict) and not any(
            k.startswith("$") for k in value
        ):
            flat.update(_flatten_doc(value, full_key))
        else:
            flat[full_key] = value
    return flat


def _mongo_type(value: Any) -> str:
    """Map a Python value to a MongoDB-style type name."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "double"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, datetime):
        return "date"
    return type(value).__name__


def _find_timestamp_field(table: TableSchema) -> str | None:
    """Find a date-type field suitable for incremental sync."""
    candidates = {"updated_at", "modified_at", "last_modified", "updatedAt"}
    for col in table.columns:
        if col.name in candidates and "date" in col.data_type.lower():
            return col.name
    return None
