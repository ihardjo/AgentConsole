/**
 * Helper functions for Temporal workflow variable resolution.
 */

import { TEMPORAL_NODE_OUTPUTS } from '@/views/temporalflows/temporalNodeOutputs'

/**
 * Get upstream nodes that are connected (directly or indirectly) to the target node.
 * This traverses the graph backwards from the target node to find all nodes whose
 * outputs could be used as variables.
 *
 * @param {Array} nodes - All nodes in the workflow
 * @param {Array} edges - All edges in the workflow
 * @param {string} targetNodeId - The node ID we're finding variables for
 * @returns {Array} Array of upstream nodes (excluding the target itself)
 */
export const getAvailableTemporalNodes = (nodes, edges, targetNodeId) => {
    const upstreamNodes = []

    function collectUpstream(nodeId, visited = new Set()) {
        if (visited.has(nodeId)) return
        visited.add(nodeId)

        // Find all edges where this node is the target
        const incomingEdges = edges.filter((e) => e.target === nodeId)

        for (const edge of incomingEdges) {
            const sourceNode = nodes.find((n) => n.id === edge.source)
            if (sourceNode && !upstreamNodes.find((n) => n.id === sourceNode.id)) {
                upstreamNodes.push(sourceNode)
                // Recursively collect upstream nodes from this source
                collectUpstream(sourceNode.id, visited)
            }
        }
    }

    collectUpstream(targetNodeId)
    return upstreamNodes
}

/**
 * Get a friendly display label for a node.
 * Uses the node's label (without whitespace) for display purposes.
 *
 * @param {object} node - The node object
 * @returns {string} A display-friendly label
 */
export const getNodeDisplayLabel = (node) => {
    if (!node) return ''

    // Use the custom label if set, otherwise fall back to default labels
    const label = node.data?.label || ''
    if (label) {
        // Remove whitespace for use in variable paths
        return label.replace(/\s+/g, '')
    }

    // Default labels based on node type
    switch (node.type) {
        case 'temporalStart':
            return 'Start'
        case 'temporalAgentFlowCall':
            return 'AgentFlowCall'
        case 'temporalTimer':
            return 'Timer'
        case 'temporalHumanTask':
            return 'HumanTask'
        case 'temporalCollectSignals':
            return 'CollectSignals'
        case 'temporalCondition':
            return 'Condition'
        case 'temporalHTTPRequest':
            return 'HTTPRequest'
        case 'temporalNotification':
            return 'Notification'
        case 'temporalParallel':
            return 'Parallel'
        case 'temporalSubWorkflow':
            return 'SubWorkflow'
        default:
            return node.type || 'Node'
    }
}

/**
 * Build a list of all available variables for autocomplete.
 * Includes:
 * - Input variables from the Start node
 * - Output fields from upstream nodes
 *
 * @param {Array} nodes - All nodes in the workflow
 * @param {Array} edges - All edges in the workflow
 * @param {string} targetNodeId - The current node we're editing
 * @returns {Array} Array of variable options for autocomplete
 */
export const getAvailableVariables = (nodes, edges, targetNodeId) => {
    const variables = []

    // Find the Start node to get input variables
    const startNode = nodes.find((n) => n.type === 'temporalStart')
    if (startNode?.data?.inputVariables?.length > 0) {
        for (const inputVar of startNode.data.inputVariables) {
            if (inputVar.name) {
                variables.push({
                    category: 'Input Variables',
                    displayLabel: `input.${inputVar.name}`,
                    actualPath: `input.${inputVar.name}`,
                    type: inputVar.type,
                    description: inputVar.description || `Input variable (${inputVar.type})`,
                    required: inputVar.required
                })
            }
        }
    }

    // Get upstream nodes
    const upstreamNodes = getAvailableTemporalNodes(nodes, edges, targetNodeId)

    // For each upstream node, add its output fields as variables
    for (const node of upstreamNodes) {
        const outputSchema = TEMPORAL_NODE_OUTPUTS[node.type] || []
        const displayLabel = getNodeDisplayLabel(node)

        for (const output of outputSchema) {
            variables.push({
                category: 'Node Outputs',
                displayLabel: `${displayLabel}.${output.name}`,
                // Store actual node ID for runtime resolution
                actualPath: `${node.id}.${output.name}`,
                type: output.type,
                description: output.description,
                nodeId: node.id,
                nodeLabel: displayLabel
            })
        }
    }

    return variables
}

/**
 * Convert a display variable path to the actual stored format.
 * Display: CreditAnalysis.text
 * Stored: {{temporalAgentFlowCall_1711871234567.text}}
 *
 * @param {string} displayPath - The user-friendly display path
 * @param {Array} variables - The available variables list
 * @returns {string} The actual template string to store
 */
export const displayPathToActualPath = (displayPath, variables) => {
    const variable = variables.find((v) => v.displayLabel === displayPath)
    if (variable) {
        return `{{${variable.actualPath}}}`
    }
    // If not found, return as-is (might be a direct path)
    return `{{${displayPath}}}`
}

/**
 * Parse a template string to extract variable references.
 *
 * @param {string} template - The template string (e.g., "Hello {{input.name}}")
 * @returns {Array} Array of variable paths found in the template
 */
export const extractVariableReferences = (template) => {
    if (!template || typeof template !== 'string') return []

    const regex = /\{\{([^}]+)\}\}/g
    const matches = []
    let match

    while ((match = regex.exec(template)) !== null) {
        matches.push(match[1].trim())
    }

    return matches
}
