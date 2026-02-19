/**
 * Version Comparison Module
 * 
 * Main entry point for comparing different versions of nodes (Agent, LLM, etc.)
 * 
 * Usage:
 * ```typescript
 * import { NodeComparatorFactory } from './version-comparison'
 * 
 * const result = NodeComparatorFactory.compareVersions(versionA, versionB, 'Agent')
 * ```
 * 
 * @module version-comparison
 */

// Export types and enums
export type { ICommonObject, IVersionChange, IVersionComparison, INodeComparison, IFlowComparison } from './types'
export { ImpactLevel, ChangeType, ChangeCategory } from './types'

// Export base class and shared descriptors for extension
export { BaseNodeComparator, MODEL_CONFIG_FIELDS, MESSAGE_ROLES } from './BaseNodeComparator'
export type { FieldDescriptor } from './BaseNodeComparator'

// Export comparators for custom registration
export { AgentNodeComparator, LLMNodeComparator, ConditionAgentNodeComparator } from './comparators'

// Export main API (Factory with compareVersions method)
export { NodeComparatorFactory } from './NodeComparatorFactory'
