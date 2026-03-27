import { proxyActivities, defineSignal, setHandler, condition, sleep } from '@temporalio/workflow'
import type * as activities from '../activities'
import { FlowNode, FlowEdge } from '../activities/fetchFlowDefinition'
import { topologicalSort, getNextNodes } from '../utils/topologicalSort'
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

// Signal definitions for external events
const signalHandlers = new Map<string, (data: any) => void>()
const receivedSignals = new Map<string, any>()

/**
 * Main durable workflow executor that interprets visual flow definitions.
 * Fetches the flow graph and executes nodes in topological order.
 */
export async function durableWorkflowExecutor(params: DurableWorkflowInput): Promise<DurableWorkflowResult> {
    const { flowId, workspaceId, input } = params

    // Initialize execution context
    const context: Record<string, any> = {
        input,
        workspaceId
    }

    try {
        // Fetch the flow definition
        const flow = await acts.fetchFlowDefinition({ flowId, workspaceId })
        const { nodes, edges } = flow.flowData

        // Set up signal handlers for all SignalWait nodes
        for (const node of nodes) {
            if (node.type === 'signalWait' || node.type === 'temporalSignalWait') {
                const signalName = node.data.signalName || `signal_${node.id}`
                defineSignal(signalName)
                setHandler(signalName, (data: any) => {
                    receivedSignals.set(node.id, data)
                })
            }
        }

        // Get execution order using topological sort
        const executionOrder = topologicalSort(nodes, edges)

        // Execute nodes in order
        for (const node of executionOrder) {
            const result = await executeNode(node, context, edges, nodes)
            context[node.id] = result
        }

        return {
            success: true,
            output: context
        }
    } catch (error: any) {
        return {
            success: false,
            output: context,
            error: error.message || String(error)
        }
    }
}

/**
 * Executes a single node based on its type
 */
async function executeNode(node: FlowNode, context: Record<string, any>, edges: FlowEdge[], nodes: FlowNode[]): Promise<any> {
    const { type, data, id } = node

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

        case 'signalWait':
        case 'temporalSignalWait':
            // Wait for external signal
            const timeoutMs = data.timeout ? parseDuration(data.timeout) : undefined

            if (timeoutMs) {
                const received = await condition(() => receivedSignals.has(id), timeoutMs)
                if (!received) {
                    return {
                        timedOut: true,
                        signalName: data.signalName,
                        completedAt: new Date().toISOString()
                    }
                }
            } else {
                await condition(() => receivedSignals.has(id))
            }

            const signalData = receivedSignals.get(id)
            receivedSignals.delete(id) // Clean up

            return {
                signalName: data.signalName,
                data: signalData,
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
