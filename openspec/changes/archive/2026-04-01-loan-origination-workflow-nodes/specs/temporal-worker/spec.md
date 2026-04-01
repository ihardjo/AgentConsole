## MODIFIED Requirements

### Requirement: Worker executes Human Task nodes

The system SHALL implement Human Task node execution with signal waiting, pending task tracking, and timeout handling.

#### Scenario: Human Task registers pending task for queries

-   **WHEN** workflow execution reaches a Human Task node
-   **THEN** system registers the task in a pending tasks map with taskId, taskName, role, instructions, signalName, and waitingSince timestamp

#### Scenario: Human Task removes pending task on completion

-   **WHEN** Human Task receives completion signal or times out
-   **THEN** system removes the task from pending tasks map

#### Scenario: Human Task sets up signal handler

-   **WHEN** workflow execution reaches a Human Task node
-   **THEN** system registers a signal handler for the task's signalName (auto-generated as `task_${nodeId}` if not provided)

### Requirement: Worker executes Collect Signals nodes

The system SHALL implement Collect Signals node execution that accumulates multiple signals before continuing.

#### Scenario: Collect Signals sets up accumulating signal handler

-   **WHEN** workflow execution reaches a Collect Signals node
-   **THEN** system registers a signal handler that pushes each received payload to a collection array with timestamp

#### Scenario: Collect Signals waits for required count

-   **WHEN** Collect Signals is waiting
-   **THEN** system uses Temporal condition to wait until `collected.length >= requiredCount` or timeout

#### Scenario: Collect Signals returns collection result

-   **WHEN** Collect Signals completes (count reached or timeout)
-   **THEN** system returns `{ signalName, collected, count, requiredCount, complete }` where complete indicates if required count was reached

### Requirement: Worker auto-registers getWorkflowState query handler

The system SHALL automatically register a `getWorkflowState` query handler for every workflow execution.

#### Scenario: Query handler registered at workflow start

-   **WHEN** workflow execution starts
-   **THEN** system registers a `getWorkflowState` query handler automatically (no configuration needed)

#### Scenario: Query handler returns workflow state

-   **WHEN** `getWorkflowState` query is invoked
-   **THEN** system returns `{ status, currentNodeId, pendingTasks, context }` where context is sanitized to exclude internal fields

#### Scenario: Pending tasks included in query response

-   **WHEN** workflow has Human Task nodes waiting for completion
-   **THEN** query handler returns array of pending tasks with taskId, taskName, role, instructions, signalName, waitingSince

### Requirement: Worker implements sendEmail activity

The system SHALL implement a `sendEmail` activity using nodemailer with SMTP configuration from environment variables.

#### Scenario: sendEmail reads SMTP config from environment

-   **WHEN** sendEmail activity is invoked
-   **THEN** system reads SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE from environment variables

#### Scenario: sendEmail returns messageId on success

-   **WHEN** email is sent successfully
-   **THEN** system returns `{ success: true, messageId }` from the activity

#### Scenario: sendEmail throws non-retryable on auth failure

-   **WHEN** SMTP authentication fails
-   **THEN** system throws ApplicationFailure.nonRetryable with auth error message

#### Scenario: sendEmail throws retryable on connection error

-   **WHEN** SMTP connection fails (timeout, refused)
-   **THEN** system throws ApplicationFailure.retryable for automatic retry

### Requirement: Worker removes temporalSignalWait handling

The system SHALL no longer handle the `temporalSignalWait` node type in the workflow executor.

#### Scenario: temporalSignalWait case removed from executeNode

-   **WHEN** workflow contains a node with type `temporalSignalWait`
-   **THEN** system treats it as an unknown node type (logs warning, returns skipped)

### Requirement: Expression evaluator supports compound conditions

The system SHALL use expr-eval library to evaluate condition expressions with proper support for logical operators and JavaScript-like syntax.

#### Scenario: Compound AND condition evaluates correctly

-   **GIVEN** a condition expression `{{input.loanAmount}} < 10000 && {{input.creditScore}} > 700`
-   **AND** context has `input.loanAmount = 5000` and `input.creditScore = 750`
-   **WHEN** expression is evaluated
-   **THEN** system returns `true`

#### Scenario: Compound OR condition evaluates correctly

-   **GIVEN** a condition expression `{{input.amount}} > 1000 || {{input.priority}} == "high"`
-   **AND** context has `input.amount = 500` and `input.priority = "high"`
-   **WHEN** expression is evaluated
-   **THEN** system returns `true`

#### Scenario: Parentheses affect evaluation order

-   **GIVEN** a condition expression `({{input.a}} + {{input.b}}) > 10`
-   **AND** context has `input.a = 6` and `input.b = 6`
-   **WHEN** expression is evaluated
-   **THEN** system returns `true` (12 > 10)

#### Scenario: Custom functions remain available

-   **GIVEN** a condition expression `contains({{node.text}}, "approved")`
-   **AND** context has `node.text = "Application approved"`
-   **WHEN** expression is evaluated
-   **THEN** system returns `true`

#### Scenario: String helper functions work correctly

-   **GIVEN** a condition expression `lower({{input.status}}) == "approved"`
-   **AND** context has `input.status = "APPROVED"`
-   **WHEN** expression is evaluated
-   **THEN** system returns `true`

#### Scenario: Length function works for arrays and strings

-   **GIVEN** a condition expression `length({{input.items}}) > 0`
-   **AND** context has `input.items = ["a", "b", "c"]`
-   **WHEN** expression is evaluated
-   **THEN** system returns `true`

#### Scenario: Template variables are transformed for evaluation

-   **GIVEN** a condition expression with `{{input.value}}` syntax
-   **WHEN** expression is evaluated
-   **THEN** system transforms `{{input.value}}` to `input.value` before passing to expr-eval

### Requirement: Workflow state is isolated per execution

The system SHALL declare workflow state variables inside the workflow function to ensure each execution has isolated state.

#### Scenario: State variables declared inside workflow function

-   **WHEN** `durableWorkflowExecutor` function is called
-   **THEN** system declares `receivedSignals`, `collectedSignals`, `pendingTasks`, and `workflowState` inside the function scope

#### Scenario: Concurrent executions have isolated state

-   **GIVEN** two workflow executions running concurrently
-   **WHEN** one execution receives a signal
-   **THEN** the other execution's state is not affected

#### Scenario: Query returns correct state for specific execution

-   **GIVEN** two workflow executions with different pending tasks
-   **WHEN** `getWorkflowState` query is invoked on each execution
-   **THEN** each query returns the correct pending tasks for that specific execution

#### Scenario: Workflow replay maintains correct state

-   **GIVEN** a workflow execution that was interrupted
-   **WHEN** Temporal replays the workflow (e.g., after worker restart)
-   **THEN** system reconstructs correct state without interference from other executions

### Requirement: Workflow respects conditional branches

The system SHALL execute only the branch corresponding to the condition evaluation result, not both branches.

#### Scenario: Condition evaluates true executes only true branch

-   **GIVEN** a workflow with a condition node connected to true and false branch nodes
-   **AND** the condition expression evaluates to `true`
-   **WHEN** workflow executes the condition node
-   **THEN** system executes only nodes connected via the true branch (sourceHandle contains 'true')
-   **AND** system does NOT execute nodes connected via the false branch

#### Scenario: Condition evaluates false executes only false branch

-   **GIVEN** a workflow with a condition node connected to true and false branch nodes
-   **AND** the condition expression evaluates to `false`
-   **WHEN** workflow executes the condition node
-   **THEN** system executes only nodes connected via the false branch (sourceHandle contains 'false')
-   **AND** system does NOT execute nodes connected via the true branch

#### Scenario: Nested conditions follow correct path

-   **GIVEN** a workflow with a condition node whose true branch contains another condition node
-   **AND** the outer condition evaluates to `false`
-   **WHEN** workflow executes
-   **THEN** system does NOT execute the inner condition node or any of its branches

### Requirement: Workflow supports parallel branch execution

The system SHALL execute non-conditional parallel branches concurrently using Promise.all().

#### Scenario: Non-condition node with multiple outputs executes in parallel

-   **GIVEN** a workflow where a non-condition node connects to multiple downstream nodes
-   **WHEN** workflow executes that node
-   **THEN** system executes all downstream nodes in parallel using Promise.all()

#### Scenario: Parallel branch failure fails entire workflow

-   **GIVEN** a workflow with parallel branches
-   **WHEN** one parallel branch throws an error
-   **THEN** Promise.all() rejects immediately and workflow fails with the error

### Requirement: Workflow waits at join points

The system SHALL wait for all incoming branches to complete before executing a join node (diamond pattern).

#### Scenario: Join node waits for all dependencies

-   **GIVEN** a workflow where multiple branches converge to a single join node
-   **WHEN** workflow executes the branches
-   **THEN** system waits for ALL incoming branches to complete before executing the join node

#### Scenario: Skipped branches do not block join nodes

-   **GIVEN** a workflow where a condition node's branches converge to a join node
-   **AND** only one branch is executed (due to condition result)
-   **WHEN** workflow reaches the join point
-   **THEN** system considers skipped branch dependencies as satisfied and executes the join node
