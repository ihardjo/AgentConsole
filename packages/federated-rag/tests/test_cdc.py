"""Tests for CDC infrastructure (event bus + change processor)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from federated_rag.cdc.change_event_bus import InMemoryEventBus
from federated_rag.cdc.change_processor import ChangeProcessor, _dedup_key
from federated_rag.models import ChangeEvent, ChangeType


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------


def _event(
    change_type=ChangeType.INSERT,
    source_id="ds_hr",
    workspace_id="ws_001",
    resource_name="employees",
    pk=None,
    after=None,
    timestamp=None,
):
    return ChangeEvent(
        change_type=change_type,
        source_id=source_id,
        workspace_id=workspace_id,
        resource_name=resource_name,
        timestamp=timestamp or datetime.now(tz=timezone.utc),
        primary_key=pk or {"id": 1},
        after=after or {"name": "Alice"},
    )


def _mock_rag():
    rag = MagicMock()
    rag.ainsert_custom_kg = AsyncMock()
    rag.aquery_data = AsyncMock()
    rag.aquery = AsyncMock()
    # incremental_update is a real coroutine on FederatedLightRAG,
    # but since we're using a mock, we need to set it up
    rag.incremental_update = AsyncMock(return_value=1)
    return rag


# -----------------------------------------------------------------------
# InMemoryEventBus tests
# -----------------------------------------------------------------------


class TestInMemoryEventBus:

    async def test_publish_delivers_to_subscriber(self):
        bus = InMemoryEventBus()
        received = []

        async def handler(event):
            received.append(event)

        bus.subscribe("ws_001", handler)
        event = _event()
        await bus.publish("ws_001", event)

        assert len(received) == 1
        assert received[0] is event

    async def test_publish_to_different_topic_not_delivered(self):
        bus = InMemoryEventBus()
        received = []

        async def handler(event):
            received.append(event)

        bus.subscribe("ws_001", handler)
        await bus.publish("ws_002", _event(workspace_id="ws_002"))

        assert len(received) == 0

    async def test_multiple_subscribers(self):
        bus = InMemoryEventBus()
        results_a = []
        results_b = []

        async def handler_a(event):
            results_a.append(event)

        async def handler_b(event):
            results_b.append(event)

        bus.subscribe("ws_001", handler_a)
        bus.subscribe("ws_001", handler_b)
        await bus.publish("ws_001", _event())

        assert len(results_a) == 1
        assert len(results_b) == 1

    async def test_unsubscribe(self):
        bus = InMemoryEventBus()
        received = []

        async def handler(event):
            received.append(event)

        bus.subscribe("ws_001", handler)
        bus.unsubscribe("ws_001", handler)
        await bus.publish("ws_001", _event())

        assert len(received) == 0

    async def test_history(self):
        bus = InMemoryEventBus()
        e1 = _event(workspace_id="ws_001")
        e2 = _event(workspace_id="ws_002")
        await bus.publish("ws_001", e1)
        await bus.publish("ws_002", e2)

        assert len(bus.history) == 2
        assert bus.history[0] == ("ws_001", e1)
        assert bus.history[1] == ("ws_002", e2)

    async def test_subscriber_count(self):
        bus = InMemoryEventBus()

        async def h1(e):
            pass

        async def h2(e):
            pass

        assert bus.subscriber_count("ws_001") == 0
        bus.subscribe("ws_001", h1)
        assert bus.subscriber_count("ws_001") == 1
        bus.subscribe("ws_001", h2)
        assert bus.subscriber_count("ws_001") == 2

    async def test_no_duplicate_subscribe(self):
        bus = InMemoryEventBus()

        async def handler(e):
            pass

        bus.subscribe("ws_001", handler)
        bus.subscribe("ws_001", handler)  # duplicate
        assert bus.subscriber_count("ws_001") == 1

    async def test_stop_clears_subscribers(self):
        bus = InMemoryEventBus()

        async def handler(e):
            pass

        bus.subscribe("ws_001", handler)
        await bus.stop()
        assert bus.subscriber_count("ws_001") == 0


# -----------------------------------------------------------------------
# ChangeProcessor tests
# -----------------------------------------------------------------------


class TestChangeProcessor:

    async def test_processes_events(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        proc = ChangeProcessor(bus, mock_rag, batch_size=10)
        proc.watch("ws_001")

        await bus.publish("ws_001", _event())
        await proc.flush_all()

        mock_rag.incremental_update.assert_awaited_once()
        assert proc.stats["processed"] == 1

    async def test_deduplicates_identical_events(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        proc = ChangeProcessor(bus, mock_rag, batch_size=10)
        proc.watch("ws_001")

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        event = _event(timestamp=ts)

        await bus.publish("ws_001", event)
        await bus.publish("ws_001", event)  # duplicate
        await proc.flush_all()

        assert proc.stats["received"] == 2
        assert proc.stats["deduplicated"] == 1

    async def test_different_pks_not_deduped(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        mock_rag.incremental_update = AsyncMock(return_value=2)
        proc = ChangeProcessor(bus, mock_rag, batch_size=10)
        proc.watch("ws_001")

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        await bus.publish("ws_001", _event(pk={"id": 1}, timestamp=ts))
        await bus.publish("ws_001", _event(pk={"id": 2}, timestamp=ts))
        await proc.flush_all()

        assert proc.stats["received"] == 2
        assert proc.stats["deduplicated"] == 0

    async def test_auto_flush_at_batch_size(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        mock_rag.incremental_update = AsyncMock(return_value=3)
        proc = ChangeProcessor(bus, mock_rag, batch_size=3)
        proc.watch("ws_001")

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        for i in range(3):
            await bus.publish(
                "ws_001",
                _event(pk={"id": i}, timestamp=ts),
            )

        # Should have auto-flushed at batch_size=3
        mock_rag.incremental_update.assert_awaited_once()

    async def test_pending_count(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        proc = ChangeProcessor(bus, mock_rag, batch_size=100)
        proc.watch("ws_001")

        assert proc.pending_count == 0

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        await bus.publish("ws_001", _event(pk={"id": 1}, timestamp=ts))
        await bus.publish("ws_001", _event(pk={"id": 2}, timestamp=ts))

        assert proc.pending_count == 2

        await proc.flush_all()
        assert proc.pending_count == 0

    async def test_unwatch_stops_receiving(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        proc = ChangeProcessor(bus, mock_rag, batch_size=10)
        proc.watch("ws_001")
        proc.unwatch("ws_001")

        await bus.publish("ws_001", _event())
        await proc.flush_all()

        mock_rag.incremental_update.assert_not_awaited()

    async def test_multiple_workspaces(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        mock_rag.incremental_update = AsyncMock(return_value=1)
        proc = ChangeProcessor(bus, mock_rag, batch_size=10)
        proc.watch("ws_001")
        proc.watch("ws_002")

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        await bus.publish("ws_001", _event(
            workspace_id="ws_001", source_id="ds_hr_1", pk={"id": 1}, timestamp=ts,
        ))
        await bus.publish("ws_002", _event(
            workspace_id="ws_002", source_id="ds_hr_2", pk={"id": 2}, timestamp=ts,
        ))
        await proc.flush_all()

        assert mock_rag.incremental_update.await_count == 2

    async def test_clear_dedup_cache(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        proc = ChangeProcessor(bus, mock_rag, batch_size=10)
        proc.watch("ws_001")

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        event = _event(timestamp=ts)

        await bus.publish("ws_001", event)
        await proc.flush_all()

        # Same event would be deduped
        await bus.publish("ws_001", event)
        assert proc.stats["deduplicated"] == 1

        # After clearing cache, it's processed again
        proc.clear_dedup_cache()
        await bus.publish("ws_001", event)
        await proc.flush_all()
        assert proc.stats["deduplicated"] == 1  # not incremented

    async def test_stop_flushes_and_unwatches(self):
        bus = InMemoryEventBus()
        mock_rag = _mock_rag()
        proc = ChangeProcessor(bus, mock_rag, batch_size=100)
        proc.watch("ws_001")

        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        await bus.publish("ws_001", _event(timestamp=ts))

        await proc.stop()

        # Should have flushed
        mock_rag.incremental_update.assert_awaited_once()
        # Should have unwatched
        assert bus.subscriber_count("ws_001") == 0


# -----------------------------------------------------------------------
# Dedup key tests
# -----------------------------------------------------------------------


class TestDedupKey:

    def test_same_event_same_key(self):
        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        e1 = _event(pk={"id": 1}, timestamp=ts)
        e2 = _event(pk={"id": 1}, timestamp=ts)
        assert _dedup_key(e1) == _dedup_key(e2)

    def test_different_pk_different_key(self):
        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        e1 = _event(pk={"id": 1}, timestamp=ts)
        e2 = _event(pk={"id": 2}, timestamp=ts)
        assert _dedup_key(e1) != _dedup_key(e2)

    def test_different_timestamp_different_key(self):
        e1 = _event(timestamp=datetime(2026, 4, 26, tzinfo=timezone.utc))
        e2 = _event(timestamp=datetime(2026, 4, 27, tzinfo=timezone.utc))
        assert _dedup_key(e1) != _dedup_key(e2)

    def test_different_change_type_different_key(self):
        ts = datetime(2026, 4, 26, tzinfo=timezone.utc)
        e1 = _event(change_type=ChangeType.INSERT, timestamp=ts)
        e2 = _event(change_type=ChangeType.UPDATE, timestamp=ts)
        assert _dedup_key(e1) != _dedup_key(e2)
