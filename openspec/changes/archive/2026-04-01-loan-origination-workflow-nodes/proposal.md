## Why

The current Temporal Canvas supports basic workflow nodes (Start, Timer, SignalWait, Condition, HTTPRequest, AgentFlowCall) but lacks support for **human-in-the-loop patterns** essential for business process automation. Use cases like loan origination, approval workflows, and document processing require workflows that pause for human input, collect multiple signals, expose state for external querying, and send notifications—none of which are fully supported with the current node set.

Additionally, the **developer experience** for building workflows is limited:

-   Users cannot define input variables for workflows in the UI
-   There is no autocomplete when referencing variables in templates (typing `{{` shows nothing)
-   Running manual workflows requires API calls; there's no UI to provide input values
-   Input validation only happens at runtime with cryptic errors

## What Changes

### Human-in-the-Loop Capabilities

-   **Add Human Task Node**: A new node type that pauses workflow execution until a human completes a task, with role assignment, instructions, timeout handling, and pending tasks exposure via queries. This replaces the simpler SignalWait node.
-   **Add Collect Signals Node**: A new node type that waits for a configurable number of signals before continuing (e.g., "wait for 2 documents to be uploaded")
-   **Add Built-in Query Handler**: Auto-register a `getWorkflowState` query handler in every workflow that exposes status, pending tasks, and context—no configuration needed
-   **Add List Executions API**: A new endpoint to list all running/completed executions of a workflow definition
-   **Add Send Email Activity**: A new activity for sending email notifications with configurable SMTP provider
-   **Remove SignalWait Node**: Replaced by Human Task node which is a superset of SignalWait functionality

### Workflow Input & Variable System

-   **Add Input Variables UI**: Add ability to define input variables (name, type, required, default value) in the Start node configuration
-   **Add Context Variables Autocomplete**: When typing `{{` in any template field, show a dropdown with available variables from input and upstream nodes (following existing chatflow pattern)
-   **Add Run Workflow Dialog**: A dialog that appears when running manual workflows, generating a form based on defined input variables
-   **Add Runtime Input Validation**: Validate input values against the defined schema at workflow start, with type coercion and clear error messages

### Bug Fixes & Improvements

-   **Fix Condition Expression Evaluator**: Replace custom expression parser with `expr-eval` library to support compound conditions (`&&`, `||`), parentheses, ternary operators, math operations, and proper operator precedence
-   **Fix Module-Scope State Bug**: Move workflow state variables (`receivedSignals`, `collectedSignals`, `pendingTasks`, `workflowState`) inside the workflow function to ensure each execution has isolated state, fixing Temporal determinism violations
-   **Fix Conditional Branch Execution**: Rewrite workflow execution loop to properly follow condition branches based on evaluation result. Only execute nodes in the taken branch (true or false). Support parallel execution of non-conditional branches using `Promise.all()`, and wait for all incoming branches at join points (diamond pattern convergence).

## Capabilities

### New Capabilities

-   `human-task-nodes`: Human Task and Collect Signals nodes for human-in-the-loop workflow patterns
-   `email-notifications`: Send Email activity for workflow notification capabilities
-   `workflow-input-variables`: Input variable definition, autocomplete, run dialog, and validation

### Modified Capabilities

-   `temporal-nodes`: Remove SignalWait node (replaced by Human Task)
-   `temporal-worker`: Add execution logic for Human Task and Collect Signals nodes, add built-in query handler registration, add sendEmail activity, add input validation, fix expression evaluator to support compound conditions, fix module-scope state isolation, fix conditional branch execution with parallel support
-   `temporal-api`: Add query workflow endpoint and list executions endpoint
-   `temporal-canvas`: Add input variables to Start node config, add autocomplete to template fields, add Run Workflow dialog

## Impact

**UI Package (`packages/ui/src/views/temporalflows/`)**:

-   Remove: `SignalWaitNode.jsx`
-   New components: `HumanTaskNode.jsx`, `CollectSignalsNode.jsx`, `RunWorkflowDialog.jsx`, `TemporalSelectVariable.jsx`, `TemporalTemplateInput.jsx`
-   New utilities: `temporalNodeOutputs.js`, `temporalHelper.js`
-   Updates: `AddTemporalNodes.jsx` (remove SignalWait, add new nodes, update Start defaultData), `TemporalNodeConfigDialog.jsx` (new config forms, input variables editor, use TemporalTemplateInput), `TemporalCanvas.jsx` (register new node types, pass nodes/edges to dialog, add Run dialog)

**Worker Package (`packages/temporal-worker/src/`)**:

-   New activities: `sendEmail.ts`
-   Updates: `durableWorkflow.ts` (remove temporalSignalWait, add temporalHumanTask and temporalCollectSignals cases, add built-in query handler registration, add input validation at workflow start), `activities/index.ts` (export sendEmail)

**Server Package (`packages/server/src/`)**:

-   New endpoints: `GET /api/v1/temporal/workflows/:flowId/executions`, `GET /api/v1/temporal/executions/:workflowId/query/:queryName`
-   Updates: `services/temporal/index.ts`, `controllers/temporal/index.ts`, `routes/temporal/index.ts`

**Dependencies**:

-   Add nodemailer for SMTP email sending
-   Add expr-eval for safe JavaScript expression evaluation
