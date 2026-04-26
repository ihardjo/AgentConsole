"""Change event bus abstraction.

Provides a publish/subscribe interface for ChangeEvent propagation.
InMemoryEventBus is for development/testing; production should use
Redis Streams (RedisEventBus, Phase 7+).

See: Architecture Plan Section 3.5 -- CDC Pipeline.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import Any, Callable, Coroutine

from federated_rag.models import ChangeEvent


Subscriber = Callable[[ChangeEvent], Coroutine[Any, Any, None]]


class ChangeEventBus(ABC):
    """Abstract event bus for change event propagation."""

    @abstractmethod
    async def publish(self, topic: str, event: ChangeEvent) -> None:
        """Publish a change event to a topic (typically workspace_id)."""

    @abstractmethod
    def subscribe(self, topic: str, handler: Subscriber) -> None:
        """Register a handler for events on a topic."""

    @abstractmethod
    def unsubscribe(self, topic: str, handler: Subscriber) -> None:
        """Remove a handler from a topic."""

    @abstractmethod
    async def start(self) -> None:
        """Start consuming events (for persistent buses)."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop consuming and release resources."""


class InMemoryEventBus(ChangeEventBus):
    """In-memory event bus for development and testing.

    Events are dispatched synchronously to subscribers within the same
    process. No persistence or cross-process delivery.
    """

    def __init__(self) -> None:
        self._subscribers: dict[str, list[Subscriber]] = defaultdict(list)
        self._history: list[tuple[str, ChangeEvent]] = []
        self._running = False

    async def publish(self, topic: str, event: ChangeEvent) -> None:
        self._history.append((topic, event))
        for handler in self._subscribers.get(topic, []):
            await handler(event)

    def subscribe(self, topic: str, handler: Subscriber) -> None:
        if handler not in self._subscribers[topic]:
            self._subscribers[topic].append(handler)

    def unsubscribe(self, topic: str, handler: Subscriber) -> None:
        subs = self._subscribers.get(topic, [])
        if handler in subs:
            subs.remove(handler)

    async def start(self) -> None:
        self._running = True

    async def stop(self) -> None:
        self._running = False
        self._subscribers.clear()

    @property
    def history(self) -> list[tuple[str, ChangeEvent]]:
        """Access published event history (testing only)."""
        return list(self._history)

    def subscriber_count(self, topic: str) -> int:
        return len(self._subscribers.get(topic, []))
