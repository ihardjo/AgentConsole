## MODIFIED Requirements

### Requirement: Canvas removes SignalWait from node drawer

The system SHALL remove SignalWait node from the available nodes list.

#### Scenario: SignalWait not in TEMPORAL_NODES array

-   **WHEN** user opens the Add Nodes drawer
-   **THEN** system does not display "Wait for Signal" node option

### Requirement: Canvas registers new node types

The system SHALL register Human Task and Collect Signals node types in the React Flow node types map.

#### Scenario: Human Task node type registered

-   **WHEN** TemporalCanvas renders
-   **THEN** system includes `temporalHumanTask: HumanTaskNode` in the nodeTypes object

#### Scenario: Collect Signals node type registered

-   **WHEN** TemporalCanvas renders
-   **THEN** system includes `temporalCollectSignals: CollectSignalsNode` in the nodeTypes object

### Requirement: Canvas provides Human Task node configuration

The system SHALL provide configuration form for Human Task nodes.

#### Scenario: Human Task config form displays

-   **WHEN** user double-clicks a Human Task node
-   **THEN** system opens config dialog with fields: label, taskName, assignedRole, instructions, signalName (optional), timeout, timeoutBehavior

#### Scenario: Human Task timeoutBehavior options

-   **WHEN** user configures Human Task timeout behavior
-   **THEN** system provides options: "continue" (default) and "fail"

### Requirement: Canvas provides Collect Signals node configuration

The system SHALL provide configuration form for Collect Signals nodes.

#### Scenario: Collect Signals config form displays

-   **WHEN** user double-clicks a Collect Signals node
-   **THEN** system opens config dialog with fields: label, signalName, requiredCount (number), timeout

### Requirement: Canvas passes nodes and edges to config dialog

The system SHALL pass current nodes and edges to the configuration dialog for autocomplete support.

#### Scenario: Dialog receives canvas state

-   **WHEN** user double-clicks any node to configure it
-   **THEN** system passes current nodes and edges arrays to TemporalNodeConfigDialog via dialogProps

### Requirement: Canvas provides Run Workflow dialog

The system SHALL provide a Run Workflow dialog for manual workflows with input variables.

#### Scenario: Run dialog opens for workflow with input variables

-   **GIVEN** workflow has manual trigger mode
-   **AND** Start node has inputVariables defined
-   **WHEN** user clicks "Run" button
-   **THEN** system displays RunWorkflowDialog

#### Scenario: Run dialog skipped when no input variables

-   **GIVEN** workflow has manual trigger mode
-   **AND** Start node has no inputVariables defined
-   **WHEN** user clicks "Run" button
-   **THEN** system starts workflow immediately without dialog

#### Scenario: Run dialog submits input

-   **GIVEN** RunWorkflowDialog is open
-   **WHEN** user fills form and clicks "Run"
-   **THEN** system starts workflow with provided input values
