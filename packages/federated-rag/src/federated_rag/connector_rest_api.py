"""REST API connector with endpoint discovery and content extraction.

Connects to REST APIs, optionally parsing OpenAPI/Swagger specs for
endpoint discovery, and extracts response data as LightRAG-compatible
custom KG batches.

See: Architecture Plan Section 4.1.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional

import httpx

from federated_rag.connector_base import BaseConnector
from federated_rag.models import (
    ColumnSchema,
    ConnectorType,
    InformationSchema,
    TableSchema,
)


class RESTAPIConnector(BaseConnector):
    """REST API connector using httpx.

    Discovers endpoints from OpenAPI specs or manual configuration,
    and extracts paginated response data as custom KG batches.
    """

    connector_type = ConnectorType.REST_API

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._config: dict[str, Any] | None = None
        self._schema_cache: InformationSchema | None = None
        self._endpoints: list[dict[str, Any]] = []

    async def connect(self, config: dict[str, Any]) -> bool:
        """Connect to a REST API.

        Required config keys: base_url.
        Optional: headers (dict), auth_token, openapi_url,
                  endpoints (list of endpoint configs), timeout (seconds).
        """
        try:
            self._config = config
            headers = dict(config.get("headers", {}))
            if config.get("auth_token"):
                headers["Authorization"] = f"Bearer {config['auth_token']}"

            self._client = httpx.AsyncClient(
                base_url=config["base_url"],
                headers=headers,
                timeout=config.get("timeout", 30.0),
            )
            # Test connectivity
            await self._client.get("/")
            self._endpoints = config.get("endpoints", [])
            return True
        except Exception:
            if self._client:
                await self._client.aclose()
            self._client = None
            return False

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
        self._config = None
        self._schema_cache = None
        self._endpoints = []

    async def test_connection(self) -> bool:
        if not self._client:
            return False
        try:
            resp = await self._client.get("/")
            return resp.status_code < 500
        except Exception:
            return False

    async def extract_schema(self) -> InformationSchema:
        """Build schema from configured endpoints or OpenAPI spec."""
        if not self._config:
            raise RuntimeError("Not connected. Call connect() first.")

        tables: list[TableSchema] = []

        # If OpenAPI URL provided, try to parse it
        if self._config.get("openapi_url") and self._client:
            tables = await self._parse_openapi(self._config["openapi_url"])

        # Add manually configured endpoints
        for ep in self._endpoints:
            tables.append(
                TableSchema(
                    name=ep.get("name", ep["path"]),
                    columns=[],
                    schema_name=self._config["base_url"],
                    description=ep.get("description"),
                )
            )

        info = InformationSchema(
            source_id=self._config["base_url"],
            source_type=ConnectorType.REST_API,
            tables=tables,
            raw_schema={"endpoints": self._endpoints},
            extracted_at=datetime.now(tz=timezone.utc),
        )
        self._schema_cache = info
        return info

    async def extract_content(
        self,
        resource_filter: Optional[list[str]] = None,
        since: Optional[datetime] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Fetch each endpoint and yield response data as KG batches."""
        if not self._client:
            raise RuntimeError("Not connected.")

        for ep in self._endpoints:
            ep_name = ep.get("name", ep["path"])
            if resource_filter and ep_name not in resource_filter:
                continue

            async for batch in self._fetch_endpoint(ep):
                yield batch

    async def list_resources(self) -> list[dict[str, Any]]:
        return [
            {
                "name": ep.get("name", ep["path"]),
                "type": "endpoint",
                "method": ep.get("method", "GET"),
                "path": ep["path"],
            }
            for ep in self._endpoints
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _fetch_endpoint(
        self, endpoint: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """Fetch a single endpoint, handling pagination."""
        assert self._client is not None
        path = endpoint["path"]
        method = endpoint.get("method", "GET").upper()
        ep_name = endpoint.get("name", path)
        pagination = endpoint.get("pagination")

        page = 1
        while True:
            params: dict[str, Any] = dict(endpoint.get("params", {}))
            if pagination:
                params[pagination.get("page_param", "page")] = page
                params[pagination.get("size_param", "per_page")] = pagination.get("page_size", 100)

            resp = await self._client.request(method, path, params=params)
            resp.raise_for_status()
            data = resp.json()

            items = _extract_items(data, endpoint.get("data_path"))
            if not items:
                break

            yield responses_to_kg(ep_name, items, self._config.get("base_url", "api"))

            if not pagination or len(items) < pagination.get("page_size", 100):
                break
            page += 1

    async def _parse_openapi(self, url: str) -> list[TableSchema]:
        """Parse an OpenAPI spec to discover endpoints."""
        assert self._client is not None
        try:
            resp = await self._client.get(url)
            spec = resp.json()
            tables = []
            for path, methods in spec.get("paths", {}).items():
                for method, details in methods.items():
                    if method.upper() == "GET":
                        tables.append(
                            TableSchema(
                                name=f"{method.upper()} {path}",
                                columns=[],
                                schema_name=self._config.get("base_url", ""),
                                description=details.get("summary", ""),
                            )
                        )
            return tables
        except Exception:
            return []


# ----------------------------------------------------------------------
# Pure helper functions
# ----------------------------------------------------------------------


def _extract_items(data: Any, data_path: str | None = None) -> list[dict]:
    """Extract list of items from API response using dot-notation path."""
    if data_path:
        for key in data_path.split("."):
            if isinstance(data, dict):
                data = data.get(key, [])
            else:
                return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


def responses_to_kg(
    endpoint_name: str,
    items: list[dict],
    base_url: str = "api",
) -> dict[str, Any]:
    """Convert API response items to LightRAG custom KG format."""
    chunks: list[dict[str, Any]] = []
    entities: list[dict[str, Any]] = []
    file_path = f"rest_api://{base_url}/{endpoint_name}"

    for item in items:
        item_id = item.get("id")
        if item_id is not None:
            chunk_id = f"{endpoint_name}__id={item_id}"
            entity_name = f"{endpoint_name}:{item_id}"
        else:
            item_hash = hashlib.md5(
                json.dumps(item, default=str, sort_keys=True).encode(),
            ).hexdigest()[:8]
            chunk_id = f"{endpoint_name}__hash_{item_hash}"
            entity_name = f"{endpoint_name}:hash_{item_hash}"

        field_texts = [f"{k}: {v}" for k, v in item.items() if k != "id"]
        content = f"{endpoint_name} — " + ", ".join(field_texts)

        chunks.append({
            "source_id": chunk_id,
            "content": content,
            "file_path": file_path,
            "chunk_order_index": 0,
        })

        entities.append({
            "entity_name": entity_name,
            "entity_type": endpoint_name,
            "description": content,
            "source_id": chunk_id,
            "file_path": file_path,
        })

    return {"chunks": chunks, "entities": entities, "relationships": []}
