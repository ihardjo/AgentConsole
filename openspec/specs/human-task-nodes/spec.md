## ADDED Requirements

### Requirement: Human Task node pauses workflow for human input

The system SHALL provide a Human Task node that pauses workflow execution until a human sends a completion signal, with configurable role assignment, instructions, and timeout.

#### Scenario: Human Task node is placed on canvas

-   **WHEN** user drags a Human Task node onto the canvas
-   **THEN** system displays a node with configuration for task name, assigned role, instructions, timeout, and timeout behavior

#### Scenario: Human Task waits for completion signal

-   **WHEN** workflow execution reaches a Human Task node
-   **THEN** system pauses execution and waits for a signal matching the task's signal name
-   **AND** system registers the task in the pending tasks collection for query access

#### Scenario: Human Task receives completion signal

-   **WHEN** a completion signal is sent with payload to a waiting Human Task
-   **THEN** system stores the payload in workflow context as the node output
-   **AND** system removes the task from pending tasks
-   **AND** workflow continues to the next node

#### Scenario: Human Task times out with continue behavior

-   **WHEN** Human Task timeout expires and timeoutBehavior is 'continue'
-   **THEN** system continues workflow with `{ timedOut: true, taskName }` as the node output
-   **AND** system removes the task from pending tasks

#### Scenario: Human Task times out with fail behavior

-   **WHEN** Human Task timeout expires and timeoutBehavior is 'fail'
-   **THEN** system fails the workflow with a timeout error message

#### Scenario: Human Task without timeout waits indefinitely

-   **WHEN** Human Task has no timeout configured
-   **THEN** system waits indefinitely until a completion signal is received

### Requirement: Collect Signals node waits for multiple signals

The system SHALL provide a Collect Signals node that waits for a configurable number of signals before continuing.

#### Scenario: Collect Signals node is placed on canvas

-   **WHEN** user drags a Collect Signals node onto the canvas
-   **THEN** system displays a node with configuration for signal name, required count, and timeout

#### Scenario: Collect Signals accumulates signals

-   **WHEN** workflow execution reaches a Collect Signals node
-   **THEN** system waits and collects each signal payload into an array
-   **AND** system continues when the required count is reached

#### Scenario: Collect Signals returns all payloads

-   **WHEN** the required number of signals is received
-   **THEN** system returns all collected payloads as an array with `{ complete: true }` in the node output

#### Scenario: Collect Signals times out with partial collection

-   **WHEN** Collect Signals timeout expires before required count is reached
-   **THEN** system continues with partial collection and `{ complete: false }` flag
-   **AND** system includes the count of signals received vs required in the output

#### Scenario: Each signal payload is timestamped

-   **WHEN** a signal is received by Collect Signals node
-   **THEN** system stores the payload with a `receivedAt` timestamp
