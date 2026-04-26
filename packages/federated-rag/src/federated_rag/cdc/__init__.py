"""Change Data Capture (CDC) infrastructure.

Provides an event bus for change propagation and processors that route
change events to the appropriate workspace's FederatedLightRAG instance
for incremental knowledge graph updates.
"""

from federated_rag.cdc.change_event_bus import ChangeEventBus, InMemoryEventBus
from federated_rag.cdc.change_processor import ChangeProcessor

__all__ = [
    "ChangeEventBus",
    "ChangeProcessor",
    "InMemoryEventBus",
]
