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
