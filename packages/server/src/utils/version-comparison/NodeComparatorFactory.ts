import { BaseNodeComparator } from './BaseNodeComparator'
import { AgentNodeComparator, LLMNodeComparator, ConditionAgentNodeComparator } from './comparators'
import type { ICommonObject, IVersionChange, IVersionComparison, INodeComparison, IFlowComparison } from './types'
import { ImpactLevel, ChangeType } from './types'

/**
 * Factory to create appropriate comparator based on node type.
 * Uses Strategy Pattern to instantiate the correct comparator.
 *
 * This is the main entry point for version comparison.
 */
export class NodeComparatorFactory {
    private static comparators: Map<string, BaseNodeComparator> = new Map<string, BaseNodeComparator>([
        ['Agent', new AgentNodeComparator()],
        ['LLM', new LLMNodeComparator()],
        ['ConditionAgent', new ConditionAgentNodeComparator()]
    ])

    /**
     * Get comparator for a specific node type
     * @param nodeType - The type of node (e.g., 'Agent', 'LLM')
     * @returns The appropriate comparator instance
     */
    static getComparator(nodeType: string): BaseNodeComparator {
        const comparator = this.comparators.get(nodeType)
        if (!comparator) {
            // Default to Agent comparator for unknown types
            return this.comparators.get('Agent')!
        }
        return comparator
    }

    /**
     * Compare two versions and return comprehensive analysis
     * This is the main public API for version comparison
     * 
     * @param versionA - First version data
     * @param versionB - Second version data
     * @param nodeType - Node type (e.g., 'Agent', 'LLM'). Defaults to 'Agent'
     * @returns Comprehensive comparison result with summary and categorized changes
     */
    static compareVersions(versionA: ICommonObject, versionB: ICommonObject, nodeType: string = 'Agent'): IVersionComparison {
        // Get the appropriate comparator for the node type
        const comparator = this.getComparator(nodeType)

        // Perform the comparison
        const changes = comparator.compare(versionA, versionB)

        // Build and return the result
        return this.buildComparisonResult(changes)
    }

    /**
     * Register a new comparator for a custom node type
     * Allows runtime extension of supported node types
     * @param nodeType - The node type to register
     * @param comparator - The comparator instance
     */
    static registerComparator(nodeType: string, comparator: BaseNodeComparator): void {
        this.comparators.set(nodeType, comparator)
    }

    /**
     * Get all registered node types
     * @returns Array of registered node type names
     */
    static getRegisteredTypes(): string[] {
        return Array.from(this.comparators.keys())
    }

    /**
     * Build the final comparison result with summary and categorization
     * @param changes - Array of version changes
     * @returns Structured comparison result
     */
    private static buildComparisonResult(changes: IVersionChange[]): IVersionComparison {
        const modified = changes.filter((c) => c.changeType === ChangeType.Modified).length
        const added = changes.filter((c) => c.changeType === ChangeType.Added).length
        const removed = changes.filter((c) => c.changeType === ChangeType.Removed).length

        let impactLevel: ImpactLevel = ImpactLevel.Patch
        if (changes.some((c) => c.impact === ImpactLevel.Breaking)) {
            impactLevel = ImpactLevel.Breaking
        } else if (changes.some((c) => c.impact === ImpactLevel.Major)) {
            impactLevel = ImpactLevel.Major
        } else if (changes.some((c) => c.impact === ImpactLevel.Minor)) {
            impactLevel = ImpactLevel.Minor
        }

        const categorizedChanges: Record<string, IVersionChange[]> = {}
        for (const change of changes) {
            if (!categorizedChanges[change.category]) {
                categorizedChanges[change.category] = []
            }
            categorizedChanges[change.category].push(change)
        }

        return {
            summary: {
                totalChanges: changes.length,
                modified,
                added,
                removed,
                impactLevel
            },
            changes,
            categorizedChanges
        }
    }

    // ------------------------------------------------------------------
    //  Multi-node flow comparison
    // ------------------------------------------------------------------

    /**
     * Compare all nodes between two flow versions.
     *
     * Nodes are matched by their `id` field. For each node the method determines
     * whether it was added, removed, modified (with property-level diff) or
     * unchanged.
     *
     * @param nodesA - Array of nodes from version A (each node has { id, data })
     * @param nodesB - Array of nodes from version B
     * @returns A flow-level comparison result grouped by node
     */
    static compareFlows(nodesA: ICommonObject[], nodesB: ICommonObject[]): IFlowComparison {
        const nodeMapA = new Map<string, ICommonObject>(nodesA.map((n) => [n.id, n]))
        const nodeMapB = new Map<string, ICommonObject>(nodesB.map((n) => [n.id, n]))

        const allNodeIds = new Set([...nodeMapA.keys(), ...nodeMapB.keys()])
        const nodeComparisons: INodeComparison[] = []

        for (const nodeId of allNodeIds) {
            const nodeA = nodeMapA.get(nodeId)
            const nodeB = nodeMapB.get(nodeId)

            if (!nodeA && nodeB) {
                // Node was added in version B
                nodeComparisons.push({
                    nodeId,
                    nodeName: nodeB.data?.label || nodeB.data?.name || nodeId,
                    nodeType: nodeB.data?.type || 'Unknown',
                    nodeComponentName: nodeB.data?.name || '',
                    nodeStatus: 'added',
                    comparison: null
                })
            } else if (nodeA && !nodeB) {
                // Node was removed in version B
                nodeComparisons.push({
                    nodeId,
                    nodeName: nodeA.data?.label || nodeA.data?.name || nodeId,
                    nodeType: nodeA.data?.type || 'Unknown',
                    nodeComponentName: nodeA.data?.name || '',
                    nodeStatus: 'removed',
                    comparison: null
                })
            } else if (nodeA && nodeB) {
                const nodeType = nodeA.data?.type || 'Unknown'
                const nodeName = nodeB.data?.label || nodeB.data?.name || nodeA.data?.label || nodeA.data?.name || nodeId
                const nodeComponentName = nodeB.data?.name || nodeA.data?.name || ''

                // Only run property-level comparison for supported node types
                if (this.comparators.has(nodeType)) {
                    const comparison = this.compareVersions(nodeA.data, nodeB.data, nodeType)
                    const status = comparison.summary.totalChanges > 0 ? 'modified' : 'unchanged'

                    nodeComparisons.push({
                        nodeId,
                        nodeName,
                        nodeType,
                        nodeComponentName,
                        nodeStatus: status,
                        comparison: status === 'modified' ? comparison : null
                    })
                } else {
                    // For unsupported types, do a shallow JSON comparison
                    const isEqual = JSON.stringify(nodeA.data) === JSON.stringify(nodeB.data)

                    nodeComparisons.push({
                        nodeId,
                        nodeName,
                        nodeType,
                        nodeComponentName,
                        nodeStatus: isEqual ? 'unchanged' : 'modified',
                        comparison: null
                    })
                }
            }
        }

        // Sort: modified first, then added, removed, unchanged
        const statusOrder: Record<string, number> = { modified: 0, added: 1, removed: 2, unchanged: 3 }
        nodeComparisons.sort((a, b) => (statusOrder[a.nodeStatus] ?? 4) - (statusOrder[b.nodeStatus] ?? 4))

        // Build flow-level summary
        const nodesAdded = nodeComparisons.filter((n) => n.nodeStatus === 'added').length
        const nodesRemoved = nodeComparisons.filter((n) => n.nodeStatus === 'removed').length
        const nodesModified = nodeComparisons.filter((n) => n.nodeStatus === 'modified').length
        const nodesUnchanged = nodeComparisons.filter((n) => n.nodeStatus === 'unchanged').length
        const totalPropertyChanges = nodeComparisons.reduce((sum, n) => sum + (n.comparison?.summary?.totalChanges ?? 0), 0)

        let impactLevel: ImpactLevel = ImpactLevel.Patch
        if (nodesRemoved > 0) {
            impactLevel = ImpactLevel.Breaking
        } else {
            const impactPriority: Record<ImpactLevel, number> = {
                [ImpactLevel.Breaking]: 0,
                [ImpactLevel.Major]: 1,
                [ImpactLevel.Minor]: 2,
                [ImpactLevel.Patch]: 3
            }
            for (const nc of nodeComparisons) {
                if (!nc.comparison) continue
                const level = nc.comparison.summary.impactLevel
                if (impactPriority[level] < impactPriority[impactLevel]) {
                    impactLevel = level
                }
                if (impactLevel === ImpactLevel.Breaking) break
            }
        }

        return {
            summary: {
                totalNodes: allNodeIds.size,
                nodesAdded,
                nodesRemoved,
                nodesModified,
                nodesUnchanged,
                totalPropertyChanges,
                impactLevel
            },
            nodes: nodeComparisons
        }
    }
}
