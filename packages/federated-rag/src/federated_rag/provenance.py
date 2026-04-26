"""Provenance tagging utilities for federated data sources.

Encodes data source identity into LightRAG's custom KG fields (source_id,
file_path) so that query-time ACL filtering can determine which data source
each retrieved entity/chunk originated from.

Encoding scheme:
  - source_id: "{ds_id}::{original_chunk_id}"
  - file_path: "{connector_type}://{ds_id}"

See: Architecture Plan Section 3.4 -- Provenance Tracking.
"""

from __future__ import annotations

import copy

SEPARATOR = "::"


def encode_source_id(ds_id: str, chunk_id: str) -> str:
    """Encode data source ID and chunk ID into a tagged source_id."""
    return f"{ds_id}{SEPARATOR}{chunk_id}"


def decode_source_id(tagged_id: str) -> tuple[str, str]:
    """Decode a tagged source_id into (ds_id, chunk_id).

    Raises ValueError if the tagged_id doesn't contain the separator.
    """
    if SEPARATOR not in tagged_id:
        raise ValueError(f"Not a tagged source_id: {tagged_id}")
    return tagged_id.split(SEPARATOR, 1)


def make_file_path(source_type: str, ds_id: str) -> str:
    """Create a file_path string encoding source type and ID."""
    return f"{source_type}://{ds_id}"


def parse_file_path(file_path: str) -> tuple[str, str]:
    """Parse a provenance file_path into (source_type, ds_id).

    Raises ValueError if the file_path doesn't match the expected format.
    """
    if "://" not in file_path:
        raise ValueError(f"Not a provenance file_path: {file_path}")
    return file_path.split("://", 1)


def tag_custom_kg(
    custom_kg: dict,
    ds_id: str,
    source_type: str,
) -> dict:
    """Tag a custom KG dict with provenance metadata.

    Returns a deep copy with source_id and file_path fields updated.
    The original dict is not modified.
    """
    tagged = copy.deepcopy(custom_kg)
    provenance_path = make_file_path(source_type, ds_id)

    for chunk in tagged.get("chunks", []):
        chunk["source_id"] = encode_source_id(ds_id, chunk["source_id"])
        chunk["file_path"] = provenance_path

    for entity in tagged.get("entities", []):
        entity["source_id"] = encode_source_id(ds_id, entity["source_id"])
        entity["file_path"] = provenance_path

    for rel in tagged.get("relationships", []):
        rel["source_id"] = encode_source_id(ds_id, rel["source_id"])
        rel["file_path"] = provenance_path

    return tagged
