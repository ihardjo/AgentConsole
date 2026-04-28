## Architecture Decision: No Built-in Condition

The Loop node will NOT have a built-in condition expression. Instead:

-   Loop **always** loops back until max iterations reached
-   Use a **Condition node before the Loop** for conditional looping (separation of concerns)
-   This matches the principle of single-responsibility nodes

## Loop Node Data Structure

```typescript
// Node definition in AddTemporalNodes.jsx
{
    type: 'temporalLoop',
    label: 'Loop',
    description: 'Loop back to a previous node',
    icon: IconRepeat,
    color: '#795548',  // Brown color
    defaultData: {
        loopToNodeId: '',      // Target node ID (selected from dropdown)
        loopToNodeLabel: '',   // Display label for readability
        maxIterations: 3       // Safety limit (default 3, no global limit)
    }
}
```

## Loop Node Output Schema

```typescript
// In temporalNodeOutputs.js
temporalLoop: [
    { name: 'iteration', type: 'number', description: 'Current iteration count (1-based)' },
    { name: 'loopedTo', type: 'string', description: 'Target node ID that was looped to' },
    { name: 'continueLoop', type: 'boolean', description: 'Whether the loop continued' },
    { name: 'exitReason', type: 'string', description: 'Why loop exited (null or max_iterations)' }
]
```

## Execution Engine Changes

### 1. Loop State Tracking

```typescript
// Track iteration counts per loop node - scoped to workflow execution
// Inside durableWorkflowExecutor function
const loopIterations = new Map<string, number>()
```

### 2. Loop Node Execution Case

```typescript
case 'temporalLoop':
    const targetNodeId = data.loopToNodeId
    const maxIterations = data.maxIterations || 3
    const currentIteration = (loopIterations.get(id) || 0) + 1
    loopIterations.set(id, currentIteration)

    // Check max iterations
    if (currentIteration > maxIterations) {
        return {
            iteration: currentIteration,
            continueLoop: false,
            exitReason: 'max_iterations',
            loopedTo: targetNodeId
        }
    }

    return {
        iteration: currentIteration,
        continueLoop: true,
        exitReason: null,
        loopedTo: targetNodeId
    }
```

### 3. Loop Redirection in executeWorkflowGraph

```typescript
// After executing a node, check if it's a loop node that should redirect
if (startNode.type === 'temporalLoop') {
    const loopResult = context[startNode.id]

    if (loopResult.continueLoop) {
        const targetNodeId = startNode.data.loopToNodeId
        const targetNode = nodes.find((n) => n.id === targetNodeId)

        if (targetNode) {
            // Clear executed status for nodes in the loop path
            clearLoopPath(targetNodeId, startNode.id, nodes, edges, executed)

            // Continue execution from target node
            await executeWorkflowGraph(targetNode, nodes, edges, context, state, executed, executing)
        }
    }
    return // Don't follow normal outgoing edges
}
```

### 4. Helper Function: clearLoopPath

```typescript
function clearLoopPath(targetNodeId: string, loopNodeId: string, nodes: FlowNode[], edges: FlowEdge[], executed: Set<string>): void {
    // Find all nodes between target and loop node using BFS
    const nodesToClear = findNodesInPath(targetNodeId, loopNodeId, nodes, edges)

    for (const nodeId of nodesToClear) {
        executed.delete(nodeId)
    }
}

function findNodesInPath(startId: string, endId: string, nodes: FlowNode[], edges: FlowEdge[]): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const queue = [startId]

    while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current) || current === endId) continue

        visited.add(current)
        result.push(current)

        const outgoing = edges.filter((e) => e.source === current)
        for (const edge of outgoing) {
            if (!visited.has(edge.target)) {
                queue.push(edge.target)
            }
        }
    }

    return result
}
```

### 5. Topological Sort Modification

```typescript
// In topologicalSort.ts - filter out back-edges to loop nodes
export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    // Identify loop nodes
    const loopNodeIds = new Set(nodes.filter((n) => n.type === 'temporalLoop').map((n) => n.id))

    // Filter out edges that go TO loop nodes (these are intentional back-edges)
    const forwardEdges = edges.filter((e) => !loopNodeIds.has(e.target))

    // ... rest of topological sort using forwardEdges
}
```

## UI Components

### 1. LoopNode.jsx (New File)

```jsx
// Visual node with:
// - Brown color scheme (#795548)
// - IconRepeat icon
// - Shows target node label and max iterations
// - Single input handle (Position.Left), no output handle
```

### 2. Loop Configuration Dialog

```jsx
// In TemporalNodeConfigDialog.jsx, add case for 'temporalLoop':
// - Label field
// - Dropdown for target node (filter to upstream nodes only)
// - Max iterations number input (default 3)
// - Validation: target must be upstream node
```

### 3. Dashed Edge for Loop

```jsx
// In TemporalEdge.jsx:
// - Check if edge.data?.isLoopEdge === true
// - If true, use strokeDasharray="5,5" and brown color (#795548)
```

### 4. Automatic Loop Edge Detection

```jsx
// In TemporalCanvas.jsx onConnect:
// - When connecting TO a Loop node, mark edge as loop edge
// - Loop node's output should auto-create dashed edge to target
```

## Upstream Node Detection for Dropdown

```javascript
// Helper function to find upstream nodes
function getUpstreamNodes(nodeId, nodes, edges) {
    const upstream = new Set()
    const visited = new Set()
    const queue = []

    // Find all edges pointing TO this node
    const incomingEdges = edges.filter((e) => e.target === nodeId)
    for (const edge of incomingEdges) {
        queue.push(edge.source)
    }

    while (queue.length > 0) {
        const current = queue.shift()
        if (visited.has(current)) continue
        visited.add(current)
        upstream.add(current)

        // Find edges pointing to current
        const incoming = edges.filter((e) => e.target === current)
        for (const edge of incoming) {
            if (!visited.has(edge.source)) {
                queue.push(edge.source)
            }
        }
    }

    return nodes.filter((n) => upstream.has(n.id))
}
```

## Fix Temporal UI Link (Option C: Docker ARG + VITE env)

### Problem Analysis

-   `TemporalCanvas.jsx:392` uses `window.TEMPORAL_WEB_UI_URL || 'http://localhost:8233'` which is never set
-   Server config reads `TEMPORAL_WEB_UI_URL` env var but UI code uses `window.*` which is never injected
-   Default port is inconsistent (server: 8080, UI fallback: 8233)

### Solution: Build-time VITE env var with Docker ARG

| Scenario         | How It Works                                                                          |
| ---------------- | ------------------------------------------------------------------------------------- |
| **pnpm dev**     | User sets `VITE_TEMPORAL_WEB_UI_URL` in `packages/ui/.env` → Vite injects at dev time |
| **Docker build** | Pass `--build-arg VITE_TEMPORAL_WEB_UI_URL=http://...` → Vite injects at build time   |

### Dockerfile Changes

```dockerfile
# Add before RUN pnpm install && pnpm build
ARG VITE_TEMPORAL_WEB_UI_URL=http://localhost:8080
ENV VITE_TEMPORAL_WEB_UI_URL=$VITE_TEMPORAL_WEB_UI_URL
```

### Docker Compose Changes

```yaml
# In docker/docker-compose-queue-source.yml
flowise:
    build:
        context: ..
        dockerfile: Dockerfile
        args:
            - VITE_TEMPORAL_WEB_UI_URL=${VITE_TEMPORAL_WEB_UI_URL:-http://localhost:8080}
```

### UI Code Change

```javascript
const handleOpenTemporalUI = () => {
    const temporalWebUIUrl = import.meta.env.VITE_TEMPORAL_WEB_UI_URL || 'http://localhost:8080'
    window.open(temporalWebUIUrl, '_blank')
}
```

### Environment Documentation

**packages/ui/.env.example**:

```bash
# Temporal Web UI URL (for "Open in Temporal" button)
# VITE_TEMPORAL_WEB_UI_URL=http://localhost:8080
```

**docker/.env.example**:

```bash
# Temporal Web UI URL (UI build-time variable)
# NOTE: This is a BUILD-TIME variable for Docker. Pass via --build-arg or docker-compose build.args
# For local pnpm dev, set this in packages/ui/.env instead
# VITE_TEMPORAL_WEB_UI_URL=http://localhost:8080
```
