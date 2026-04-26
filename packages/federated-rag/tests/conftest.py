from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest


@pytest.fixture()
def tmp_dir(tmp_path: Path) -> Path:
    return tmp_path


def pytest_configure(config):
    config.addinivalue_line("markers", "pg: requires running PostgreSQL (docker-compose)")


@pytest.fixture()
async def pg_config() -> dict[str, Any]:
    """Connection config matching docker-compose.yml in examples/lightrag_pg_poc/."""
    return {
        "host": "localhost",
        "port": 5440,
        "user": "rag",
        "password": "rag",
        "database": "lightrag_demo",
    }
