from __future__ import annotations

from pathlib import Path

import pytest

from federated_rag.connector_file import FileConnector
from federated_rag.models import ConnectorType


@pytest.fixture()
def sample_dir(tmp_path: Path) -> Path:
    (tmp_path / "notes.txt").write_text("Meeting notes: Q2 planning for product launch.")
    (tmp_path / "readme.md").write_text("# Project README\n\nThis is the project overview.")
    (tmp_path / "data.csv").write_text("name,age,city\nAlice,30,Jakarta\nBob,25,Singapore\n")
    (tmp_path / "ignored.png").write_bytes(b"\x89PNG")  # should be skipped
    return tmp_path


async def test_connector_type():
    c = FileConnector()
    assert c.connector_type == ConnectorType.FILE


async def test_connect_to_directory(sample_dir: Path):
    c = FileConnector()
    ok = await c.connect({"path": str(sample_dir)})
    assert ok is True
    assert await c.test_connection() is True
    await c.disconnect()


async def test_connect_nonexistent_path():
    c = FileConnector()
    ok = await c.connect({"path": "/nonexistent/path"})
    assert ok is False


async def test_connect_single_file(tmp_path: Path):
    f = tmp_path / "single.txt"
    f.write_text("Hello world")
    c = FileConnector()
    ok = await c.connect({"path": str(f)})
    assert ok is True
    resources = await c.list_resources()
    assert len(resources) == 1
    assert resources[0]["name"] == "single.txt"
    await c.disconnect()


async def test_list_resources_skips_unsupported(sample_dir: Path):
    c = FileConnector()
    await c.connect({"path": str(sample_dir)})
    resources = await c.list_resources()
    names = {r["name"] for r in resources}
    assert "notes.txt" in names
    assert "readme.md" in names
    assert "data.csv" in names
    assert "ignored.png" not in names
    await c.disconnect()


async def test_extract_schema_text_file(sample_dir: Path):
    c = FileConnector(source_id="test_file")
    await c.connect({"path": str(sample_dir)})
    schema = await c.extract_schema()

    assert schema.source_id == "test_file"
    assert schema.source_type == ConnectorType.FILE

    table_names = {t.name for t in schema.tables}
    assert "notes.txt" in table_names
    assert "data.csv" in table_names

    csv_table = next(t for t in schema.tables if t.name == "data.csv")
    col_names = [c.name for c in csv_table.columns]
    assert col_names == ["name", "age", "city"]
    assert csv_table.row_count == 2

    await c.disconnect()


async def test_extract_content_text_files(sample_dir: Path):
    c = FileConnector(source_id="test_file")
    await c.connect({"path": str(sample_dir)})

    batches = []
    async for batch in c.extract_content():
        batches.append(batch)

    assert len(batches) == 3  # csv, md, txt (sorted)

    all_chunks = [chunk for b in batches for chunk in b["chunks"]]
    assert any("Q2 planning" in ch["content"] for ch in all_chunks)
    assert any("Project README" in ch["content"] for ch in all_chunks)

    await c.disconnect()


async def test_extract_content_csv_rows(sample_dir: Path):
    c = FileConnector(source_id="test_csv")
    await c.connect({"path": str(sample_dir)})

    batches = []
    async for batch in c.extract_content(resource_filter=["data.csv"]):
        batches.append(batch)

    assert len(batches) == 1
    batch = batches[0]
    assert len(batch["chunks"]) == 2  # 2 CSV rows
    assert len(batch["entities"]) == 2

    assert any("Alice" in ch["content"] for ch in batch["chunks"])
    assert any("Bob" in ch["content"] for ch in batch["chunks"])

    await c.disconnect()


async def test_extract_content_with_resource_filter(sample_dir: Path):
    c = FileConnector(source_id="test_filter")
    await c.connect({"path": str(sample_dir)})

    batches = []
    async for batch in c.extract_content(resource_filter=["notes.txt"]):
        batches.append(batch)

    assert len(batches) == 1
    assert "Q2 planning" in batches[0]["chunks"][0]["content"]

    await c.disconnect()


async def test_disconnect_clears_state(sample_dir: Path):
    c = FileConnector()
    await c.connect({"path": str(sample_dir)})
    assert await c.test_connection() is True
    await c.disconnect()
    assert await c.test_connection() is False


async def test_provenance_tags(sample_dir: Path):
    c = FileConnector(source_id="prov_test")
    await c.connect({"path": str(sample_dir)})

    async for batch in c.extract_content(resource_filter=["notes.txt"]):
        chunk = batch["chunks"][0]
        assert chunk["source_id"].startswith("prov_test:")
        assert chunk["file_path"].startswith("prov_test/")
        entity = batch["entities"][0]
        assert entity["source_id"].startswith("prov_test:")
        break

    await c.disconnect()
