import { FlowNode, FlowEdge } from '../activities/fetchFlowDefinition'

/**
 * Performs topological sort on workflow nodes based on edges.
 * Returns nodes in execution order (respecting dependencies).
 */
export function topologicalSort(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    // Build adjacency list and in-degree map
    const adjacencyList = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    // Initialize all nodes
    for (const node of nodes) {
        adjacencyList.set(node.id, [])
        inDegree.set(node.id, 0)
    }

    // Build graph from edges
    for (const edge of edges) {
        const targets = adjacencyList.get(edge.source) || []
        targets.push(edge.target)
        adjacencyList.set(edge.source, targets)

        const currentInDegree = inDegree.get(edge.target) || 0
        inDegree.set(edge.target, currentInDegree + 1)
    }

    // Find nodes with no incoming edges (start nodes)
    const queue: string[] = []
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(nodeId)
        }
    }

    // Process nodes in topological order
    const sortedIds: string[] = []
    while (queue.length > 0) {
        const nodeId = queue.shift()!
        sortedIds.push(nodeId)

        const neighbors = adjacencyList.get(nodeId) || []
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 1) - 1
            inDegree.set(neighbor, newDegree)

            if (newDegree === 0) {
                queue.push(neighbor)
            }
        }
    }

    // Check for cycles
    if (sortedIds.length !== nodes.length) {
        throw new Error('Workflow contains a cycle - cannot determine execution order')
    }

    // Map IDs back to nodes
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    return sortedIds.map((id) => nodeMap.get(id)!).filter(Boolean)
}

/**
 * Gets the next nodes to execute after a given node.
 * For condition nodes, returns nodes based on the branch taken.
 */
export function getNextNodes(currentNodeId: string, edges: FlowEdge[], nodes: FlowNode[], conditionResult?: boolean): FlowNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const currentNode = nodeMap.get(currentNodeId)

    // Filter edges from current node
    let outgoingEdges = edges.filter((e) => e.source === currentNodeId)

    // For condition nodes, filter by the branch taken
    // Handle both 'condition' (legacy) and 'temporalCondition' node types
    const isConditionNode = currentNode?.type === 'condition' || currentNode?.type === 'temporalCondition'
    if (isConditionNode && conditionResult !== undefined) {
        const branchKey = conditionResult ? 'true' : 'false'
        // sourceHandle format is typically `${nodeId}-true` or `${nodeId}-false`
        // Use includes() to match regardless of prefix
        outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle?.includes(branchKey))
    }

    return outgoingEdges.map((e) => nodeMap.get(e.target)!).filter(Boolean)
}
