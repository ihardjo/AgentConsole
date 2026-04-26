"""ACL filtering for LightRAG query results.

Filters structured query results (from aquery_data) to only include
data from sources the querying user has access to.  Works by inspecting
the provenance-tagged source_id fields set during insertion.

See: Architecture Plan Section 4.4 -- ACL-Aware Query.
"""

from __future__ import annotations

from federated_rag.provenance import SEPARATOR


def extract_ds_id(source_id: str) -> str | None:
    """Extract the data source ID from a provenance-tagged source_id.

    Returns None if the source_id is not tagged (no separator found).
    """
    if SEPARATOR not in source_id:
        return None
    return source_id.split(SEPARATOR, 1)[0]


def filter_query_results(
    results: dict,
    accessible_source_ids: set[str],
) -> dict:
    """Filter aquery_data results to only include accessible sources.

    Args:
        results: Structured results from LightRAG.aquery_data().
        accessible_source_ids: Set of data source IDs the user can access.

    Returns:
        Filtered copy of results with only accessible data.
    """
    if results.get("status") != "success":
        return results

    data = results.get("data", {})

    filtered_chunks = [
        chunk for chunk in data.get("chunks", [])
        if _is_accessible(chunk.get("source_id", ""), accessible_source_ids)
    ]

    filtered_entities = [
        entity for entity in data.get("entities", [])
        if _is_accessible(entity.get("source_id", ""), accessible_source_ids)
    ]

    filtered_relationships = [
        rel for rel in data.get("relationships", [])
        if _is_accessible(rel.get("source_id", ""), accessible_source_ids)
    ]

    return {
        **results,
        "data": {
            **data,
            "chunks": filtered_chunks,
            "entities": filtered_entities,
            "relationships": filtered_relationships,
        },
    }


def build_context_string(filtered_results: dict) -> str:
    """Build a context string from filtered query results for LLM consumption.

    Formats entities, relationships, and chunks into a structured context
    that can be passed to an LLM as a system prompt.
    """
    data = filtered_results.get("data", {})
    sections: list[str] = []

    entities = data.get("entities", [])
    if entities:
        lines = []
        for e in entities:
            name = e.get("entity_name", "Unknown")
            etype = e.get("entity_type", "Unknown")
            desc = e.get("description", "")
            lines.append(f"- {name} ({etype}): {desc}")
        sections.append("## Entities\n" + "\n".join(lines))

    relationships = data.get("relationships", [])
    if relationships:
        lines = []
        for r in relationships:
            src = r.get("src_id", "?")
            tgt = r.get("tgt_id", "?")
            desc = r.get("description", "")
            lines.append(f"- {src} -> {tgt}: {desc}")
        sections.append("## Relationships\n" + "\n".join(lines))

    chunks = data.get("chunks", [])
    if chunks:
        lines = [c.get("content", "") for c in chunks]
        sections.append("## Source Content\n" + "\n\n".join(lines))

    return "\n\n".join(sections)


def _is_accessible(source_id: str, accessible_source_ids: set[str]) -> bool:
    """Check if a source_id belongs to an accessible data source."""
    ds_id = extract_ds_id(source_id)
    if ds_id is None:
        # Untagged data (e.g., from direct LightRAG insert) -- allow by default
        return True
    return ds_id in accessible_source_ids
