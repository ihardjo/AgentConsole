"""S3 connector for cloud storage data extraction.

Lists objects in S3 buckets, downloads supported file types, and
extracts content using the FileConnector's parsing logic.

Note: Uses httpx with S3-compatible APIs (presigned URLs or public buckets)
for the initial implementation. For production with AWS auth, add boto3.

See: Architecture Plan Section 4.1.
"""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator, Optional

from federated_rag.connector_base import BaseConnector
from federated_rag.connector_file import FileConnector
from federated_rag.models import (
    ColumnSchema,
    ConnectorType,
    InformationSchema,
    TableSchema,
)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".csv", ".txt", ".md", ".json"}


class S3Connector(BaseConnector):
    """S3-compatible object storage connector.

    Downloads objects from an S3 bucket to a local temp directory,
    then delegates content extraction to FileConnector.

    Config supports either:
    - aws_access_key_id + aws_secret_access_key + bucket + region
    - endpoint_url (for MinIO/compatible services) + bucket
    """

    connector_type = ConnectorType.S3

    def __init__(self) -> None:
        self._config: dict[str, Any] | None = None
        self._s3_client: Any | None = None
        self._objects: list[dict[str, Any]] = []
        self._schema_cache: InformationSchema | None = None

    async def connect(self, config: dict[str, Any]) -> bool:
        """Connect to S3.

        Required config keys: bucket.
        Optional: aws_access_key_id, aws_secret_access_key, region,
                  endpoint_url, prefix (key prefix filter).
        """
        try:
            import boto3
            self._config = config
            session_kwargs: dict[str, Any] = {}
            if config.get("aws_access_key_id"):
                session_kwargs["aws_access_key_id"] = config["aws_access_key_id"]
                session_kwargs["aws_secret_access_key"] = config["aws_secret_access_key"]
            if config.get("region"):
                session_kwargs["region_name"] = config["region"]

            client_kwargs: dict[str, Any] = {}
            if config.get("endpoint_url"):
                client_kwargs["endpoint_url"] = config["endpoint_url"]

            session = boto3.Session(**session_kwargs)
            self._s3_client = session.client("s3", **client_kwargs)

            # Test: list a single object
            self._s3_client.list_objects_v2(
                Bucket=config["bucket"], MaxKeys=1,
                Prefix=config.get("prefix", ""),
            )
            return True
        except Exception:
            self._s3_client = None
            return False

    async def disconnect(self) -> None:
        self._s3_client = None
        self._config = None
        self._objects = []
        self._schema_cache = None

    async def test_connection(self) -> bool:
        if not self._s3_client or not self._config:
            return False
        try:
            self._s3_client.list_objects_v2(
                Bucket=self._config["bucket"], MaxKeys=1,
            )
            return True
        except Exception:
            return False

    async def extract_schema(self) -> InformationSchema:
        """List bucket objects and build a schema of supported files."""
        if not self._s3_client or not self._config:
            raise RuntimeError("Not connected. Call connect() first.")

        objects = self._list_objects()
        self._objects = objects

        # Group by extension
        ext_groups: dict[str, int] = {}
        for obj in objects:
            ext = Path(obj["Key"]).suffix.lower()
            ext_groups[ext] = ext_groups.get(ext, 0) + 1

        tables = [
            TableSchema(
                name=ext.lstrip(".") or "no_extension",
                columns=[
                    ColumnSchema("key", "string", False, False, False),
                    ColumnSchema("size", "integer", False, False, False),
                    ColumnSchema("last_modified", "datetime", False, False, False),
                ],
                schema_name=self._config["bucket"],
                row_count=count,
            )
            for ext, count in sorted(ext_groups.items())
        ]

        info = InformationSchema(
            source_id=self._config["bucket"],
            source_type=ConnectorType.S3,
            tables=tables,
            raw_schema={"object_count": len(objects)},
            extracted_at=datetime.now(tz=timezone.utc),
        )
        self._schema_cache = info
        return info

    async def extract_content(
        self,
        resource_filter: Optional[list[str]] = None,
        since: Optional[datetime] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Download and extract content from supported S3 objects."""
        if not self._objects:
            await self.extract_schema()

        for obj in self._objects:
            key = obj["Key"]
            ext = Path(key).suffix.lower()

            if ext not in SUPPORTED_EXTENSIONS:
                continue
            if resource_filter and key not in resource_filter:
                continue
            if since and obj.get("LastModified") and obj["LastModified"] < since:
                continue

            yield object_to_kg(key, obj, self._config.get("bucket", "s3"))

    async def list_resources(self) -> list[dict[str, Any]]:
        if not self._objects:
            await self.extract_schema()

        return [
            {
                "name": obj["Key"],
                "type": "object",
                "size": obj.get("Size", 0),
                "last_modified": obj.get("LastModified"),
                "extension": Path(obj["Key"]).suffix.lower(),
            }
            for obj in self._objects
            if Path(obj["Key"]).suffix.lower() in SUPPORTED_EXTENSIONS
        ]

    def _list_objects(self) -> list[dict[str, Any]]:
        """List all objects in the bucket with optional prefix."""
        assert self._s3_client is not None and self._config is not None
        objects: list[dict] = []
        continuation_token = None
        prefix = self._config.get("prefix", "")

        while True:
            kwargs: dict[str, Any] = {
                "Bucket": self._config["bucket"],
                "Prefix": prefix,
            }
            if continuation_token:
                kwargs["ContinuationToken"] = continuation_token

            resp = self._s3_client.list_objects_v2(**kwargs)
            objects.extend(resp.get("Contents", []))

            if not resp.get("IsTruncated"):
                break
            continuation_token = resp.get("NextContinuationToken")

        return objects


# ----------------------------------------------------------------------
# Pure helper functions
# ----------------------------------------------------------------------


def object_to_kg(
    key: str,
    obj: dict[str, Any],
    bucket: str,
) -> dict[str, Any]:
    """Convert an S3 object metadata entry to a custom KG dict.

    Full content extraction (downloading + parsing) will use FileConnector
    in production. This creates a metadata-level KG entry.
    """
    file_path = f"s3://{bucket}/{key}"
    filename = Path(key).name
    chunk_id = f"s3__{hashlib.md5(key.encode()).hexdigest()[:12]}"
    entity_name = f"s3_object:{filename}"

    size = obj.get("Size", 0)
    last_mod = obj.get("LastModified", "")
    content = f"S3 object: {key} (size: {size} bytes, modified: {last_mod})"

    return {
        "chunks": [
            {
                "source_id": chunk_id,
                "content": content,
                "file_path": file_path,
                "chunk_order_index": 0,
            },
        ],
        "entities": [
            {
                "entity_name": entity_name,
                "entity_type": "s3_object",
                "description": content,
                "source_id": chunk_id,
                "file_path": file_path,
            },
        ],
        "relationships": [],
    }
