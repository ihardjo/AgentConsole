# Temporal Workflow API Reference

REST API documentation for developers integrating with the Temporal workflow system.

**Base URL:** `/api/v1/temporal`

**Authentication:** All endpoints require authentication via the standard auth headers (except health check).

---

## Workflow Definitions

Manage workflow definitions (the visual flow configurations).

### Create Workflow

```http
POST /workflows
```

**Request Body:**

```json
{
    "name": "Loan Approval Workflow",
    "flowData": {
        "nodes": [
            {
                "id": "node-1",
                "type": "temporalStart",
                "position": { "x": 100, "y": 100 },
                "data": {
                    "label": "Start",
                    "inputVariables": [
                        { "name": "customerId", "type": "string", "required": true },
                        { "name": "amount", "type": "number", "required": true }
                    ]
                }
            }
        ],
        "edges": [],
        "viewport": { "x": 0, "y": 0, "zoom": 1 }
    }
}
```

**Response:** `201 Created`

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Loan Approval Workflow",
    "flowData": "...",
    "workspaceId": "workspace-uuid",
    "type": "TEMPORAL",
    "createdDate": "2024-01-15T10:30:00Z",
    "updatedDate": "2024-01-15T10:30:00Z"
}
```

---

### List Workflows

```http
GET /workflows
```

**Query Parameters:**

| Parameter | Type   | Default | Description                       |
| --------- | ------ | ------- | --------------------------------- |
| `page`    | number | 1       | Page number                       |
| `limit`   | number | 20      | Items per page                    |
| `search`  | string | -       | Filter by name (case-insensitive) |

**Response:**

```json
{
    "data": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "name": "Loan Approval Workflow",
            "createdDate": "2024-01-15T10:30:00Z",
            "updatedDate": "2024-01-15T10:30:00Z"
        }
    ],
    "total": 42
}
```

---

### Get Workflow

```http
GET /workflows/:id
```

**Response:**

```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Loan Approval Workflow",
    "flowData": "{\"nodes\":[...],\"edges\":[...],\"viewport\":{...}}",
    "workspaceId": "workspace-uuid",
    "type": "TEMPORAL",
    "createdDate": "2024-01-15T10:30:00Z",
    "updatedDate": "2024-01-15T10:30:00Z"
}
```

**Note:** `flowData` is stored as a JSON string. Parse it to access nodes and edges.

---

### Update Workflow

```http
PUT /workflows/:id
```

**Request Body:**

```json
{
    "name": "Updated Workflow Name",
    "flowData": "{...}"
}
```

**Response:** Updated workflow object.

---

### Delete Workflow

```http
DELETE /workflows/:id
```

Deletes the workflow definition. If the workflow has an associated schedule, the schedule is also deleted.

**Response:**

```json
{ "success": true }
```

---

## Workflow Execution

Start and monitor workflow executions.

### Start Workflow

```http
POST /workflows/:id/start
```

**Request Body:**

```json
{
    "input": {
        "customerId": "cust-123",
        "amount": 50000,
        "autoApprove": false
    }
}
```

**Response (Manual Trigger):**

```json
{
    "workflowId": "durable-550e8400-e29b-41d4-a716-446655440000-1705312200000",
    "runId": "run-550e8400-e29b-41d4-a716-446655440000",
    "temporalUrl": "http://localhost:8080/namespaces/default/workflows/durable-..."
}
```

**Response (Scheduled Trigger):**

If the Start node is configured with `triggerMode: "scheduled"`, this endpoint creates a schedule instead:

```json
{
    "scheduleId": "schedule-550e8400-e29b-41d4-a716-446655440000-1705312200000",
    "triggerMode": "scheduled",
    "scheduleInterval": "1h",
    "overlapPolicy": "SKIP",
    "temporalUrl": "http://localhost:8080/namespaces/default/schedules/schedule-..."
}
```

**Error Response (validation failure):**

```json
{
    "statusCode": 400,
    "message": "Input validation failed:\nMissing required input: customerId"
}
```

---

### Get Workflow Status

```http
GET /workflows/:workflowId/status
```

**Note:** `:workflowId` is the Temporal execution ID (e.g., `durable-xxx-timestamp`), not the flow definition UUID.

**Response:**

```json
{
    "workflowId": "durable-550e8400-e29b-41d4-a716-446655440000-1705312200000",
    "runId": "run-uuid",
    "status": "RUNNING",
    "startTime": "2024-01-15T10:30:00.000Z",
    "closeTime": null,
    "temporalUrl": "http://localhost:8080/namespaces/default/workflows/..."
}
```

**Possible statuses:**

| Status       | Description                |
| ------------ | -------------------------- |
| `RUNNING`    | Currently executing        |
| `COMPLETED`  | Finished successfully      |
| `FAILED`     | Terminated with error      |
| `CANCELED`   | Manually canceled          |
| `TERMINATED` | Force terminated           |
| `TIMED_OUT`  | Exceeded execution timeout |

---

### List Executions

```http
GET /workflows/:flowId/executions
```

**Note:** `:flowId` is the workflow definition UUID.

**Query Parameters:**

| Parameter | Type   | Description                                                                     |
| --------- | ------ | ------------------------------------------------------------------------------- |
| `status`  | string | Filter: `RUNNING`, `COMPLETED`, `FAILED`, `CANCELED`, `TERMINATED`, `TIMED_OUT` |

**Response:**

```json
{
    "executions": [
        {
            "workflowId": "durable-550e8400-...-1705312200000",
            "runId": "run-uuid",
            "status": "COMPLETED",
            "startTime": "2024-01-15T10:30:00.000Z",
            "closeTime": "2024-01-15T10:35:00.000Z"
        },
        {
            "workflowId": "durable-550e8400-...-1705312500000",
            "runId": "run-uuid-2",
            "status": "RUNNING",
            "startTime": "2024-01-15T10:35:00.000Z"
        }
    ],
    "total": 2
}
```

---

## Signals

Send signals to running workflows to complete human tasks or provide external input.

### Send Signal

```http
POST /workflows/:workflowId/signal
```

**Request Body:**

```json
{
    "signalName": "task_node-abc123",
    "payload": {
        "approved": true,
        "notes": "Approved by manager",
        "approvedBy": "john.doe@company.com"
    }
}
```

**Response:**

```json
{ "success": true }
```

**Common signal names:**

| Pattern            | Description                                |
| ------------------ | ------------------------------------------ |
| `task_{nodeId}`    | Human Task node completion (default)       |
| `collect_{nodeId}` | Collect Signals node (default)             |
| Custom name        | As configured in node's `signalName` field |

**Error Response (workflow not found):**

```json
{
    "statusCode": 500,
    "message": "Error: temporalService.sendSignal - workflow not found"
}
```

---

## Queries

Query the internal state of running workflows.

### Query Workflow State

```http
GET /executions/:workflowId/query/:queryName
```

**Built-in Query: `getWorkflowState`**

```http
GET /executions/durable-550e8400-...-1705312200000/query/getWorkflowState
```

**Response:**

```json
{
    "status": "running",
    "currentNodeId": "node-def456",
    "pendingTasks": [
        {
            "taskId": "node-abc123",
            "taskName": "Manager Approval",
            "role": "manager",
            "instructions": "Review the loan application for customer cust-123.\nAmount: $50000",
            "signalName": "task_node-abc123",
            "waitingSince": "2024-01-15T10:32:00.000Z"
        }
    ],
    "context": {
        "input": {
            "customerId": "cust-123",
            "amount": 50000
        },
        "node-xyz789": {
            "text": "Based on analysis, this loan application appears low-risk...",
            "chatId": "chat-uuid"
        }
    }
}
```

**Response Fields:**

| Field           | Type           | Description                                     |
| --------------- | -------------- | ----------------------------------------------- |
| `status`        | string         | `running`, `completed`, or `failed`             |
| `currentNodeId` | string \| null | ID of currently executing node                  |
| `pendingTasks`  | array          | Human tasks waiting for completion              |
| `context`       | object         | Workflow data including inputs and node outputs |

**Error Response (query not registered):**

```json
{
    "statusCode": 400,
    "message": "Query handler 'unknownQuery' is not registered in workflow"
}
```

**Error Response (workflow not found):**

```json
{
    "statusCode": 404,
    "message": "Workflow execution 'durable-xxx' not found"
}
```

---

## Schedule Management

Manage scheduled workflow executions.

### Get Schedule Details

```http
GET /schedules/:scheduleId
```

**Response:**

```json
{
    "scheduleId": "schedule-550e8400-e29b-41d4-a716-446655440000-1705312200000",
    "status": {
        "paused": false,
        "notes": ""
    },
    "spec": {
        "intervals": [{ "every": "1h" }]
    },
    "nextActionTimes": ["2024-01-15T11:00:00.000Z"],
    "recentActions": [
        {
            "startTime": "2024-01-15T10:00:00.000Z",
            "actualTime": "2024-01-15T10:00:01.000Z"
        }
    ],
    "overlapPolicy": "SKIP",
    "catchupWindow": ""
}
```

**Error Response (schedule not found):**

```json
{
    "statusCode": 404,
    "message": "Schedule schedule-xxx not found"
}
```

---

### Pause Schedule

```http
POST /schedules/:scheduleId/pause
```

**Request Body (optional):**

```json
{
    "reason": "Maintenance window"
}
```

**Response:**

```json
{ "success": true }
```

---

### Resume Schedule

```http
POST /schedules/:scheduleId/unpause
```

**Response:**

```json
{ "success": true }
```

---

### Trigger Schedule Manually

```http
POST /schedules/:scheduleId/trigger
```

Immediately runs the scheduled workflow regardless of the schedule.

**Response:**

```json
{ "success": true }
```

---

### Delete Schedule

```http
DELETE /schedules/:scheduleId
```

**Response:**

```json
{ "success": true }
```

---

## Health Check

```http
GET /health
```

No authentication required. Used for monitoring.

**Response (healthy):**

```json
{ "status": "healthy" }
```

**Response (unhealthy):** `503 Service Unavailable`

```json
{
    "status": "unhealthy",
    "error": "Connection to Temporal server failed"
}
```

---

## Utilities

### List AgentFlows

```http
GET /agentflows
```

Returns available chatflows for the AgentFlow Call node dropdown.

**Response:**

```json
[
    {
        "id": "chatflow-uuid-1",
        "name": "Loan Analysis Agent"
    },
    {
        "id": "chatflow-uuid-2",
        "name": "Document Processor"
    }
]
```

---

## Node Types Reference

Node type identifiers used in `flowData.nodes[].type`:

| Type                     | Description              |
| ------------------------ | ------------------------ |
| `temporalStart`          | Workflow entry point     |
| `temporalAgentFlowCall`  | Call a chatflow          |
| `temporalTimer`          | Delay/sleep              |
| `temporalHumanTask`      | Human interaction point  |
| `temporalCollectSignals` | Collect multiple signals |
| `temporalCondition`      | Conditional branching    |
| `temporalHTTPRequest`    | External HTTP calls      |

---

## Node Output Schemas

Reference for what each node type returns (accessible via `{{nodeId.field}}`):

### temporalStart

```json
{
    "startedAt": "2024-01-15T10:30:00.000Z",
    "customerId": "cust-123",
    "amount": 50000
}
```

All input variables are spread into the output along with `startedAt`.

### temporalAgentFlowCall

```json
{
    "text": "AI response text",
    "chatId": "chat-conversation-id",
    "sessionId": "session-id",
    "sourceDocuments": [],
    "usedTools": [],
    "agentReasoning": []
}
```

### temporalTimer

```json
{
    "completed": true,
    "duration": "5m",
    "durationMs": 300000,
    "completedAt": "2024-01-15T10:35:00.000Z"
}
```

### temporalHumanTask

```json
{
    "taskName": "Manager Approval",
    "data": { "approved": true, "notes": "..." },
    "completedAt": "2024-01-15T11:00:00.000Z",
    "timedOut": false
}
```

On timeout (with `timeoutBehavior: "continue"`):

```json
{
    "taskName": "Manager Approval",
    "timedOut": true,
    "completedAt": "2024-01-16T10:32:00.000Z"
}
```

### temporalCollectSignals

```json
{
    "signalName": "approval_signal",
    "collected": [
        { "payload": { "approved": true }, "receivedAt": "2024-01-15T10:32:00.000Z" },
        { "payload": { "approved": true }, "receivedAt": "2024-01-15T10:45:00.000Z" }
    ],
    "count": 2,
    "requiredCount": 2,
    "complete": true,
    "completedAt": "2024-01-15T10:45:00.000Z"
}
```

### temporalCondition

```json
{
    "expression": "input.amount > 50000",
    "result": true,
    "branch": "true"
}
```

### temporalHTTPRequest

```json
{
    "status": 200,
    "data": { "response": "body" },
    "headers": { "content-type": "application/json" }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
    "statusCode": 400,
    "message": "Error description"
}
```

**Common status codes:**

| Code  | Description                                                   |
| ----- | ------------------------------------------------------------- |
| `400` | Bad request (validation error, missing fields, invalid query) |
| `401` | Unauthorized (invalid/missing auth)                           |
| `403` | Forbidden (no access to resource)                             |
| `404` | Resource not found                                            |
| `500` | Internal server error                                         |
| `503` | Service unavailable (Temporal connection issues)              |

---

## Integration Examples

### Complete Human Task Flow

```javascript
// 1. Start a workflow
const startResponse = await fetch('/api/v1/temporal/workflows/flow-uuid/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { customerId: 'cust-123', amount: 50000 } })
})
const { workflowId } = await startResponse.json()

// 2. Poll for pending tasks
const stateResponse = await fetch(`/api/v1/temporal/executions/${workflowId}/query/getWorkflowState`)
const { pendingTasks } = await stateResponse.json()

// 3. Complete a task
if (pendingTasks.length > 0) {
    const task = pendingTasks[0]
    await fetch(`/api/v1/temporal/workflows/${workflowId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            signalName: task.signalName,
            payload: { approved: true, notes: 'Looks good' }
        })
    })
}
```

### Monitor Workflow Status

```javascript
async function waitForCompletion(workflowId, maxWaitMs = 60000) {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(`/api/v1/temporal/workflows/${workflowId}/status`)
        const { status } = await response.json()

        if (status === 'COMPLETED') return { success: true }
        if (status === 'FAILED') return { success: false }

        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error('Timeout waiting for workflow')
}
```

### Create and Manage a Schedule

```javascript
// 1. Create a workflow with scheduled trigger mode (via UI or direct API)
// The Start node must have: triggerMode: "scheduled", scheduleInterval: "1h"

// 2. Start/schedule the workflow
const scheduleResponse = await fetch('/api/v1/temporal/workflows/flow-uuid/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: {} })
})
const { scheduleId } = await scheduleResponse.json()

// 3. Check schedule status
const detailsResponse = await fetch(`/api/v1/temporal/schedules/${scheduleId}`)
const details = await detailsResponse.json()
console.log('Next run:', details.nextActionTimes[0])
console.log('Paused:', details.status.paused)

// 4. Pause the schedule
await fetch(`/api/v1/temporal/schedules/${scheduleId}/pause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Maintenance' })
})

// 5. Resume the schedule
await fetch(`/api/v1/temporal/schedules/${scheduleId}/unpause`, {
    method: 'POST'
})

// 6. Trigger immediately
await fetch(`/api/v1/temporal/schedules/${scheduleId}/trigger`, {
    method: 'POST'
})
```
