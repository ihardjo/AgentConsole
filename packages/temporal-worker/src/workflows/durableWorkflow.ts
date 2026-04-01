import { proxyActivities, defineSignal, defineQuery, setHandler, condition, sleep } from '@temporalio/workflow'
import type * as activities from '../activities'
import { FlowNode, FlowEdge } from '../activities/fetchFlowDefinition'
import { getNextNodes } from '../utils/topologicalSort'
import { resolveTemplate } from '../utils/templateResolver'
import { evaluateExpression } from '../utils/expressionEvaluator'

// Proxy activities with default retry policies
const acts = proxyActivities<typeof activities>({
    startToCloseTimeout: '10 minutes',
    retry: {
        maximumAttempts: 3,
        initialInterval: '1 second',
        maximumInterval: '1 minute',
        backoffCoefficient: 2
    }
})

export interface DurableWorkflowInput {
    flowId: string
    workspaceId: string
    input: Record<string, any>
}

export interface DurableWorkflowResult {
    success: boolean
    output: Record<string, any>
    error?: string
}

// Pending task structure for Human Task nodes
export interface PendingTask {
    taskId: string
    taskName: string
    role: string
    instructions: string
    signalName: string
    waitingSince: string
}

// Workflow state exposed via query
export interface WorkflowState {
    status: 'running' | 'completed' | 'failed'
    currentNodeId: string | null
    pendingTasks: PendingTask[]
    context: Record<string, any>
}

/**
 * Internal workflow state interface - passed to helper functions
 * to ensure each workflow execution has isolated state.
 */
interface InternalWorkflowState {
    receivedSignals: Map<string, any>
    collectedSignals: Map<string, Array<{ payload: any; receivedAt: string }>>
    pendingTasks: Map<string, PendingTask>
    workflowStatus: {
        status: 'running' | 'completed' | 'failed'
        currentNodeId: string | null
    }
}

// Define built-in query for workflow state
const getWorkflowStateQuery = defineQuery<WorkflowState>('getWorkflowState')

/**
 * Input variable schema definition (from Start node configuration)
 */
export interface InputVariable {
    name: string
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required: boolean
    defaultValue?: any
    description?: string
}

/**
 * Validation result from input validation
 */
interface ValidationResult {
    input: Record<string, any>
    errors: string[]
}

/**
 * Validates and coerces workflow input against the defined schema.
 * - Applies default values for missing optional fields
 * - Validates required fields are present
 * - Coerces types (string to number, string to boolean, JSON parsing)
 */
function validateAndCoerceInput(input: Record<string, any>, schema: InputVariable[]): ValidationResult {
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
                const parsed = JSON.parse(value)
                if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                    errors.push(`${variable.name} must be a valid JSON object`)
                } else {
                    coerced[variable.name] = parsed
                }
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
        } else if (variable.type === 'string') {
            // String type accepts any value, coerce to string if needed
            if (typeof value !== 'string') {
                coerced[variable.name] = String(value)
            }
        }
    }

    return { input: coerced, errors }
}

/**
 * Main durable workflow executor that interprets visual flow definitions.
 * Fetches the flow graph and executes nodes in topological order.
 *
 * IMPORTANT: All state variables are declared inside this function to ensure
 * each workflow execution has isolated state (Temporal determinism requirement).
 */
export async function durableWorkflowExecutor(params: DurableWorkflowInput): Promise<DurableWorkflowResult> {
    const { flowId, workspaceId, input } = params

    // FIXED: State variables are now scoped to this workflow execution
    // This ensures each execution has isolated state (Temporal determinism)
    const receivedSignals = new Map<string, any>()
    const collectedSignals = new Map<string, Array<{ payload: any; receivedAt: string }>>()
    const pendingTasks = new Map<string, PendingTask>()
    const workflowStatus: { status: 'running' | 'completed' | 'failed'; currentNodeId: string | null } = {
        status: 'running',
        currentNodeId: null
    }

    // Create internal state object to pass to helper functions
    const internalState: InternalWorkflowState = {
        receivedSignals,
        collectedSignals,
        pendingTasks,
        workflowStatus
    }

    // Initialize execution context
    const context: Record<string, any> = {
        input,
        workspaceId
    }

    // Register built-in query handler for workflow state
    setHandler(getWorkflowStateQuery, () => ({
        status: workflowStatus.status,
        currentNodeId: workflowStatus.currentNodeId,
        pendingTasks: Array.from(pendingTasks.values()),
        context: sanitizeContext(context)
    }))

    try {
        // Fetch the flow definition
        const flow = await acts.fetchFlowDefinition({ flowId, workspaceId })
        const { nodes, edges } = flow.flowData

        // Find the Start node to begin execution
        const startNode = nodes.find((n) => n.type === 'temporalStart' || n.type === 'start')
        if (!startNode) {
            throw new Error('Workflow must have a Start node')
        }

        // Validate input against schema from Start node
        const inputVariables: InputVariable[] = startNode.data?.inputVariables || []

        if (inputVariables.length > 0) {
            const { input: validatedInput, errors } = validateAndCoerceInput(input, inputVariables)
            if (errors.length > 0) {
                throw new Error(`Input validation failed:\n${errors.join('\n')}`)
            }
            // Apply coerced input to context
            context.input = validatedInput
        }

        // Set up signal handlers for Human Task nodes
        for (const node of nodes) {
            if (node.type === 'temporalHumanTask') {
                const signalName = node.data.signalName || `task_${node.id}`
                const signal = defineSignal<[any]>(signalName)
                setHandler(signal, (payload: any) => {
                    receivedSignals.set(node.id, payload)
                })
            }
            // Set up signal handlers for Collect Signals nodes
            if (node.type === 'temporalCollectSignals') {
                const signalName = node.data.signalName || `collect_${node.id}`
                const signal = defineSignal<[any]>(signalName)
                setHandler(signal, (payload: any) => {
                    const existing = collectedSignals.get(node.id) || []
                    existing.push({
                        payload,
                        receivedAt: new Date().toISOString()
                    })
                    collectedSignals.set(node.id, existing)
                })
            }
        }

        // Execute workflow graph starting from the Start node
        // This traverses the graph following condition branches correctly
        await executeWorkflowGraph(startNode, nodes, edges, context, internalState)

        workflowStatus.status = 'completed'
        workflowStatus.currentNodeId = null

        return {
            success: true,
            output: context
        }
    } catch (error: any) {
        workflowStatus.status = 'failed'
        return {
            success: false,
            output: context,
            error: error.message || String(error)
        }
    }
}

/**
 * Sanitize context for query response (exclude internal fields)
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}
    for (const [key, value] of Object.entries(context)) {
        // Exclude internal fields and sensitive data
        if (key !== 'workspaceId' && !key.startsWith('_')) {
            sanitized[key] = value
        }
    }
    return sanitized
}

/**
 * Executes a single node based on its type
 */
async function executeNode(
    node: FlowNode,
    context: Record<string, any>,
    edges: FlowEdge[],
    nodes: FlowNode[],
    state: InternalWorkflowState
): Promise<any> {
    const { type, data, id } = node
    const { receivedSignals, collectedSignals, pendingTasks } = state

    switch (type) {
        case 'start':
        case 'temporalStart':
            // Start node just passes through input
            return {
                ...context.input,
                startedAt: new Date().toISOString()
            }

        case 'agentFlowCall':
        case 'temporalAgentFlowCall':
            // Call existing AgentFlow via Flowise API
            const question = resolveTemplate(data.question || data.questionTemplate || '', context)
            const overrideConfig = data.overrideConfig ? resolveTemplate(data.overrideConfig, context) : undefined

            return await acts.callAgentFlow({
                agentFlowId: data.agentFlowId,
                question,
                workspaceId: context.workspaceId,
                apiKeyId: data.apiKeyId,
                overrideConfig,
                sessionId: data.sessionId
            })

        case 'timer':
        case 'temporalTimer':
            // Wait for specified duration
            const duration = resolveTemplate(data.duration || '1m', context)
            const ms = parseDuration(duration)
            await sleep(ms)
            return {
                completed: true,
                duration,
                durationMs: ms,
                completedAt: new Date().toISOString()
            }

        case 'temporalHumanTask':
            // Human Task - wait for human to complete via signal
            const taskSignalName = data.signalName || `task_${id}`

            // Register this task in pending tasks (for query)
            pendingTasks.set(id, {
                taskId: id,
                taskName: data.taskName || 'Unnamed Task',
                role: data.assignedRole || '',
                instructions: data.instructions || '',
                signalName: taskSignalName,
                waitingSince: new Date().toISOString()
            })

            // Wait for completion signal with optional timeout
            const humanTaskTimeoutMs = data.timeout ? parseDuration(data.timeout) : null
            let humanTaskCompleted: boolean
            if (humanTaskTimeoutMs) {
                humanTaskCompleted = await condition(() => receivedSignals.has(id), humanTaskTimeoutMs)
            } else {
                await condition(() => receivedSignals.has(id))
                humanTaskCompleted = true
            }

            // Remove from pending tasks
            pendingTasks.delete(id)

            if (!humanTaskCompleted) {
                if (data.timeoutBehavior === 'fail') {
                    throw new Error(`Human task "${data.taskName}" timed out`)
                }
                return {
                    timedOut: true,
                    taskName: data.taskName,
                    completedAt: new Date().toISOString()
                }
            }

            const humanTaskData = receivedSignals.get(id)
            receivedSignals.delete(id) // Clean up

            return {
                taskName: data.taskName,
                data: humanTaskData,
                completedAt: new Date().toISOString()
            }

        case 'temporalCollectSignals':
            // Collect multiple signals before continuing
            const collectSignalName = data.signalName || `collect_${id}`
            const requiredCount = data.requiredCount || 2

            // Initialize collected signals array if not exists
            if (!collectedSignals.has(id)) {
                collectedSignals.set(id, [])
            }

            // Wait until required count reached or timeout
            const collectTimeoutMs = data.timeout ? parseDuration(data.timeout) : null
            let reachedCount: boolean
            if (collectTimeoutMs) {
                reachedCount = await condition(() => (collectedSignals.get(id)?.length || 0) >= requiredCount, collectTimeoutMs)
            } else {
                await condition(() => (collectedSignals.get(id)?.length || 0) >= requiredCount)
                reachedCount = true
            }

            const collected = collectedSignals.get(id) || []
            collectedSignals.delete(id) // Clean up

            return {
                signalName: collectSignalName,
                collected,
                count: collected.length,
                requiredCount,
                complete: reachedCount,
                completedAt: new Date().toISOString()
            }

        case 'condition':
        case 'temporalCondition':
            // Evaluate condition expression
            const expression = resolveTemplate(data.expression || '', context)
            const result = evaluateExpression(expression, context)

            return {
                expression,
                result,
                branch: result ? 'true' : 'false'
            }

        case 'httpRequest':
        case 'temporalHTTPRequest':
            // Make HTTP request
            const url = resolveTemplate(data.url || '', context)
            const method = data.method || 'GET'
            const headers = data.headers ? resolveTemplate(data.headers, context) : undefined
            const body = data.body ? resolveTemplate(data.body, context) : undefined

            return await acts.httpRequest({
                url,
                method,
                headers,
                body,
                timeout: data.timeout ? parseDuration(data.timeout) : 30000
            })

        default:
            console.warn(`Unknown node type: ${type}`)
            return { skipped: true, reason: `Unknown node type: ${type}` }
    }
}

/**
 * Executes the workflow graph starting from a given node.
 * Uses recursive traversal to follow the correct branches based on condition results.
 *
 * Key behaviors:
 * - For condition nodes: only follows the branch matching the condition result (true/false)
 * - For non-condition nodes: executes all downstream nodes in parallel using Promise.all()
 * - For join nodes: waits for all incoming dependencies to complete before executing
 * - Tracks executed nodes to avoid re-execution
 */
async function executeWorkflowGraph(
    startNode: FlowNode,
    nodes: FlowNode[],
    edges: FlowEdge[],
    context: Record<string, any>,
    state: InternalWorkflowState,
    executed: Set<string> = new Set(),
    executing: Map<string, Promise<any>> = new Map()
): Promise<void> {
    // Skip if already executed or currently executing
    if (executed.has(startNode.id)) {
        return
    }

    // Check if this node is already being executed (parallel path reaching same node)
    if (executing.has(startNode.id)) {
        await executing.get(startNode.id)
        return
    }

    // Check if all dependencies (incoming edges) are satisfied
    const incomingEdges = edges.filter((e) => e.target === startNode.id)
    for (const edge of incomingEdges) {
        // Skip if the source hasn't been executed yet AND it's not a skipped branch
        // A skipped branch is one where the condition node was executed but took the other path
        if (!executed.has(edge.source)) {
            // Check if this is a skipped branch from a condition node
            const sourceNode = nodes.find((n) => n.id === edge.source)
            const isConditionSource = sourceNode?.type === 'condition' || sourceNode?.type === 'temporalCondition'

            if (isConditionSource && context[edge.source]) {
                // Condition was executed - check if this edge was the taken branch
                const conditionResult = context[edge.source].result
                const branchKey = conditionResult ? 'true' : 'false'
                const isTakenBranch = edge.sourceHandle?.includes(branchKey)

                if (!isTakenBranch) {
                    // This is a skipped branch - don't wait for it
                    continue
                }
            }

            // Dependency not yet executed, can't proceed
            // (This shouldn't happen if we traverse correctly, but safety check)
            return
        }
    }

    // Execute this node
    state.workflowStatus.currentNodeId = startNode.id

    const executePromise = (async () => {
        const result = await executeNode(startNode, context, edges, nodes, state)
        context[startNode.id] = result
        executed.add(startNode.id)
        return result
    })()

    executing.set(startNode.id, executePromise)

    const result = await executePromise

    // Determine next nodes to execute
    const isConditionNode = startNode.type === 'condition' || startNode.type === 'temporalCondition'
    const conditionResult = isConditionNode ? result?.result : undefined

    const nextNodes = getNextNodes(startNode.id, edges, nodes, conditionResult)

    // Execute next nodes
    if (nextNodes.length === 0) {
        // End of this branch
        return
    }

    if (nextNodes.length === 1) {
        // Single path - sequential execution
        await executeWorkflowGraph(nextNodes[0], nodes, edges, context, state, executed, executing)
    } else {
        // Multiple paths - parallel execution (for non-condition nodes)
        // or filtered single path (for condition nodes)
        await Promise.all(nextNodes.map((node) => executeWorkflowGraph(node, nodes, edges, context, state, executed, executing)))
    }
}

/**
 * Parses duration strings like "5m", "1h", "30s", "1d" into milliseconds
 */
function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/)
    if (!match) {
        // Try parsing as number (assume milliseconds)
        const num = parseInt(duration, 10)
        if (!isNaN(num)) return num
        throw new Error(`Invalid duration format: ${duration}`)
    }

    const [, value, unit] = match
    const num = parseInt(value, 10)

    switch (unit) {
        case 'ms':
            return num
        case 's':
            return num * 1000
        case 'm':
            return num * 60 * 1000
        case 'h':
            return num * 60 * 60 * 1000
        case 'd':
            return num * 24 * 60 * 60 * 1000
        default:
            return num
    }
}
