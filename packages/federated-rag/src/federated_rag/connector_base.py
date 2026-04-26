"""Abstract base class for data source connectors.

Every connector (PostgreSQL, MySQL, MongoDB, File, etc.) implements this
interface. The abstraction decouples data-source specifics from the ingestion
pipeline so new source types can be added by implementing a single class.

See: Architecture Plan Section 4.1 -- Base Connector.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, AsyncIterator, Optional

from federated_rag.models import ConnectorType, InformationSchema


class BaseConnector(ABC):
    """Contract that all data source connectors must fulfill."""

    connector_type: ConnectorType

    @abstractmethod
    async def connect(self, config: dict[str, Any]) -> bool:
        """Establish connection to the data source. Return True on success."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Release connection resources."""

    @abstractmethod
    async def test_connection(self) -> bool:
        """Return True if the connection is alive and usable."""

    @abstractmethod
    async def extract_schema(self) -> InformationSchema:
        """Extract the full information schema from this data source."""

    @abstractmethod
    async def extract_content(
        self,
        resource_filter: Optional[list[str]] = None,
        since: Optional[datetime] = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield batches of extracted content for LightRAG ingestion.

        Each yielded dict has the shape expected by LightRAG.ainsert_custom_kg:
        {"chunks": [...], "entities": [...], "relationships": [...]}.
        """

    @abstractmethod
    async def list_resources(self) -> list[dict[str, Any]]:
        """List available resources (tables, collections, files, endpoints)."""
