## ADDED Requirements

### Requirement: Canvas displays ReactFlow workspace for Temporal workflows

The system SHALL render a ReactFlow canvas where users can visually design Temporal durable workflows by dragging nodes from a palette and connecting them with edges.

#### Scenario: User opens empty Temporal workflow canvas

-   **WHEN** user navigates to create a new Durable Workflow
-   **THEN** system displays an empty ReactFlow canvas with a node palette sidebar, toolbar, and background grid

#### Scenario: User opens existing Temporal workflow

-   **WHEN** user opens a saved Durable Workflow
-   **THEN** system loads and displays the saved nodes and edges on the canvas

### Requirement: Node palette provides drag-and-drop node creation

The system SHALL display a sidebar palette containing all available Temporal node types (Start, AgentFlowCall, Timer, SignalWait, Condition, HTTPRequest) that users can drag onto the canvas.

#### Scenario: User drags node from palette to canvas

-   **WHEN** user drags a node type from the palette and drops it on the canvas
-   **THEN** system creates a new node of that type at the drop location with default configuration

### Requirement: Nodes can be connected with edges

The system SHALL allow users to create directed edges between nodes by dragging from a source node's output anchor to a target node's input anchor.

#### Scenario: User connects two nodes

-   **WHEN** user drags from the output anchor of Node A to the input anchor of Node B
-   **THEN** system creates a directed edge from Node A to Node B

#### Scenario: User attempts invalid connection

-   **WHEN** user attempts to connect a node to itself or create a duplicate edge
-   **THEN** system prevents the connection and does not create an edge

### Requirement: Canvas supports node selection and deletion

The system SHALL allow users to select nodes by clicking and delete selected nodes via keyboard (Delete/Backspace) or context menu.

#### Scenario: User deletes a selected node

-   **WHEN** user selects a node and presses Delete key
-   **THEN** system removes the node and all connected edges from the canvas

### Requirement: Canvas toolbar provides workflow actions

The system SHALL display a toolbar with actions: Save, Run Workflow, and View in Temporal UI (external link).

#### Scenario: User saves workflow

-   **WHEN** user clicks the Save button
-   **THEN** system persists the current canvas state (nodes, edges, configurations) to the database

#### Scenario: User runs workflow

-   **WHEN** user clicks Run Workflow button
-   **THEN** system starts the workflow execution via the Temporal API and displays a success confirmation with workflow ID

#### Scenario: User clicks View in Temporal UI

-   **WHEN** user clicks View in Temporal UI button
-   **THEN** system opens the Temporal Web UI (port 8080) in a new browser tab

### Requirement: Canvas persists workflow as JSON in database

The system SHALL save the workflow definition (nodes, edges, node configurations) as JSON in the `flowData` column of the `chat_flow` table with `type: 'TEMPORAL'`.

#### Scenario: Workflow is saved to database

-   **WHEN** user saves a Temporal workflow
-   **THEN** system stores the flowData JSON with all node positions, connections, and configurations

### Requirement: Canvas loads API keys for node configuration

The system SHALL fetch API keys from the workspace when opening the canvas or node configuration dialog.

#### Scenario: Canvas fetches API keys on load

-   **WHEN** user opens the Temporal workflow canvas
-   **THEN** system fetches available API keys from the workspace alongside AgentFlows

#### Scenario: API keys are available in node configuration

-   **WHEN** user opens an AgentFlowCall node configuration dialog
-   **THEN** system displays a dropdown with workspace API keys for selection
