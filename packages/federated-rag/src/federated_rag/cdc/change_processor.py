"""Change event processor for routing CDC events to LightRAG.

Subscribes to the event bus and processes change events by:
1. Deduplicating events (same PK + same timestamp = skip)
2. Routing to the correct FederatedLightRAG instance per workspace
3. Calling incremental_update() for batched KG ingestion

See: Architecture Plan Section 3.5 -- CDC Pipeline.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime
from typing import Any

from federated_rag.cdc.change_event_bus import ChangeEventBus
from federated_rag.federated_lightrag import FederatedLightRAG
from federated_rag.models import ChangeEvent


class ChangeProcessor:
    """Routes CDC change events from the bus to FederatedLightRAG.

    Batches events per source and flushes at configurable intervals
    or when the batch reaches a size threshold.
    """

    def __init__(
        self,
        event_bus: ChangeEventBus,
        federated_rag: FederatedLightRAG,
        batch_size: int = 50,
        flush_interval_seconds: float = 5.0,
    ) -> None:
        self._bus = event_bus
        self._rag = federated_rag
        self._batch_size = batch_size
        self._flush_interval = flush_interval_seconds

        self._buffers: dict[str, list[ChangeEvent]] = defaultdict(list)
        self._seen: set[str] = set()  # dedup keys
        self._subscribed_topics: list[str] = []
        self._flush_task: asyncio.Task | None = None
        self._stats: dict[str, int] = {
            "received": 0,
            "deduplicated": 0,
            "processed": 0,
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def watch(self, workspace_id: str) -> None:
        """Subscribe to change events for a workspace."""
        self._bus.subscribe(workspace_id, self._on_event)
        self._subscribed_topics.append(workspace_id)

    def unwatch(self, workspace_id: str) -> None:
        """Unsubscribe from a workspace's events."""
        self._bus.unsubscribe(workspace_id, self._on_event)
        if workspace_id in self._subscribed_topics:
            self._subscribed_topics.remove(workspace_id)

    async def start(self) -> None:
        """Start the periodic flush loop."""
        if self._flush_task is None or self._flush_task.done():
            self._flush_task = asyncio.create_task(self._flush_loop())

    async def stop(self) -> None:
        """Flush remaining events and stop the flush loop."""
        if self._flush_task and not self._flush_task.done():
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        await self.flush_all()
        for topic in list(self._subscribed_topics):
            self.unwatch(topic)

    # ------------------------------------------------------------------
    # Event handling
    # ------------------------------------------------------------------

    async def _on_event(self, event: ChangeEvent) -> None:
        """Handle a single event from the bus."""
        self._stats["received"] += 1

        dedup_key = _dedup_key(event)
        if dedup_key in self._seen:
            self._stats["deduplicated"] += 1
            return
        self._seen.add(dedup_key)

        buffer_key = f"{event.workspace_id}:{event.source_id}"
        self._buffers[buffer_key].append(event)

        if len(self._buffers[buffer_key]) >= self._batch_size:
            await self._flush_buffer(buffer_key)

    async def flush_all(self) -> None:
        """Flush all buffered events immediately."""
        for key in list(self._buffers.keys()):
            await self._flush_buffer(key)

    async def _flush_buffer(self, buffer_key: str) -> None:
        """Flush a single source's buffer to FederatedLightRAG."""
        events = self._buffers.pop(buffer_key, [])
        if not events:
            return

        source_id = events[0].source_id
        source_type = _infer_source_type(events[0])

        processed = await self._rag.incremental_update(
            events, source_id=source_id, source_type=source_type,
        )
        self._stats["processed"] += processed

    async def _flush_loop(self) -> None:
        """Periodically flush all buffers."""
        while True:
            await asyncio.sleep(self._flush_interval)
            await self.flush_all()

    # ------------------------------------------------------------------
    # Observability
    # ------------------------------------------------------------------

    @property
    def stats(self) -> dict[str, int]:
        """Return processing statistics."""
        return dict(self._stats)

    @property
    def pending_count(self) -> int:
        """Count of events buffered but not yet flushed."""
        return sum(len(buf) for buf in self._buffers.values())

    def clear_dedup_cache(self) -> None:
        """Clear the deduplication cache (for long-running processors)."""
        self._seen.clear()


def _dedup_key(event: ChangeEvent) -> str:
    """Build a deduplication key from the event."""
    pk_str = ""
    if event.primary_key:
        pk_str = "|".join(
            f"{k}={v}" for k, v in sorted(event.primary_key.items())
        )
    return (
        f"{event.source_id}:{event.resource_name}:"
        f"{event.change_type.value}:{pk_str}:{event.timestamp.isoformat()}"
    )


def _infer_source_type(event: ChangeEvent) -> str:
    """Infer source type from the event's source_id prefix.

    Falls back to "unknown" if no connector type can be determined.
    """
    return "cdc"
