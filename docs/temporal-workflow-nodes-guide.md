# Temporal Workflow Builder Guide

Build durable, long-running workflows visually using the drag-and-drop canvas. This guide covers all available nodes and how to use them effectively.

## Getting Started

1. Navigate to **Temporal Workflows** in the sidebar
2. Click **Create New Workflow** or open an existing one
3. Click the **+** button (top-left) to open the node palette
4. Drag nodes onto the canvas and connect them with edges

## Available Nodes

### Start Node

Every workflow begins with a Start node. It defines what inputs your workflow accepts.

**When to use:** Always required as the entry point.

**Configuration:**

| Setting           | Description                                                 |
| ----------------- | ----------------------------------------------------------- |
| Label             | Display name for the node                                   |
| Trigger Mode      | `Manual` (run on-demand) or `Scheduled` (run automatically) |
| Schedule Interval | Duration like `10m`, `1h`, `1d` (only for scheduled mode)   |
| Overlap Policy    | What happens if previous run is still running               |
| Catchup Window    | How far back to catch up on missed schedules                |
| Input Variables   | Define the data your workflow needs to run                  |

**Schedule Interval Format:**

-   `30s` - Every 30 seconds
-   `10m` - Every 10 minutes
-   `1h` - Every hour
-   `1d` - Every day

**Overlap Policy Options:**

-   `Skip` (default) - Skip if previous is still running
-   `Allow All` - Run anyway
-   `Buffer One` - Queue one execution
-   `Cancel Other` - Cancel the running one

**Defining Input Variables:**

Click "Add Variable" to define inputs your workflow will accept:

-   **Name**: Variable identifier (no spaces, e.g., `customerId`)
-   **Type**: `String`, `Number`, `Boolean`, `Object`, or `Array`
-   **Required**: Check if the workflow should fail when not provided
-   **Default Value**: Fallback value (disabled for required fields)
-   **Description**: Optional help text

**Example:** A loan approval workflow might define:

-   `customerId` (String, required)
-   `loanAmount` (Number, required)
-   `autoApprove` (Boolean, optional, default: false)

**Accessing inputs in other nodes:** Use `{{input.variableName}}`

---

### AgentFlow Call Node

Calls an existing AI chatflow and captures its response.

**When to use:** When you need AI analysis, document processing, or any task your chatflows handle.

**Configuration:**

| Setting           | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| Label             | Display name                                                      |
| AgentFlow         | Select from dropdown of available chatflows                       |
| API Key           | Optional authentication key (select from dropdown or use default) |
| Question Template | The prompt to send (supports variable templates)                  |

**Example question templates:**

```
Analyze this loan application: Customer {{input.customerId}}, Amount: ${{input.loanAmount}}
```

```
Summarize the document: {{previousNode.text}}
```

**What you get back:**

-   `text` - The AI's response
-   `chatId` - Chat conversation ID
-   `sessionId` - Session ID
-   `sourceDocuments` - RAG sources used (if applicable)
-   `usedTools` - Tools the agent called
-   `agentReasoning` - Agent reasoning steps

---

### Timer Node

Pauses the workflow for a specified duration. The timer is durable - it survives system restarts.

**When to use:**

-   Add delays between steps
-   Wait before retrying
-   Implement SLA timers
-   Schedule follow-ups

**Configuration:**

| Setting  | Description      |
| -------- | ---------------- |
| Label    | Display name     |
| Duration | How long to wait |

**Duration formats:**

-   `30s` - 30 seconds
-   `5m` - 5 minutes
-   `1h` - 1 hour
-   `1d` - 1 day

**Example use case:** Wait 24 hours before sending a follow-up reminder.

---

### Human Task Node

Pauses the workflow and waits for a human to take action. Perfect for approvals, reviews, or manual data entry.

**When to use:**

-   Manager approvals
-   Manual review steps
-   Data verification
-   Exception handling

**Configuration:**

| Setting                | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| Label                  | Display name                                                     |
| Task Name              | Identifier for the task (e.g., "Review Application")             |
| Assigned Role          | Who should handle this (e.g., "Loan Officer", "Manager")         |
| Instructions           | What the human needs to do (supports templates)                  |
| Signal Name (optional) | Custom signal name (auto-generated as `task_{nodeId}` if blank)  |
| Timeout (optional)     | How long to wait (e.g., `24h`, `7d`)                             |
| Timeout Behavior       | `Continue` (proceed with timeout result) or `Fail` (throw error) |

**Example instructions:**

```
Please review the loan application for {{input.customerId}}.
Amount: ${{input.loanAmount}}
AI Recommendation: {{aiAnalysis.text}}

Approve or reject with comments.
```

**How tasks are completed:** External systems send a signal with the decision data. See the API documentation for details.

**What you get back:**

-   `taskName` - Name of the completed task
-   `data` - Whatever the human submitted
-   `completedAt` - Timestamp
-   `timedOut` - Boolean indicating if timeout occurred

---

### Collect Signals Node

Waits for multiple signals before continuing. Use when you need multiple approvals or inputs.

**When to use:**

-   Multi-party approvals (e.g., 2 of 3 managers must approve)
-   Gathering responses from multiple sources
-   Parallel data collection

**Configuration:**

| Setting            | Description                                     |
| ------------------ | ----------------------------------------------- |
| Label              | Display name                                    |
| Signal Name        | Name of the signal to collect multiple times    |
| Required Count     | How many signals needed to proceed (default: 2) |
| Timeout (optional) | Overall timeout for collecting all signals      |

**Example:** Require 2 manager approvals for large loans:

-   Signal Name: `manager_approval`
-   Required Count: `2`

**What you get back:**

-   `signalName` - The signal name
-   `collected` - Array of all received signals with timestamps
-   `count` - How many were received
-   `requiredCount` - The required count
-   `complete` - Whether required count was reached
-   `completedAt` - Timestamp

---

### Condition Node

Branches the workflow based on a condition. Creates two paths: one for true, one for false.

**When to use:**

-   Decision points
-   Routing based on data
-   Handling different scenarios

**Configuration:**

| Setting    | Description                    |
| ---------- | ------------------------------ |
| Label      | Display name                   |
| Expression | Boolean expression to evaluate |

**Connection handles:**

-   **Green handle (right, upper)** - True branch
-   **Red handle (right, lower)** - False branch

**Expression examples:**

Simple comparisons:

```
{{input.loanAmount}} > 50000
{{input.creditScore}} >= 700
{{aiAnalysis.text}} == "approved"
```

Multiple conditions:

```
{{input.loanAmount}} > 50000 && {{input.creditScore}} >= 700
{{input.isVIP}} || {{input.loanAmount}} < 10000
```

Using functions:

```
contains({{aiAnalysis.text}}, "approved")
length({{input.documents}}) >= 3
lower({{input.status}}) == "active"
```

**Available functions:**

| Function                  | Description                      | Example                                     |
| ------------------------- | -------------------------------- | ------------------------------------------- |
| `contains(str, substr)`   | Check if text contains substring | `contains({{node.text}}, "yes")`            |
| `startsWith(str, prefix)` | Check if text starts with        | `startsWith({{input.id}}, "LOAN-")`         |
| `endsWith(str, suffix)`   | Check if text ends with          | `endsWith({{input.email}}, "@company.com")` |
| `length(value)`           | Get length of text or array      | `length({{input.items}}) > 0`               |
| `lower(str)`              | Convert to lowercase             | `lower({{input.answer}}) == "yes"`          |
| `upper(str)`              | Convert to uppercase             | `upper({{input.code}}) == "ABC"`            |
| `isNull(value)`           | Check if empty/missing           | `isNull({{input.optional}})`                |
| `isNotNull(value)`        | Check if has value               | `isNotNull({{node.result}})`                |

---

### HTTP Request Node

Makes calls to external APIs.

**When to use:**

-   Integrate with external services
-   Fetch data from APIs
-   Send notifications
-   Update external systems

**Configuration:**

| Setting        | Description                       |
| -------------- | --------------------------------- |
| Label          | Display name                      |
| Method         | GET, POST, PUT, PATCH, DELETE     |
| URL            | API endpoint (supports templates) |
| Headers (JSON) | Request headers as JSON object    |
| Body (JSON)    | Request body (for POST/PUT/PATCH) |

**Example - Call an external API:**

```
Method: GET
URL: https://api.creditcheck.com/score/{{input.customerId}}
Headers: {"Authorization": "Bearer {{input.apiKey}}"}
```

**Example - Send a webhook:**

```
Method: POST
URL: https://hooks.slack.com/services/xxx
Body: {"text": "Loan {{input.loanId}} was approved!"}
```

**What you get back:**

-   `status` - HTTP status code (200, 404, etc.)
-   `data` - Response body
-   `headers` - Response headers

---

## Using Variables

Variables let you pass data between nodes using the `{{path}}` syntax.

### Accessing Input Variables

Data defined in your Start node:

```
{{input.customerId}}
{{input.loanAmount}}
{{input.customer.name}}
```

### Accessing Node Outputs

Data from previous nodes (use the node's ID or label):

```
{{node-abc123.text}}
{{node-abc123.data.approved}}
```

### Autocomplete

When typing in a text field that supports templates, type `{{` to see available variables:

-   Input variables from your Start node
-   Outputs from nodes that connect to this one

---

## Building Workflow Patterns

### Linear Workflow

```
Start → AgentFlow Call → Human Task → HTTP Request
```

Each step runs after the previous completes.

### Conditional Branching

```
Start → Condition
           ├─ (True) → High Value Path
           └─ (False) → Standard Path
```

Different paths based on data.

### Parallel Approval

```
Start → Collect Signals (require 2) → Continue
```

Wait for multiple approvals.

### Timeout with Fallback

```
Human Task (24h timeout, continue) → Condition
                                        ├─ (not timedOut) → Process Response
                                        └─ (timedOut) → Auto-Escalate
```

Handle cases where humans don't respond.

---

## Running Workflows

### Manual Execution

1. Click the **Run** button in the canvas toolbar
2. If your workflow has input variables, a dialog appears
3. Fill in the required values
4. Click **Start Workflow**

### Scheduled Execution

1. Configure the Start node with `Scheduled` trigger mode
2. Set the schedule interval (e.g., `1h`, `1d`)
3. Configure overlap policy and catchup window if needed
4. Save the workflow
5. Click the **Schedule** button to activate

**Managing Schedules:**

Once scheduled, use the dropdown menu (three dots icon) to:

-   Pause/Resume the schedule
-   Trigger immediately
-   Delete the schedule

The toolbar shows schedule status with a chip indicator.

---

## Tips

1. **Name your nodes clearly** - Use descriptive labels so the workflow is self-documenting

2. **Test with simple inputs first** - Verify each branch works before adding complexity

3. **Use conditions for error handling** - Check for empty or unexpected values

4. **Set appropriate timeouts** - Human tasks should have reasonable deadlines

5. **Keep expressions simple** - Complex logic is harder to debug; split into multiple conditions if needed

6. **Use the autocomplete** - Type `{{` in template fields to see available variables
