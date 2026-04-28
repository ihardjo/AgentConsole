/**
 * Output schemas for each temporal node type.
 * These define what variables are available from each node's execution result.
 */
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
    ],

    temporalLoop: [
        { name: 'iteration', type: 'number', description: 'Current iteration count (1-based)' },
        { name: 'loopedTo', type: 'string', description: 'Target node ID that was looped to' },
        { name: 'continueLoop', type: 'boolean', description: 'Whether the loop continued' },
        { name: 'exitReason', type: 'string', description: 'Why loop exited (null or max_iterations)' }
    ],

    temporalNotification: [
        { name: 'sent', type: 'boolean', description: 'Whether notification was sent successfully' },
        { name: 'channels', type: 'array', description: 'Channels used (email, sms, webhook)' },
        { name: 'results', type: 'object', description: 'Per-channel send results' },
        { name: 'sentAt', type: 'string', description: 'Notification sent timestamp' }
    ],

    temporalParallel: [
        { name: 'mode', type: 'string', description: 'Fork or join mode' },
        { name: 'branchCount', type: 'number', description: 'Number of parallel branches' },
        { name: 'results', type: 'array', description: 'Results from all branches (join only)' },
        { name: 'completedAt', type: 'string', description: 'Completion timestamp' }
    ],

    temporalSubWorkflow: [
        { name: 'workflowId', type: 'string', description: 'Child workflow ID' },
        { name: 'runId', type: 'string', description: 'Child workflow run ID' },
        { name: 'result', type: 'object', description: 'Child workflow result (if waited)' },
        { name: 'status', type: 'string', description: 'Child workflow status' },
        { name: 'completedAt', type: 'string', description: 'Completion timestamp' }
    ]
}

/**
 * Get output schema for a specific node type.
 * @param {string} nodeType - The temporal node type
 * @returns {Array} Array of output field definitions
 */
export const getNodeOutputSchema = (nodeType) => {
    return TEMPORAL_NODE_OUTPUTS[nodeType] || []
}
