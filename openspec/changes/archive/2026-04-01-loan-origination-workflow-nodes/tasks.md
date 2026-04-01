## 1. UI — Remove SignalWait Node

-   [x] 1.1 Delete `SignalWaitNode.jsx` from `packages/ui/src/views/temporalflows/nodes/`
-   [x] 1.2 Remove `temporalSignalWait` entry from `TEMPORAL_NODES` array in `AddTemporalNodes.jsx`
-   [x] 1.3 Remove `temporalSignalWait` from nodeTypes object in `TemporalCanvas.jsx`
-   [x] 1.4 Remove SignalWait config case from `TemporalNodeConfigDialog.jsx`

## 2. UI — Human Task Node

-   [x] 2.1 Create `HumanTaskNode.jsx` in `packages/ui/src/views/temporalflows/nodes/` with IconUserCheck icon, purple color (#9C27B0), displays task name, role, and timeout
-   [x] 2.2 Add `temporalHumanTask` entry to `TEMPORAL_NODES` array in `AddTemporalNodes.jsx` with defaultData for taskName, assignedRole, instructions, timeout, timeoutBehavior
-   [x] 2.3 Register `temporalHumanTask: HumanTaskNode` in nodeTypes object in `TemporalCanvas.jsx`
-   [x] 2.4 Add Human Task config form in `TemporalNodeConfigDialog.jsx` with fields: label, taskName, assignedRole, instructions, signalName (optional), timeout, timeoutBehavior (select: fail/continue)

## 3. UI — Collect Signals Node

-   [x] 3.1 Create `CollectSignalsNode.jsx` in `packages/ui/src/views/temporalflows/nodes/` with IconInbox icon, blue color (#2196F3), displays signal name and required count
-   [x] 3.2 Add `temporalCollectSignals` entry to `TEMPORAL_NODES` array in `AddTemporalNodes.jsx` with defaultData for signalName, requiredCount (default: 2), timeout
-   [x] 3.3 Register `temporalCollectSignals: CollectSignalsNode` in nodeTypes object in `TemporalCanvas.jsx`
-   [x] 3.4 Add Collect Signals config form in `TemporalNodeConfigDialog.jsx` with fields: label, signalName, requiredCount (number input), timeout

## 4. Worker — Remove SignalWait Handling

-   [x] 4.1 Remove `temporalSignalWait` and `signalWait` cases from `executeNode()` function in `durableWorkflow.ts`

## 5. Worker — Human Task Execution

-   [x] 5.1 Add `pendingTasks` Map at workflow scope in `durableWorkflow.ts` to track waiting Human Tasks
-   [x] 5.2 Add `temporalHumanTask` case to `executeNode()` that registers pending task, sets up signal handler, waits with condition(), and handles timeout behavior
-   [x] 5.3 Ensure pending task is removed from map on signal receipt or timeout

## 6. Worker — Collect Signals Execution

-   [x] 6.1 Add `temporalCollectSignals` case to `executeNode()` that sets up accumulating signal handler and waits for required count
-   [x] 6.2 Return collected payloads array with timestamps and complete flag

## 7. Worker — Built-in Query Handler

-   [x] 7.1 Register `getWorkflowState` query handler at workflow start (auto-registered, no configuration needed)
-   [x] 7.2 Implement query handler that returns `{ status, currentStep, pendingTasks, context }` object
-   [x] 7.3 Update pendingTasks and currentStep as workflow progresses

## 8. Worker — Send Email Activity

-   [x] 8.1 Add `nodemailer` dependency to `packages/temporal-worker/package.json`
-   [x] 8.2 Create `sendEmail.ts` activity file in `packages/temporal-worker/src/activities/`
-   [x] 8.3 Implement SMTP configuration from environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE)
-   [x] 8.4 Implement non-retryable error handling for auth failures, retryable for connection errors
-   [x] 8.5 Export `sendEmail` from `activities/index.ts`
-   [x] 8.6 Add `sendEmail` to proxyActivities in `durableWorkflow.ts`

## 9. Server — List Executions API

-   [x] 9.1 Add `listWorkflowExecutions` function to `services/temporal/index.ts` using Temporal client visibility API with query filter for workflowType
-   [x] 9.2 Add `listExecutions` controller function in `controllers/temporal/index.ts` with pagination support (limit, nextPageToken)
-   [x] 9.3 Add route `GET /workflows/:flowId/executions` to `routes/temporal/index.ts`
-   [x] 9.4 Return response format: `{ executions: [{ workflowId, runId, status, startTime }], nextPageToken }`

## 10. Server — Query Workflow Execution API

-   [x] 10.1 Add `queryWorkflowExecution` function to `services/temporal/index.ts` using Temporal client `handle.query()`
-   [x] 10.2 Add `queryExecution` controller function in `controllers/temporal/index.ts` with error handling for 400 (query not registered) and 404 (workflow not found)
-   [x] 10.3 Add route `GET /executions/:workflowId/query/:queryName` to `routes/temporal/index.ts`
-   [x] 10.4 Export `queryWorkflowExecution` from temporalService

## 11. Verification

-   [x] 11.1 Run `npx tsc --noEmit` in `packages/temporal-worker` to verify worker compiles
-   [x] 11.2 Run `npx tsc --noEmit` in `packages/server` to verify server compiles
-   [x] 11.3 Run `npx vite build` in `packages/ui` to verify UI builds

## 12. UI — Input Variables in Start Node

-   [x] 12.1 Update `AddTemporalNodes.jsx` to add `inputVariables: []` to temporalStart defaultData
-   [x] 12.2 Add Input Variables editor section to temporalStart case in `TemporalNodeConfigDialog.jsx`
-   [x] 12.3 Implement addVariable, removeVariable, updateVariable handlers in dialog
-   [x] 12.4 Add validation: variable name must be non-empty, no whitespace, unique
-   [x] 12.5 Display help text: "Access in other nodes using: {{input.variableName}}"

## 13. UI — Context Variables Autocomplete

-   [x] 13.1 Create `packages/ui/src/views/temporalflows/temporalNodeOutputs.js` with output schemas for each node type
-   [x] 13.2 Create `packages/ui/src/utils/temporalHelper.js` with `getAvailableTemporalNodes()` and `getNodeDisplayLabel()` functions
-   [x] 13.3 Create `packages/ui/src/views/temporalflows/TemporalSelectVariable.jsx` component (based on SelectVariable.jsx pattern)
-   [x] 13.4 Create `packages/ui/src/views/temporalflows/TemporalTemplateInput.jsx` component with `{{` detection and Popover
-   [x] 13.5 Update `TemporalCanvas.jsx` to pass `nodes` and `edges` to `TemporalNodeConfigDialog` via dialogProps
-   [x] 13.6 Update `TemporalNodeConfigDialog.jsx` to use `TemporalTemplateInput` for question template in AgentFlow Call
-   [x] 13.7 Update `TemporalNodeConfigDialog.jsx` to use `TemporalTemplateInput` for expression in Condition node
-   [x] 13.8 Update `TemporalNodeConfigDialog.jsx` to use `TemporalTemplateInput` for URL, headers, body in HTTP Request node
-   [x] 13.9 Update `TemporalNodeConfigDialog.jsx` to use `TemporalTemplateInput` for instructions in Human Task node

## 14. UI — Run Workflow Dialog

-   [x] 14.1 Create `packages/ui/src/views/temporalflows/RunWorkflowDialog.jsx` component
-   [x] 14.2 Implement dynamic form generation from inputVariables array
-   [x] 14.3 Implement client-side validation (required fields, type checks)
-   [x] 14.4 Implement type coercion on submit (string to number, string to boolean, JSON parsing)
-   [x] 14.5 Add `runDialogOpen` state to `TemporalCanvas.jsx`
-   [x] 14.6 Update `handleStartWorkflow` in `TemporalCanvas.jsx` to open dialog when manual workflow has inputVariables
-   [x] 14.7 Add `handleRunWithInput` callback that closes dialog and starts workflow with input
-   [x] 14.8 Render `RunWorkflowDialog` in `TemporalCanvas.jsx`

## 15. Worker — Runtime Input Validation

-   [x] 15.1 Add `InputVariable` interface to `durableWorkflow.ts`
-   [x] 15.2 Implement `validateAndCoerceInput()` function in `durableWorkflow.ts`
-   [x] 15.3 Call validation at start of `durableWorkflowExecutor` after fetching flow definition
-   [x] 15.4 Throw descriptive error if validation fails
-   [x] 15.5 Apply coerced input to context.input

## 16. Verification — New Features

-   [x] 16.1 Verify Start node config shows Input Variables editor
-   [x] 16.2 Verify typing `{{` in AgentFlow Call question field shows autocomplete dropdown
-   [x] 16.3 Verify autocomplete shows input variables from Start node
-   [x] 16.4 Verify autocomplete shows outputs from upstream nodes with friendly labels
-   [x] 16.5 Verify Run button opens dialog when workflow has input variables
-   [x] 16.6 Verify dialog validates required fields before allowing run
-   [x] 16.7 Verify workflow fails with clear error when required input is missing
-   [x] 16.8 Verify type coercion works (string "123" becomes number 123)

## 17. Worker — Expression Evaluator Fix

-   [x] 17.1 Add `expr-eval` dependency to `packages/temporal-worker/package.json`
-   [x] 17.2 Rewrite `evaluateExpression()` in `packages/temporal-worker/src/utils/expressionEvaluator.ts` to use expr-eval Parser
-   [x] 17.3 Transform `{{path}}` to `path` (strip curly braces) before evaluation
-   [x] 17.4 Register custom functions: `contains`, `startsWith`, `endsWith`, `isNull`, `isNotNull`
-   [x] 17.5 Register helper functions: `lower`, `upper`, `length`
-   [x] 17.6 Remove old `parseAndEvaluate`, `getValueOrLiteral`, `resolveTemplateVariables` functions
-   [x] 17.7 Run `npm install` in `packages/temporal-worker`
-   [x] 17.8 Verify build passes with `npx tsc --noEmit`

## 18. Worker — Module-Scope State Fix

-   [x] 18.1 Move `receivedSignals` Map declaration inside `durableWorkflowExecutor` function
-   [x] 18.2 Move `collectedSignals` Map declaration inside `durableWorkflowExecutor` function
-   [x] 18.3 Move `pendingTasks` Map declaration inside `durableWorkflowExecutor` function
-   [x] 18.4 Move `workflowState` object declaration inside `durableWorkflowExecutor` function
-   [x] 18.5 Create `WorkflowState` interface to pass state to helper functions
-   [x] 18.6 Update `executeNode` function signature to accept state parameter
-   [x] 18.7 Update all `executeNode` calls to pass state object
-   [x] 18.8 Verify build passes with `npx tsc --noEmit`

## 19. Verification — Expression Evaluator

-   [x] 19.1 Test compound AND: `{{input.a}} > 5 && {{input.b}} < 10` returns true when a=6, b=8
-   [x] 19.2 Test compound OR: `{{input.a}} > 100 || {{input.b}} == "yes"` returns true when b="yes"
-   [x] 19.3 Test parentheses: `({{input.a}} + {{input.b}}) > 10` returns true when a=6, b=6
-   [x] 19.4 Test custom function: `contains({{node.text}}, "approved")` returns true when text contains "approved"
-   [x] 19.5 Test string functions: `lower({{input.status}}) == "approved"` works correctly
-   [x] 19.6 Test length function: `length({{input.items}}) > 0` works for arrays and strings
-   [x] 19.7 Test backward compatibility: existing simple conditions still work

## 20. Verification — Module-Scope State Fix

-   [x] 20.1 Start two workflow executions concurrently
-   [x] 20.2 Query `getWorkflowState` on each execution returns correct isolated state
-   [x] 20.3 Signal one execution does not affect the other
-   [x] 20.4 Workflow replay (worker restart) maintains correct state

## 21. Worker — Fix Conditional Branch Execution

-   [x] 21.1 Update `getNextNodes` in `topologicalSort.ts` to handle `temporalCondition` node type
-   [x] 21.2 Update `getNextNodes` sourceHandle matching to use `.includes('true')` / `.includes('false')`
-   [x] 21.3 Create new `executeWorkflowGraph` function in `durableWorkflow.ts`
-   [x] 21.4 Implement dependency checking for join nodes (wait for all incoming branches)
-   [x] 21.5 For condition nodes, use `result.result` to determine which branch to follow
-   [x] 21.6 For non-condition nodes, use `Promise.all()` for parallel branch execution
-   [x] 21.7 Replace topological sort loop with `executeWorkflowGraph` call
-   [x] 21.8 Verify build passes with `npx tsc --noEmit`

## 22. Verification — Conditional Branching

-   [x] 22.1 Test condition evaluates true → only true branch nodes execute
-   [x] 22.2 Test condition evaluates false → only false branch nodes execute
-   [x] 22.3 Test parallel branches (non-condition node with multiple outputs) → all branches execute in parallel
-   [x] 22.4 Test diamond pattern (branches converge) → join node waits for all branches
-   [x] 22.5 Test multiple sequential conditions → correct path through all conditions
-   [x] 22.6 Test nested conditions → inner conditions only execute if outer condition allows
