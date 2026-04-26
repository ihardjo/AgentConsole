"""FederatedLightRAG -- LightRAG wrapper with provenance and ACL.

Wraps a LightRAG instance to add:
- Provenance tagging on every insert (source_id, source_type)
- ACL-aware query filtering (results filtered by accessible sources)
- Incremental update support for CDC change events
- Source data deletion

See: Architecture Plan Section 3.4 and 4.4.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from federated_rag.acl_filter import build_context_string, filter_query_results
from federated_rag.models import ChangeEvent, ChangeType
from federated_rag.provenance import tag_custom_kg


@runtime_checkable
class LightRAGProtocol(Protocol):
    """Protocol defining the LightRAG methods we depend on.

    Allows testing with mocks without coupling to the real LightRAG class.
    """

    async def ainsert_custom_kg(
        self, custom_kg: dict[str, Any], full_doc_id: str | None = None,
    ) -> None: ...

    async def aquery(
        self, query: str, param: Any = None, system_prompt: str | None = None,
    ) -> str: ...

    async def aquery_data(
        self, query: str, param: Any = None,
    ) -> dict[str, Any]: ...


class FederatedLightRAG:
    """LightRAG wrapper with federated provenance tagging and ACL filtering.

    Every insert is tagged with source provenance (data source ID + type).
    Every query can be filtered to only return data from accessible sources.
    """

    def __init__(self, rag: LightRAGProtocol) -> None:
        self._rag = rag

    async def insert_with_provenance(
        self,
        custom_kg: dict[str, Any],
        source_id: str,
        source_type: str,
        full_doc_id: str | None = None,
    ) -> None:
        """Insert custom KG with provenance metadata.

        Tags every chunk, entity, and relationship with the data source ID
        and connector type before delegating to LightRAG.ainsert_custom_kg().

        Args:
            custom_kg: LightRAG custom KG dict with chunks, entities,
                       relationships.
            source_id: DataSourceRegistration.id (e.g., "ds_abc123").
            source_type: ConnectorType value (e.g., "postgresql").
            full_doc_id: Optional document ID for LightRAG tracking.
        """
        tagged_kg = tag_custom_kg(custom_kg, ds_id=source_id, source_type=source_type)
        await self._rag.ainsert_custom_kg(tagged_kg, full_doc_id=full_doc_id)

    async def query_with_acl(
        self,
        query: str,
        accessible_source_ids: list[str],
        param: Any = None,
    ) -> dict[str, Any]:
        """Query and filter results by accessible sources.

        Retrieves structured data via aquery_data(), then filters to only
        include chunks/entities/relationships from accessible sources.

        Args:
            query: Natural language query.
            accessible_source_ids: Data source IDs the user can access.
            param: LightRAG QueryParam instance (controls mode, top_k, etc.).

        Returns:
            Filtered structured results dict.
        """
        results = await self._rag.aquery_data(query, param)
        return filter_query_results(results, set(accessible_source_ids))

    async def query_and_generate_with_acl(
        self,
        query: str,
        accessible_source_ids: list[str],
        param: Any = None,
    ) -> str:
        """Query with ACL filtering, then generate an LLM response.

        1. Retrieves and filters data by accessible sources.
        2. Builds context from filtered results.
        3. Generates LLM response using the filtered context only.

        Returns "No accessible data found for your query." if filtering
        removes all results.
        """
        filtered = await self.query_with_acl(query, accessible_source_ids, param)

        context = build_context_string(filtered)
        if not context.strip():
            return "No accessible data found for your query."

        system_prompt = (
            "Answer the user's question based ONLY on the following context. "
            "If the context doesn't contain enough information, say so.\n\n"
            f"{context}"
        )
        from lightrag import QueryParam

        return await self._rag.aquery(
            query,
            param=QueryParam(mode="bypass"),
            system_prompt=system_prompt,
        )

    async def incremental_update(
        self,
        changes: list[ChangeEvent],
        source_id: str,
        source_type: str,
    ) -> int:
        """Process CDC change events and update the knowledge graph.

        Handles INSERT and UPDATE events by converting row data to custom KG
        format and inserting with provenance.  DELETE and SCHEMA_CHANGE events
        are tracked but require Phase 7 (CDC Service) for full implementation.

        Args:
            changes: List of ChangeEvent objects from CDC pipeline.
            source_id: DataSourceRegistration.id.
            source_type: ConnectorType value.

        Returns:
            Number of changes successfully processed.
        """
        processed = 0
        for change in changes:
            if change.change_type in (ChangeType.INSERT, ChangeType.UPDATE):
                chunk_id = _build_chunk_id(change)
                custom_kg = _change_event_to_kg(change, chunk_id)
                await self.insert_with_provenance(
                    custom_kg, source_id=source_id, source_type=source_type,
                )
                processed += 1
        return processed

    async def delete_source_data(self, source_id: str) -> None:
        """Remove all knowledge graph data originating from a data source.

        Note: Full implementation requires direct access to LightRAG's
        underlying storage to query entities by source_id prefix.
        This will be completed in Phase 7 (CDC Service).

        Raises:
            NotImplementedError: Always, until Phase 7 storage integration.
        """
        raise NotImplementedError(
            "delete_source_data requires direct storage access. "
            "Will be implemented in Phase 7 (CDC Service)."
        )


def _build_chunk_id(change: ChangeEvent) -> str:
    """Build a unique chunk ID from a change event."""
    if change.primary_key:
        pk_str = "_".join(f"{k}={v}" for k, v in sorted(change.primary_key.items()))
        return f"{change.resource_name}__{pk_str}"
    ts = change.timestamp.strftime("%Y%m%d%H%M%S")
    return f"{change.resource_name}__{ts}"


def _change_event_to_kg(change: ChangeEvent, chunk_id: str) -> dict[str, Any]:
    """Convert a single ChangeEvent to a custom KG dict.

    Creates a chunk from the row data and an entity from the resource/row.
    Uses ``after`` for INSERT/UPDATE events.
    """
    data = change.after or {}
    row_text = ", ".join(f"{k}: {v}" for k, v in data.items())
    content = f"{change.resource_name} record: {row_text}"

    if change.primary_key:
        pk_desc = ", ".join(f"{k}={v}" for k, v in change.primary_key.items())
        entity_name = f"{change.resource_name}_{pk_desc}"
    else:
        entity_name = change.resource_name

    return {
        "chunks": [
            {
                "source_id": chunk_id,
                "content": content,
                "file_path": "cdc",
                "chunk_order_index": 0,
            },
        ],
        "entities": [
            {
                "entity_name": entity_name,
                "entity_type": change.resource_name,
                "description": content,
                "source_id": chunk_id,
                "file_path": "cdc",
            },
        ],
        "relationships": [],
    }
