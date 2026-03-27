## ADDED Requirements

### Requirement: Worker connects to Temporal server

The system SHALL provide a Temporal Worker service that connects to the Temporal server on the configured address (default: localhost:7233) and polls for tasks.

#### Scenario: Worker starts successfully

-   **WHEN** the Temporal Worker service starts
-   **THEN** system connects to Temporal server and begins polling the `agentconsole-durable-workflows` task queue

#### Scenario: Worker handles connection failure

-   **WHEN** the Temporal Worker cannot connect to the Temporal server
-   **THEN** system logs the error and retries connection with exponential backoff

### Requirement: Worker executes durableWorkflowExecutor workflow

The system SHALL implement a `durableWorkflowExecutor` workflow that fetches the flow definition from the database and executes nodes in topological order.

#### Scenario: Workflow fetches flow definition from database

-   **WHEN** a workflow execution starts with a flowId and workspaceId
-   **THEN** system queries the `chat_flow` table directly to fetch the flow definition (nodes, edges)

#### Scenario: Flow definition not found

-   **WHEN** the flowId does not exist or does not belong to the workspace
-   **THEN** system throws an error indicating the workflow was not found

#### Scenario: Workflow executes nodes in sequence

-   **WHEN** workflow processes the flow definition
-   **THEN** system executes nodes in topological order, passing outputs from one node as inputs to the next

### Requirement: Worker implements callAgentFlow activity with API key authentication

The system SHALL implement a `callAgentFlow` activity that authenticates using the API key ID stored in the node configuration.

#### Scenario: Activity looks up API key from database

-   **WHEN** the workflow executes an AgentFlowCall node with an apiKeyId
-   **THEN** system queries the `apikey` table to retrieve the actual API key string

#### Scenario: Activity calls AgentFlow with authentication

-   **WHEN** the workflow executes an AgentFlowCall node
-   **THEN** system calls `POST /api/v1/prediction/{agentFlowId}` with the question, `streaming: false`, and `Authorization: Bearer {apiKey}` header

#### Scenario: Activity handles missing API key

-   **WHEN** the AgentFlowCall node has no apiKeyId or the API key is not found in the database
-   **THEN** system logs a warning and proceeds without authentication (allows unauthenticated AgentFlows to work)

#### Scenario: Activity handles AgentFlow error

-   **WHEN** the AgentFlow API returns an error
-   **THEN** system throws an ApplicationFailure with the error details

### Requirement: Worker implements httpRequest activity

The system SHALL implement an `httpRequest` activity that makes HTTP requests to external APIs.

#### Scenario: Activity makes HTTP request

-   **WHEN** the workflow executes an HTTPRequest node
-   **THEN** system makes the configured HTTP request (GET/POST) and returns the response

### Requirement: Worker handles timer nodes with Temporal sleep

The system SHALL use Temporal's `sleep()` function to implement timer nodes, ensuring durability across worker restarts.

#### Scenario: Timer survives worker restart

-   **WHEN** a workflow is waiting on a timer and the worker restarts
-   **THEN** system resumes the timer from where it left off without losing progress

### Requirement: Worker handles signal nodes with Temporal signals

The system SHALL use Temporal's signal handlers and `condition()` to implement SignalWait nodes.

#### Scenario: Signal is received

-   **WHEN** an external signal is sent to a waiting workflow
-   **THEN** system resumes the workflow with the signal payload

#### Scenario: Signal times out

-   **WHEN** a SignalWait node has a timeout configured and no signal is received
-   **THEN** system resumes the workflow after the timeout with a timeout indicator

### Requirement: Worker evaluates condition expressions

The system SHALL evaluate Condition node expressions using the workflow context (previous node outputs, input variables).

#### Scenario: Condition evaluates to true

-   **WHEN** a Condition node expression evaluates to true
-   **THEN** system follows the "True" branch

#### Scenario: Condition evaluates to false

-   **WHEN** a Condition node expression evaluates to false
-   **THEN** system follows the "False" branch
