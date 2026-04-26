from __future__ import annotations

import inspect
from abc import ABC

import pytest

from federated_rag.connector_base import BaseConnector
from federated_rag.models import ConnectorType


def test_base_connector_is_abstract():
    assert issubclass(BaseConnector, ABC)


def test_base_connector_cannot_be_instantiated():
    with pytest.raises(TypeError):
        BaseConnector()


def test_base_connector_has_required_abstract_methods():
    abstract_methods = set()
    for name, method in inspect.getmembers(BaseConnector):
        if getattr(method, "__isabstractmethod__", False):
            abstract_methods.add(name)

    expected = {
        "connect",
        "disconnect",
        "test_connection",
        "extract_schema",
        "extract_content",
        "list_resources",
    }
    assert expected.issubset(abstract_methods)


def test_partial_subclass_cannot_be_instantiated():
    class PartialConnector(BaseConnector):
        connector_type = ConnectorType.POSTGRESQL

        async def connect(self, config):
            return True

    with pytest.raises(TypeError):
        PartialConnector()
