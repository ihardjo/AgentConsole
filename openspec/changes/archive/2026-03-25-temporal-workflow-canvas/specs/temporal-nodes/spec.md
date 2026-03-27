## ADDED Requirements

### Requirement: Start node defines workflow entry point

The system SHALL provide a Start node type that defines the workflow entry point and accepts input variables.

#### Scenario: Start node is placed on canvas

-   **WHEN** user drags a Start node onto the canvas
-   **THEN** system displays a Start node with an output anchor and a configuration panel for defining input variables

#### Scenario: Start node configuration

-   **WHEN** user configures the Start node with input variable names
-   **THEN** system stores the variable names and makes them available for templating in downstream nodes

### Requirement: AgentFlowCall node executes existing AgentFlow

The system SHALL provide an AgentFlowCall node type that calls an existing AgentFlow via the Flowise Prediction API with `streaming: false`, using a workspace API key for authentication.

#### Scenario: AgentFlowCall node displays workspace-scoped dropdown

-   **WHEN** user opens the AgentFlowCall node configuration panel
-   **THEN** system displays a dropdown populated with AgentFlows from the current workspace only

#### Scenario: AgentFlowCall node displays workspace-scoped API key dropdown

-   **WHEN** user opens the AgentFlowCall node configuration panel
-   **THEN** system displays a dropdown populated with API keys from the current workspace

#### Scenario: AgentFlowCall node requires API key selection

-   **WHEN** user configures an AgentFlowCall node without selecting an API key
-   **THEN** system indicates the API key is required via visual indicator on the node

#### Scenario: AgentFlowCall node configuration

-   **WHEN** user selects an AgentFlow, API key, and enters a question template
-   **THEN** system stores the AgentFlow ID, API key ID, and question template with support for `{{variable}}` placeholders

#### Scenario: AgentFlowCall node displays configuration status

-   **WHEN** AgentFlowCall node is rendered on canvas
-   **THEN** system displays the selected AgentFlow name and indicates whether an API key is configured

### Requirement: Timer node waits for specified duration

The system SHALL provide a Timer node type that pauses workflow execution for a specified duration.

#### Scenario: Timer node configuration

-   **WHEN** user configures a Timer node with duration (e.g., "5m", "1h", "1d")
-   **THEN** system stores the duration value for use during workflow execution

#### Scenario: Timer node displays duration

-   **WHEN** Timer node is rendered on canvas
-   **THEN** system displays the configured duration on the node

### Requirement: SignalWait node pauses for external signal

The system SHALL provide a SignalWait node type that pauses workflow execution until an external signal is received.

#### Scenario: SignalWait node configuration

-   **WHEN** user configures a SignalWait node with signal name and optional timeout
-   **THEN** system stores the signal name and timeout value

#### Scenario: SignalWait node displays signal name

-   **WHEN** SignalWait node is rendered on canvas
-   **THEN** system displays the configured signal name on the node

### Requirement: Condition node branches workflow based on expression

The system SHALL provide a Condition node type that evaluates an expression and routes execution to different branches.

#### Scenario: Condition node configuration

-   **WHEN** user configures a Condition node with an expression (e.g., `{{result.success}} == true`)
-   **THEN** system stores the expression for evaluation during workflow execution

#### Scenario: Condition node has two output anchors

-   **WHEN** Condition node is rendered on canvas
-   **THEN** system displays the node with two output anchors labeled "True" and "False"

### Requirement: HTTPRequest node calls external API

The system SHALL provide an HTTPRequest node type that makes HTTP requests to external APIs.

#### Scenario: HTTPRequest node configuration

-   **WHEN** user configures an HTTPRequest node with URL, method (GET/POST), and optional body
-   **THEN** system stores the HTTP configuration for execution

#### Scenario: HTTPRequest node displays URL

-   **WHEN** HTTPRequest node is rendered on canvas
-   **THEN** system displays the configured URL on the node

### Requirement: Nodes display visual status during execution

The system SHALL display visual indicators on nodes when viewing a running or completed workflow execution.

#### Scenario: Node shows completed status

-   **WHEN** user views a workflow where a node has completed execution
-   **THEN** system displays a green checkmark or "completed" indicator on that node

#### Scenario: Node shows error status

-   **WHEN** user views a workflow where a node has failed
-   **THEN** system displays a red error indicator on that node
