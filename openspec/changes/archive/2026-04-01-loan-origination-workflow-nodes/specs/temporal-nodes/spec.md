## MODIFIED Requirements

### Requirement: SignalWait node is removed

The system SHALL no longer provide a SignalWait node type. Human Task node replaces SignalWait with enhanced functionality.

#### Scenario: SignalWait node type is not available

-   **WHEN** user opens the node drawer to add nodes
-   **THEN** system does not display SignalWait in the available nodes list

#### Scenario: Human Task replaces SignalWait functionality

-   **WHEN** user needs to wait for an external signal
-   **THEN** user uses Human Task node with optional role and instructions fields left empty for technical signal waiting
