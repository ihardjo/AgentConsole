## Overview

This change adds human-in-the-loop workflow capabilities to the Temporal Canvas by introducing two new node types (Human Task, Collect Signals), built-in workflow state querying, two new API endpoints (List Executions, Query Workflow), and one new activity (Send Email). The existing SignalWait node is removed as Human Task is a superset of its functionality.

Additionally, this change improves the developer experience by adding:

-   Input Variables UI in Start node for defining workflow inputs
-   Context Variables Autocomplete when typing `{{` in template fields
-   Run Workflow Dialog for entering input values when running manual workflows
-   Runtime Input Validation with type coercion and clear error messages

## Architecture

### Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Temporal Canvas UI                            │
├─────────────────────────────────────────────────────────────────────┤
│  Node Changes:                                                       │
│  ┌──────────────┐ ┌──────────────────┐                              │
│  │ Human Task   │ │ Collect Signals  │                              │
│  │ (NEW)        │ │ (NEW)            │                              │
│  └──────────────┘ └──────────────────┘                              │
│                                                                      │
│  Removed: SignalWait (replaced by Human Task)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Server API                                    │
├─────────────────────────────────────────────────────────────────────┤
│  Existing:                          New:                             │
│  POST /workflows/:id/signal    →    GET /workflows/:flowId/executions│
│                                     GET /workflows/:id/query/:name   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Temporal Worker                               │
├─────────────────────────────────────────────────────────────────────┤
│  durableWorkflow.ts                                                  │
│  ├─ Remove: temporalSignalWait case                                 │
│  ├─ Add: temporalHumanTask case (signal wait + pending tasks)       │
│  ├─ Add: temporalCollectSignals case (N-signal collection)          │
│  └─ Add: Built-in getWorkflowState query handler (auto-registered)  │
│                                                                      │
│  New Activities:                                                     │
│  └─ sendEmail.ts - SMTP email sending                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Detailed Design

### 1. Human Task Node (`temporalHumanTask`)

**Purpose**: Pause workflow until a human completes a task. Replaces SignalWait with added human context.

**Node Data Schema**:

```typescript
interface HumanTaskNodeData {
    label: string
    taskName: string // Display name for the task
    assignedRole: string // Generic role (e.g., "Loan Processor", "Approver")
    instructions: string // Instructions for the human
    signalName?: string // Auto-generated as `task_${nodeId}` if not provided
    timeout?: string // Duration string (e.g., "7d", "24h")
    timeoutBehavior: 'fail' | 'continue' // What to do on timeout
}
```

**Worker Implementation**:

```typescript
case 'temporalHumanTask':
  const taskSignalName = data.signalName || `task_${node.id}`

  // Register this task in pending tasks (for query)
  pendingTasks.set(node.id, {
    taskId: node.id,
    taskName: data.taskName,
    role: data.assignedRole,
    instructions: data.instructions,
    signalName: taskSignalName,
    waitingSince: new Date().toISOString()
  })

  // Set up signal handler
  setHandler(defineSignal(taskSignalName), (payload: any) => {
    receivedSignals.set(node.id, payload)
  })

  // Wait for completion signal with optional timeout
  const timeoutMs = data.timeout ? parseDuration(data.timeout) : undefined
  const completed = await condition(
    () => receivedSignals.has(node.id),
    timeoutMs
  )

  // Remove from pending tasks
  pendingTasks.delete(node.id)

  if (!completed) {
    if (data.timeoutBehavior === 'fail') {
      throw new Error(`Human task "${data.taskName}" timed out`)
    }
    return { timedOut: true, taskName: data.taskName }
  }

  return {
    taskName: data.taskName,
    data: receivedSignals.get(node.id),
    completedAt: new Date().toISOString()
  }
```

**UI Component** (`HumanTaskNode.jsx`):

-   Icon: `IconUserCheck` (purple color `#9C27B0`)
-   Displays: Task name, assigned role, timeout (if set)
-   Input handle: Left
-   Output handle: Right

### 2. Collect Signals Node (`temporalCollectSignals`)

**Purpose**: Wait for N occurrences of the same signal type before continuing.

**Node Data Schema**:

```typescript
interface CollectSignalsNodeData {
    label: string
    signalName: string // Base signal name (e.g., "document_uploaded")
    requiredCount: number // How many signals to collect (default: 2)
    timeout?: string // Overall timeout duration
}
```

**Worker Implementation**:

```typescript
case 'temporalCollectSignals':
  const collSignalName = data.signalName || `collect_${node.id}`
  const collected: any[] = []

  // Set up signal handler that accumulates payloads
  setHandler(defineSignal(collSignalName), (payload: any) => {
    collected.push({
      payload,
      receivedAt: new Date().toISOString()
    })
  })

  // Wait until required count reached or timeout
  const collTimeoutMs = data.timeout ? parseDuration(data.timeout) : undefined
  const reachedCount = await condition(
    () => collected.length >= data.requiredCount,
    collTimeoutMs
  )

  return {
    signalName: collSignalName,
    collected,
    count: collected.length,
    requiredCount: data.requiredCount,
    complete: reachedCount
  }
```

**UI Component** (`CollectSignalsNode.jsx`):

-   Icon: `IconInbox` (blue color `#2196F3`)
-   Displays: Signal name, required count (e.g., "2 signals")
-   Input handle: Left
-   Output handle: Right

### 3. Built-in Query Handler (Auto-registered)

**Purpose**: Every workflow automatically exposes a `getWorkflowState` query for external systems to read current state.

**Worker Implementation** (at workflow start):

```typescript
// Auto-register built-in query handler for every workflow
const pendingTasks = new Map<string, PendingTask>()
const workflowState = {
    status: 'running',
    currentNodeId: null as string | null
}

setHandler(defineQuery('getWorkflowState'), () => ({
    status: workflowState.status,
    currentNodeId: workflowState.currentNodeId,
    pendingTasks: Array.from(pendingTasks.values()),
    context: sanitizeContext(context) // Exclude internal fields
}))
```

**No UI configuration needed** - this is automatic for all workflows.

### 4. List Executions API Endpoint

**Purpose**: List all workflow executions for a given workflow definition.

**Endpoint**: `GET /api/v1/temporal/workflows/:flowId/executions`

**Query Parameters**:

-   `status` (optional): Filter by status (RUNNING, COMPLETED, FAILED, etc.)

**Response**:

```typescript
interface ListExecutionsResponse {
    executions: WorkflowExecution[]
    total: number
}

interface WorkflowExecution {
    workflowId: string // e.g., "temporal-flow-flow-123-abc"
    runId: string
    status: string // RUNNING, COMPLETED, FAILED, CANCELLED, TIMED_OUT
    startTime: string // ISO timestamp
    closeTime?: string // ISO timestamp (if completed)
}
```

**Service Implementation** (`services/temporal/index.ts`):

```typescript
const listExecutions = async (flowId: string, status?: string): Promise<ListExecutionsResponse> => {
    const client = await getTemporalClient()

    // Build query to find executions for this flow definition
    let query = `WorkflowType = "durableWorkflowExecutor"`

    // Note: We need to filter by flowId which is passed as input
    // Temporal allows querying by search attributes if configured

    const result = await client.workflowService.listWorkflowExecutions({
        namespace: getNamespace(),
        query
    })

    // Filter by flowId (from workflow input) and optional status
    const filtered = result.executions.filter((exec) => {
        const matchesFlow = exec.execution.workflowId.includes(flowId)
        const matchesStatus = !status || exec.status.name === status
        return matchesFlow && matchesStatus
    })

    return {
        executions: filtered.map((exec) => ({
            workflowId: exec.execution.workflowId,
            runId: exec.execution.runId,
            status: exec.status.name,
            startTime: exec.startTime?.toISOString(),
            closeTime: exec.closeTime?.toISOString()
        })),
        total: filtered.length
    }
}
```

### 5. Query Workflow Execution API Endpoint

**Purpose**: Query a specific Temporal workflow execution's state.

**Endpoint**: `GET /api/v1/temporal/executions/:workflowId/query/:queryName`

Note: We use `/executions/:workflowId` (not `/workflows/:workflowId`) to distinguish:

-   `/temporal/workflows/:id` = saved workflow **definition** (ChatFlow entity in DB)
-   `/temporal/executions/:workflowId` = running Temporal **execution** (runtime instance)

**Service Implementation** (`services/temporal/index.ts`):

```typescript
export interface QueryWorkflowParams {
    workflowId: string
    queryName: string
    args?: any
}

const queryWorkflow = async (params: QueryWorkflowParams): Promise<any> => {
    try {
        const client = await getTemporalClient()
        const handle = client.workflow.getHandle(params.workflowId)
        const result = await handle.query(params.queryName, params.args)
        return result
    } catch (error: any) {
        if (error.message?.includes('query handler')) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `Query handler '${params.queryName}' not registered in workflow`)
        }
        if (error.message?.includes('not found')) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Workflow '${params.workflowId}' not found`)
        }
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error querying workflow: ${getErrorMessage(error)}`)
    }
}
```

### 6. Send Email Activity (`sendEmail.ts`)

**Purpose**: Send email notifications from workflow.

**Interface**:

```typescript
export interface SendEmailParams {
    to: string | string[]
    subject: string
    body: string // HTML or plain text
    from?: string // Override default sender
}

export interface SendEmailResult {
    success: boolean
    messageId?: string
    error?: string
}
```

**Implementation**:

```typescript
import nodemailer from 'nodemailer'
import { ApplicationFailure } from '@temporalio/activity'

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
})

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { to, subject, body, from } = params

    try {
        const info = await transporter.sendMail({
            from: from || process.env.SMTP_FROM,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html: body
        })

        return { success: true, messageId: info.messageId }
    } catch (error: any) {
        if (error.code === 'EAUTH') {
            throw ApplicationFailure.nonRetryable(`Email auth failed: ${error.message}`)
        }
        throw ApplicationFailure.retryable(`Email send failed: ${error.message}`)
    }
}
```

**Environment Variables**:

-   `SMTP_HOST` - SMTP server hostname
-   `SMTP_PORT` - SMTP server port (default: 587)
-   `SMTP_SECURE` - Use TLS (default: false)
-   `SMTP_USER` - SMTP username
-   `SMTP_PASS` - SMTP password
-   `SMTP_FROM` - Default sender email address

## Node Registration Updates

**`AddTemporalNodes.jsx`**:

Remove SignalWait:

```javascript
// REMOVE this entry:
{
  type: 'temporalSignalWait',
  label: 'Wait for Signal',
  // ...
}
```

Add new nodes:

```javascript
{
  type: 'temporalHumanTask',
  label: 'Human Task',
  description: 'Wait for human to complete a task',
  icon: IconUserCheck,
  color: '#9C27B0',
  defaultData: {
    taskName: '',
    assignedRole: '',
    instructions: '',
    timeout: '',
    timeoutBehavior: 'continue'
  }
},
{
  type: 'temporalCollectSignals',
  label: 'Collect Signals',
  description: 'Wait for multiple signals',
  icon: IconInbox,
  color: '#2196F3',
  defaultData: {
    signalName: '',
    requiredCount: 2,
    timeout: ''
  }
}
```

**`TemporalCanvas.jsx`**:

```javascript
const nodeTypes = useMemo(
    () => ({
        temporalStart: StartNode,
        temporalAgentFlowCall: AgentFlowCallNode,
        temporalTimer: TimerNode,
        temporalCondition: ConditionNode,
        temporalHTTPRequest: HTTPRequestNode,
        // REMOVE: temporalSignalWait: SignalWaitNode,
        temporalHumanTask: HumanTaskNode, // NEW
        temporalCollectSignals: CollectSignalsNode // NEW
    }),
    []
)
```

## API Usage Flow

For a frontend to interact with multiple workflow executions:

```
1. List Executions for a Flow Definition
   GET /api/v1/temporal/workflows/flow-123/executions
   → Returns: [{ workflowId: "durable-flow-123-abc", status: "RUNNING" }, { workflowId: "durable-flow-123-xyz", status: "RUNNING" }]

2. Query State of a Specific Execution
   GET /api/v1/temporal/executions/durable-flow-123-abc/query/getWorkflowState
   → Returns: { status, pendingTasks, context }

3. Send Signal to Complete a Task (existing API)
   POST /api/v1/temporal/workflows/durable-flow-123-abc/signal
   Body: { signalName: "task_node-5", payload: { ... } }
```

## Error Handling

| Scenario                         | Handling                                             |
| -------------------------------- | ---------------------------------------------------- |
| Human Task timeout (fail)        | Throw workflow error, fail execution                 |
| Human Task timeout (continue)    | Return `{ timedOut: true }`, continue workflow       |
| Collect Signals timeout          | Return partial collection with `{ complete: false }` |
| Query unknown workflow           | Return 404 Not Found                                 |
| Query unregistered handler       | Return 400 Bad Request                               |
| List executions for unknown flow | Return empty array                                   |
| Email auth failure               | Non-retryable ApplicationFailure                     |
| Email connection error           | Retryable ApplicationFailure                         |

## Security Considerations

-   Query results are scoped to the workflow execution
-   List executions should be filtered by workspace (existing auth middleware)
-   Signal sending requires workspace membership (existing auth)
-   Email activity uses server-side SMTP credentials (never exposed to client)
-   Context sanitization in query response (exclude sensitive fields)

## 7. Input Variables UI in Start Node

**Purpose**: Allow users to define expected input variables for a workflow, creating a contract/schema for workflow execution.

### Start Node Data Schema (Updated)

```typescript
interface StartNodeData {
    label: string
    triggerMode: 'manual' | 'scheduled'
    scheduleInterval?: string
    overlapPolicy?: string
    catchupWindow?: string
    scheduleId?: string
    inputVariables: InputVariable[] // NEW
}

interface InputVariable {
    name: string // Variable name (required, no whitespace)
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required: boolean // Whether this must be provided at runtime
    defaultValue?: any // Default value if not provided
    description?: string // Help text for Run dialog
}
```

### UI Implementation

**Location**: `TemporalNodeConfigDialog.jsx` - `temporalStart` case

```jsx
// Input Variables Editor
<Box>
    <Typography variant='body2' sx={{ mb: 1, fontWeight: 500 }}>
        Input Variables
    </Typography>
    {(formData.inputVariables || []).map((variable, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField
                size='small'
                label='Name'
                value={variable.name}
                onChange={(e) => updateVariable(index, 'name', e.target.value.replace(/\s/g, ''))}
                sx={{ flex: 2 }}
            />
            <FormControl size='small' sx={{ minWidth: 100 }}>
                <Select value={variable.type} onChange={(e) => updateVariable(index, 'type', e.target.value)}>
                    <MenuItem value='string'>String</MenuItem>
                    <MenuItem value='number'>Number</MenuItem>
                    <MenuItem value='boolean'>Boolean</MenuItem>
                    <MenuItem value='object'>Object</MenuItem>
                    <MenuItem value='array'>Array</MenuItem>
                </Select>
            </FormControl>
            <FormControlLabel
                control={<Checkbox checked={variable.required} onChange={(e) => updateVariable(index, 'required', e.target.checked)} />}
                label='Required'
            />
            <TextField
                size='small'
                label='Default'
                value={variable.defaultValue || ''}
                onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                sx={{ flex: 1 }}
            />
            <IconButton onClick={() => removeVariable(index)} size='small'>
                <IconTrash size={16} />
            </IconButton>
        </Box>
    ))}
    <Button startIcon={<IconPlus size={16} />} onClick={addVariable} size='small'>
        Add Variable
    </Button>
    <Alert severity='info' sx={{ mt: 2 }}>
        Access in other nodes using: <code>{'{{input.variableName}}'}</code>
    </Alert>
</Box>
```

## 8. Context Variables Autocomplete

**Purpose**: When typing `{{` in any template field, show a dropdown with available variables from input and upstream nodes.

### Architecture (Following Chatflow Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│  TemporalTemplateInput                                              │
│  ├─ Detects when value ends with "{{"                              │
│  ├─ Opens Popover with TemporalSelectVariable                      │
│  └─ Replaces "{{" with selected "{{variable.path}}"                │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TemporalSelectVariable                                             │
│  ├─ Section: Input Variables (from Start node)                     │
│  │   └─ input.applicantName, input.loanAmount, etc.                │
│  └─ Section: Node Outputs (upstream nodes only)                    │
│      └─ CreditAnalysis.text, CreditAnalysis.chatId, etc.           │
└─────────────────────────────────────────────────────────────────────┘
```

### Node Output Schemas

Each node type has defined output fields:

```typescript
// temporalNodeOutputs.js
export const TEMPORAL_NODE_OUTPUTS = {
    temporalStart: [{ name: 'startedAt', type: 'string', description: 'Workflow start timestamp' }],
    temporalAgentFlowCall: [
        { name: 'text', type: 'string', description: 'AI response text' },
        { name: 'chatId', type: 'string', description: 'Chat conversation ID' },
        { name: 'sessionId', type: 'string', description: 'Session ID' },
        { name: 'sourceDocuments', type: 'array', description: 'RAG source documents' },
        { name: 'usedTools', type: 'array', description: 'Tools used by agent' },
        { name: 'agentReasoning', type: 'array', description: 'Agent reasoning steps' }
    ],
    temporalHumanTask: [
        { name: 'taskName', type: 'string', description: 'Name of the task' },
        { name: 'data', type: 'object', description: 'Data submitted by human' },
        { name: 'completedAt', type: 'string', description: 'Completion timestamp' },
        { name: 'timedOut', type: 'boolean', description: 'Whether task timed out' }
    ],
    temporalTimer: [
        { name: 'completed', type: 'boolean', description: 'Timer completed' },
        { name: 'duration', type: 'string', description: 'Duration waited' },
        { name: 'completedAt', type: 'string', description: 'Completion timestamp' }
    ],
    temporalHTTPRequest: [
        { name: 'status', type: 'number', description: 'HTTP status code' },
        { name: 'data', type: 'object', description: 'Response body' },
        { name: 'headers', type: 'object', description: 'Response headers' }
    ],
    temporalCollectSignals: [
        { name: 'collected', type: 'array', description: 'Collected signal payloads' },
        { name: 'count', type: 'number', description: 'Number collected' },
        { name: 'complete', type: 'boolean', description: 'Required count reached' }
    ],
    temporalCondition: [
        { name: 'result', type: 'boolean', description: 'Condition result' },
        { name: 'branch', type: 'string', description: 'Branch taken (true/false)' }
    ]
}
```

### Variable Display Format

Variables are displayed using the node's label (without whitespace) rather than the auto-generated node ID:

| Node ID                               | Node Label        | Variable Display      | Stored Value                                   |
| ------------------------------------- | ----------------- | --------------------- | ---------------------------------------------- |
| `temporalAgentFlowCall_1711871234567` | "Credit Analysis" | `CreditAnalysis.text` | `{{temporalAgentFlowCall_1711871234567.text}}` |
| `temporalHumanTask_1711871234999`     | "Loan Review"     | `LoanReview.data`     | `{{temporalHumanTask_1711871234999.data}}`     |

**Note**: We display the friendly label but store the actual node ID in the template. The label is derived by removing whitespace from `node.data.label`.

### Helper Functions

```typescript
// temporalHelper.js
export const getAvailableTemporalNodes = (nodes, edges, targetNodeId) => {
    const upstreamNodes = []

    function collectUpstream(nodeId, visited = new Set()) {
        if (visited.has(nodeId)) return
        visited.add(nodeId)

        const incomingEdges = edges.filter((e) => e.target === nodeId)
        for (const edge of incomingEdges) {
            const sourceNode = nodes.find((n) => n.id === edge.source)
            if (sourceNode && !upstreamNodes.find((n) => n.id === sourceNode.id)) {
                upstreamNodes.push(sourceNode)
                collectUpstream(sourceNode.id, visited)
            }
        }
    }

    collectUpstream(targetNodeId)
    return upstreamNodes
}

export const getNodeDisplayLabel = (node) => {
    // Remove whitespace from label for variable reference
    return (node.data?.label || node.type || node.id).replace(/\s+/g, '')
}
```

## 9. Run Workflow Dialog

**Purpose**: Provide a form-based UI for entering input values when running manual workflows.

### Component: `RunWorkflowDialog.jsx`

```typescript
interface RunWorkflowDialogProps {
    open: boolean
    onClose: () => void
    workflow: { id: string; name: string }
    inputVariables: InputVariable[]
    onRun: (input: Record<string, any>) => void
}
```

### Behavior

1. **Dialog opens** when user clicks "Run" on a manual workflow with defined input variables
2. **Form generates** dynamically from `inputVariables` array
3. **Validation** runs client-side before submission:
    - Required fields must have values
    - Type-specific validation (number must be numeric, etc.)
4. **Type coercion** converts string inputs to appropriate types
5. **On submit**, calls `onRun(input)` with typed values

### Form Field Mapping

| Variable Type | Form Field                     |
| ------------- | ------------------------------ |
| `string`      | TextField                      |
| `number`      | TextField with `type="number"` |
| `boolean`     | Switch or Checkbox             |
| `object`      | TextField (JSON input)         |
| `array`       | TextField (JSON array input)   |

### Integration with TemporalCanvas

```jsx
// In TemporalCanvas.jsx
const [runDialogOpen, setRunDialogOpen] = useState(false)

const handleStartWorkflow = async () => {
    // ... existing validation ...

    if (startNodeTriggerMode === 'manual') {
        const inputVariables = startNodeData?.inputVariables || []
        if (inputVariables.length > 0) {
            setRunDialogOpen(true) // Open dialog to collect input
            return
        }
        // No input variables - run directly with empty input
        await executeWorkflow({})
    }
    // ... scheduled workflow logic ...
}

const handleRunWithInput = async (input) => {
    setRunDialogOpen(false)
    await executeWorkflow(input)
}
```

## 10. Runtime Input Validation

**Purpose**: Validate input values at workflow start against the defined schema.

### Worker Implementation

**Location**: `durableWorkflow.ts` - at start of `durableWorkflowExecutor`

```typescript
interface InputVariable {
    name: string
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required: boolean
    defaultValue?: any
}

function validateAndCoerceInput(input: Record<string, any>, schema: InputVariable[]): { input: Record<string, any>; errors: string[] } {
    const errors: string[] = []
    const coerced: Record<string, any> = { ...input }

    for (const variable of schema) {
        let value = input[variable.name]

        // Apply default if missing
        if ((value === undefined || value === null || value === '') && variable.defaultValue !== undefined) {
            value = variable.defaultValue
            coerced[variable.name] = value
        }

        // Check required
        if (variable.required && (value === undefined || value === null || value === '')) {
            errors.push(`Missing required input: ${variable.name}`)
            continue
        }

        // Skip validation if optional and not provided
        if (value === undefined || value === null) continue

        // Type validation and coercion
        const actualType = Array.isArray(value) ? 'array' : typeof value

        if (variable.type === 'number') {
            const num = Number(value)
            if (isNaN(num)) {
                errors.push(`${variable.name} must be a number, got "${value}"`)
            } else {
                coerced[variable.name] = num
            }
        } else if (variable.type === 'boolean') {
            if (typeof value === 'string') {
                coerced[variable.name] = value.toLowerCase() === 'true'
            } else if (typeof value !== 'boolean') {
                errors.push(`${variable.name} must be a boolean`)
            }
        } else if (variable.type === 'object' && typeof value === 'string') {
            try {
                coerced[variable.name] = JSON.parse(value)
            } catch {
                errors.push(`${variable.name} must be valid JSON object`)
            }
        } else if (variable.type === 'array' && typeof value === 'string') {
            try {
                const parsed = JSON.parse(value)
                if (!Array.isArray(parsed)) {
                    errors.push(`${variable.name} must be an array`)
                } else {
                    coerced[variable.name] = parsed
                }
            } catch {
                errors.push(`${variable.name} must be valid JSON array`)
            }
        } else if (variable.type !== actualType && variable.type !== 'string') {
            errors.push(`${variable.name} must be ${variable.type}, got ${actualType}`)
        }
    }

    return { input: coerced, errors }
}

// In durableWorkflowExecutor, after fetching flow definition:
const startNode = nodes.find((n) => n.type === 'temporalStart')
const inputSchema: InputVariable[] = startNode?.data?.inputVariables || []

if (inputSchema.length > 0) {
    const { input: validatedInput, errors } = validateAndCoerceInput(input, inputSchema)
    if (errors.length > 0) {
        throw new Error(`Input validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
    }
    context.input = validatedInput
}
```

### Error Response

When validation fails, the workflow immediately fails with a clear error message:

```
Input validation failed:
  - Missing required input: applicantName
  - loanAmount must be a number, got "fifty thousand"
  - creditScore must be a number
```

## 11. Expression Evaluator Fix

**Purpose**: Replace custom expression parser with `expr-eval` library to properly evaluate compound conditions with `&&`, `||`, parentheses, and standard JavaScript operators.

### Problem

The current `expressionEvaluator.ts` splits expressions on the first operator found, breaking compound conditions:

| Expression                                                    | Expected                             | Actual                   |
| ------------------------------------------------------------- | ------------------------------------ | ------------------------ |
| `{{input.loanAmount}} < 10000 && {{input.creditScore}} > 700` | `true` (when amount=5000, score=750) | `false` (broken parsing) |

When the parser encounters `<`, it splits into:

-   Left: `5000`
-   Right: `10000 && 750 > 700` → becomes `NaN`

Any comparison with `NaN` returns `false`.

### Solution

Use `expr-eval` library which properly handles:

-   Logical operators: `&&`, `||`, `!`
-   Comparison operators: `==`, `!=`, `>`, `<`, `>=`, `<=`
-   Parentheses for grouping: `(a > 1) && (b < 2)`
-   Ternary operator: `a > b ? "yes" : "no"`
-   Math operators: `+`, `-`, `*`, `/`, `%`

### Implementation

**New `expressionEvaluator.ts`**:

```typescript
import { Parser } from 'expr-eval'

// Create parser with custom functions for backward compatibility
const parser = new Parser()

// Register custom functions
parser.functions.contains = (str: string, substr: string) => typeof str === 'string' && str.includes(substr)
parser.functions.startsWith = (str: string, prefix: string) => typeof str === 'string' && str.startsWith(prefix)
parser.functions.endsWith = (str: string, suffix: string) => typeof str === 'string' && str.endsWith(suffix)
parser.functions.isNull = (val: any) => val === null || val === undefined
parser.functions.isNotNull = (val: any) => val !== null && val !== undefined
parser.functions.lower = (str: string) => (typeof str === 'string' ? str.toLowerCase() : str)
parser.functions.upper = (str: string) => (typeof str === 'string' ? str.toUpperCase() : str)
parser.functions.length = (val: any) => (Array.isArray(val) ? val.length : typeof val === 'string' ? val.length : 0)

export function evaluateExpression(expression: string, context: Record<string, any>): boolean {
    // Transform {{path.to.var}} → path.to.var (strip curly braces)
    const transformed = expression.replace(/\{\{([^}]+)\}\}/g, (_, path) => path.trim())

    try {
        const expr = parser.parse(transformed)
        const result = expr.evaluate(context)
        return Boolean(result)
    } catch (error: any) {
        console.error(`Failed to evaluate expression: ${expression}`, error)
        return false
    }
}
```

### Supported Expressions

| Expression                                                    | Description         |
| ------------------------------------------------------------- | ------------------- |
| `{{input.loanAmount}} < 10000 && {{input.creditScore}} > 700` | Compound AND        |
| `{{input.amount}} > 1000 \|\| {{input.priority}} == "high"`   | Compound OR         |
| `({{input.a}} + {{input.b}}) * 2 > 100`                       | Math with grouping  |
| `{{input.status}} == "approved" ? true : false`               | Ternary             |
| `contains({{node.text}}, "approved")`                         | Custom function     |
| `isNull({{input.optional}})`                                  | Null check function |
| `lower({{input.status}}) == "approved"`                       | String lowercase    |
| `upper({{input.code}}) == "ABC"`                              | String uppercase    |
| `length({{input.items}}) > 0`                                 | Array/string length |

### Custom Functions Reference

| Function                  | Description                          | Example                                     |
| ------------------------- | ------------------------------------ | ------------------------------------------- |
| `contains(str, substr)`   | Check if string/array contains value | `contains({{node.text}}, "approved")`       |
| `startsWith(str, prefix)` | Check if string starts with prefix   | `startsWith({{input.id}}, "ORD-")`          |
| `endsWith(str, suffix)`   | Check if string ends with suffix     | `endsWith({{input.email}}, "@company.com")` |
| `isNull(val)`             | Check if value is null or undefined  | `isNull({{input.optional}})`                |
| `isNotNull(val)`          | Check if value is not null/undefined | `isNotNull({{input.required}})`             |
| `lower(str)`              | Convert string to lowercase          | `lower({{input.status}}) == "approved"`     |
| `upper(str)`              | Convert string to uppercase          | `upper({{input.code}}) == "ABC"`            |
| `length(val)`             | Get length of string or array        | `length({{input.items}}) > 0`               |

## 12. Module-Scope State Fix

**Purpose**: Fix Temporal determinism violation by moving workflow state variables inside the workflow function.

### Problem

The current `durableWorkflow.ts` declares state variables at **module scope** (outside the workflow function):

```typescript
// PROBLEM: Module-level state shared across all workflow executions
const receivedSignals = new Map<string, any>()
const collectedSignals = new Map<string, Array<{ payload: any; receivedAt: string }>>()
const pendingTasks = new Map<string, PendingTask>()
const workflowState: { status: 'running' | 'completed' | 'failed'; currentNodeId: string | null } = {
    status: 'running',
    currentNodeId: null
}
```

This violates Temporal's determinism requirements because:

1. **Shared state across executions**: All workflow executions in the same worker share these Maps
2. **Non-deterministic replays**: When Temporal replays a workflow, the state from other executions may interfere
3. **Memory leaks**: State accumulates across executions and is never cleaned up properly

### Symptoms

-   Query `getWorkflowState` returns "Workflow execution ID not found" or incorrect state
-   Workflow state from one execution leaks into another
-   Unpredictable behavior when multiple workflows run concurrently

### Solution

Move all state variables **inside** the `durableWorkflowExecutor` function so each workflow execution gets its own isolated state.

### Implementation

```typescript
export async function durableWorkflowExecutor(params: DurableWorkflowInput): Promise<DurableWorkflowResult> {
    const { flowId, workspaceId, input } = params

    // FIXED: State variables are now scoped to this workflow execution
    const receivedSignals = new Map<string, any>()
    const collectedSignals = new Map<string, Array<{ payload: any; receivedAt: string }>>()
    const pendingTasks = new Map<string, PendingTask>()
    const workflowState: { status: 'running' | 'completed' | 'failed'; currentNodeId: string | null } = {
        status: 'running',
        currentNodeId: null
    }

    // Initialize execution context
    const context: Record<string, any> = {
        input,
        workspaceId
    }

    // Register built-in query handler (now uses local state)
    setHandler(getWorkflowStateQuery, () => ({
        status: workflowState.status,
        currentNodeId: workflowState.currentNodeId,
        pendingTasks: Array.from(pendingTasks.values()),
        context: sanitizeContext(context)
    }))

    // ... rest of workflow logic ...

    // Pass state to executeNode
    for (const node of executionOrder) {
        workflowState.currentNodeId = node.id
        const result = await executeNode(node, context, edges, nodes, {
            receivedSignals,
            collectedSignals,
            pendingTasks
        })
        context[node.id] = result
    }
}
```

### executeNode Signature Update

```typescript
interface WorkflowState {
    receivedSignals: Map<string, any>
    collectedSignals: Map<string, Array<{ payload: any; receivedAt: string }>>
    pendingTasks: Map<string, PendingTask>
}

async function executeNode(
    node: FlowNode,
    context: Record<string, any>,
    edges: FlowEdge[],
    nodes: FlowNode[],
    state: WorkflowState
): Promise<any> {
    const { receivedSignals, collectedSignals, pendingTasks } = state
    // ... node execution logic using local state ...
}
```

### Benefits

-   Each workflow execution has isolated state
-   Temporal replays work correctly
-   No memory leaks between executions
-   Queries return correct state for the specific workflow

## 13. Conditional Branch Execution Fix

**Purpose**: Fix the workflow execution loop to properly follow condition branches and support parallel execution patterns.

### Problem

The current execution loop uses topological sort and executes ALL nodes regardless of condition results:

```typescript
// PROBLEM: Executes all nodes, ignoring condition branches
const executionOrder = topologicalSort(nodes, edges)
for (const node of executionOrder) {
    const result = await executeNode(node, context, edges, nodes, internalState)
    context[node.id] = result
}
```

This causes both true AND false branches to execute after a condition node, regardless of which branch should be taken.

### Solution

Replace the topological sort execution with a proper graph traversal that:

1. **Respects condition branches**: Only follow edges from the taken branch (true/false)
2. **Supports parallel execution**: Use `Promise.all()` for non-conditional parallel branches
3. **Handles join points**: Wait for all required incoming branches before executing

### Execution Patterns

| Pattern                               | Behavior                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| Condition Node → True/False branches  | Only execute the branch matching the condition result         |
| Non-Condition Node → Multiple outputs | Execute all downstream nodes in parallel with `Promise.all()` |
| Multiple inputs → Join Node           | Wait for all required incoming branches to complete           |

### Edge Handle Format

Condition nodes have two output handles:

-   `${nodeId}-true` - Green handle for true branch
-   `${nodeId}-false` - Red handle for false branch

Edges store `sourceHandle` which indicates which branch they belong to.

### Implementation

#### Updated `getNextNodes` function in `topologicalSort.ts`:

```typescript
export function getNextNodes(currentNodeId: string, edges: FlowEdge[], nodes: FlowNode[], conditionResult?: boolean): FlowNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const currentNode = nodeMap.get(currentNodeId)

    // Filter edges from current node
    let outgoingEdges = edges.filter((e) => e.source === currentNodeId)

    // For condition nodes, filter by the branch taken
    const isConditionNode = currentNode?.type === 'condition' || currentNode?.type === 'temporalCondition'

    if (isConditionNode && conditionResult !== undefined) {
        const branchKey = conditionResult ? 'true' : 'false'
        outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle?.includes(branchKey))
    }

    return outgoingEdges.map((e) => nodeMap.get(e.target)!).filter(Boolean)
}
```

#### New `executeWorkflowGraph` function in `durableWorkflow.ts`:

```typescript
async function executeWorkflowGraph(
    nodes: FlowNode[],
    edges: FlowEdge[],
    context: Record<string, any>,
    internalState: InternalWorkflowState,
    workflowStatus: { status: string; currentNodeId: string | null }
): Promise<void> {
    // Find start node
    const startNode = nodes.find((n) => n.type === 'temporalStart' || n.type === 'start')
    if (!startNode) {
        throw new Error('Workflow must have a Start node')
    }

    // Track which nodes have been executed
    const executed = new Set<string>()

    // Track which nodes are currently being executed (for parallel support)
    const executing = new Map<string, Promise<void>>()

    // Recursive function to execute a node and its downstream
    async function executeNodeAndContinue(node: FlowNode): Promise<void> {
        // Skip if already executed
        if (executed.has(node.id)) return

        // If currently executing, wait for it
        if (executing.has(node.id)) {
            return executing.get(node.id)
        }

        // Check if all required dependencies are satisfied
        const incomingEdges = edges.filter((e) => e.target === node.id)
        for (const edge of incomingEdges) {
            const sourceNode = nodes.find((n) => n.id === edge.source)

            // For condition source nodes, only wait if this edge is from the taken branch
            if (sourceNode?.type === 'temporalCondition' || sourceNode?.type === 'condition') {
                if (executed.has(edge.source)) {
                    const condResult = context[edge.source]?.result
                    const expectedBranch = condResult ? 'true' : 'false'
                    // If this edge is from the non-taken branch, skip dependency check
                    if (!edge.sourceHandle?.includes(expectedBranch)) {
                        continue
                    }
                }
            }

            // Wait for source to be executed
            if (!executed.has(edge.source)) {
                if (executing.has(edge.source)) {
                    await executing.get(edge.source)
                } else {
                    // Source not yet started - this node will be triggered later
                    return
                }
            }
        }

        // Create execution promise
        const executionPromise = (async () => {
            // Execute the node
            workflowStatus.currentNodeId = node.id
            const result = await executeNode(node, context, edges, nodes, internalState)
            context[node.id] = result
            executed.add(node.id)

            // Determine next nodes based on condition result
            let conditionResult: boolean | undefined
            if (node.type === 'temporalCondition' || node.type === 'condition') {
                conditionResult = result.result
            }

            const nextNodes = getNextNodes(node.id, edges, nodes, conditionResult)

            // Execute next nodes in parallel
            if (nextNodes.length > 0) {
                await Promise.all(nextNodes.map((n) => executeNodeAndContinue(n)))
            }
        })()

        executing.set(node.id, executionPromise)
        await executionPromise
        executing.delete(node.id)
    }

    // Start execution from the start node
    await executeNodeAndContinue(startNode)
}
```

### Join Point Handling (Diamond Pattern)

When multiple branches converge to a single node:

```
     ┌─→ [Node A] ─┐
[Start] ─→ [Node B] ─→ [Join Node]
     └─→ [Node C] ─┘
```

The `executeNodeAndContinue` function checks all incoming edges and waits for all source nodes to complete before executing the join node. This is handled by the dependency check loop that waits for all `executed.has(edge.source)` to be true.

### Condition Branch Handling

When a condition node evaluates:

```
                    ┌─ true ─→ [Approve]
[Condition Node] ───┤
                    └─ false ─→ [Reject]
```

1. Condition node executes, returns `{ result: true, branch: 'true' }`
2. `getNextNodes` filters edges by `sourceHandle.includes('true')`
3. Only the "Approve" node is added to execution
4. "Reject" node is never executed

### Error Handling

If any branch fails during parallel execution, `Promise.all()` will reject immediately and the entire workflow will fail. This ensures consistent error handling across all branches.

### Cycle Prevention

The workflow assumes no cycles exist in the graph. The UI should prevent users from creating cycles. If a cycle is detected during execution (a node is visited twice), the execution will simply skip the already-executed node due to the `executed.has(node.id)` check.
