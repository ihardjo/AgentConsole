/**
 * Type definitions for version comparison
 */

// Define ICommonObject locally to avoid triggering strict compilation of components package
export type ICommonObject = Record<string, any>

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations
// ─────────────────────────────────────────────────────────────────────────────

/** Severity of a version change, ordered from most to least severe. */
export enum ImpactLevel {
    Breaking = 'breaking',
    Major = 'major',
    Minor = 'minor',
    Patch = 'patch'
}

/** Whether a change represents an addition, removal, or in-place modification. */
export enum ChangeType {
    Added = 'added',
    Removed = 'removed',
    Modified = 'modified'
}

/** Logical category a change belongs to, matching the node form sections. */
export enum ChangeCategory {
    Model = 'model',
    Messages = 'messages',
    Tools = 'tools',
    Knowledge = 'knowledge',
    Memory = 'memory',
    Output = 'output',
    State = 'state',
    Scenarios = 'scenarios'
}

// ─────────────────────────────────────────────────────────────────────────────
// Core interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface IVersionChange {
    property: string
    /**
     * Category string for this change.
     * Agent/LLM nodes use ChangeCategory enum values; future node types
     * define their own category sets.
     */
    category: string
    changeType: ChangeType
    oldValue: any
    newValue: any
    description: string
    impact: ImpactLevel
}

export interface IVersionComparison {
    summary: {
        totalChanges: number
        modified: number
        added: number
        removed: number
        impactLevel: ImpactLevel
    }
    changes: IVersionChange[]
    /**
     * Changes grouped by category string.
     * The exact keys depend on the node type — use Object.entries() to iterate.
     * For Agent/LLM nodes the keys are the ChangeCategory enum values.
     * Future node types may use their own category sets.
     */
    categorizedChanges: Record<string, IVersionChange[]>
}

/**
 * Strongly-typed categorizedChanges shape for Agent nodes.
 * Use this when you need type-safe access to specific Agent category buckets.
 * For generic iteration prefer `IVersionComparison.categorizedChanges` directly.
 */
export type IAgentCategorizedChanges = {
    [ChangeCategory.Model]: IVersionChange[]
    [ChangeCategory.Messages]: IVersionChange[]
    [ChangeCategory.Tools]: IVersionChange[]
    [ChangeCategory.Knowledge]: IVersionChange[]
    [ChangeCategory.Memory]: IVersionChange[]
    [ChangeCategory.Output]: IVersionChange[]
    [ChangeCategory.State]: IVersionChange[]
}

/**
 * Strongly-typed categorizedChanges shape for LLM nodes.
 * LLM nodes do not use tools, knowledge, or state categories.
 * Use this when you need type-safe access to specific LLM category buckets.
 * For generic iteration prefer `IVersionComparison.categorizedChanges` directly.
 */
export type ILLMCategorizedChanges = {
    [ChangeCategory.Model]: IVersionChange[]
    [ChangeCategory.Messages]: IVersionChange[]
    [ChangeCategory.Memory]: IVersionChange[]
    [ChangeCategory.Output]: IVersionChange[]
}

/**
 * Strongly-typed categorizedChanges shape for ConditionAgent nodes.
 * Categories: model (provider + config), messages (instructions, input, system prompt),
 * and scenarios (the split conditions list).
 */
export type IConditionAgentCategorizedChanges = {
    [ChangeCategory.Model]: IVersionChange[]
    [ChangeCategory.Messages]: IVersionChange[]
    [ChangeCategory.Scenarios]: IVersionChange[]
}

/**
 * Per-node comparison result.
 * Wraps IVersionComparison with node identity and status.
 */
export interface INodeComparison {
    nodeId: string
    nodeName: string
    nodeType: string
    /** Internal component name used for icon lookup (e.g. 'agentAgentflow', 'llmAgentflow') */
    nodeComponentName: string
    /** Whether this node was added, removed, or modified between versions */
    nodeStatus: 'added' | 'removed' | 'modified' | 'unchanged'
    /** Detailed property-level comparison (null for purely added/removed nodes) */
    comparison: IVersionComparison | null
}

/**
 * Top-level flow comparison result returned by the API.
 * Contains an array of per-node comparisons plus an overall summary.
 */
export interface IFlowComparison {
    summary: {
        totalNodes: number
        nodesAdded: number
        nodesRemoved: number
        nodesModified: number
        nodesUnchanged: number
        totalPropertyChanges: number
        impactLevel: ImpactLevel
    }
    nodes: INodeComparison[]
}
