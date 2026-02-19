import { BaseNodeComparator } from '../BaseNodeComparator'
import { ICommonObject } from '../types'

/**
 * Comparator for LLM nodes (type: 'llmAgentflow')
 * Tracks all inputs defined in packages/components/nodes/agentflow/LLM/LLM.ts
 *
 * Delegates shared patterns (model config, role messages, memory, structured output,
 * key/value state) to the protected helpers in BaseNodeComparator.
 * LLM has no tools or knowledge — those overrides are intentional no-ops.
 */
export class LLMNodeComparator extends BaseNodeComparator {
    // ─────────────────────────────────────────────────────────────────────────
    // MODEL
    // ─────────────────────────────────────────────────────────────────────────
    compareModel(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareModelConfig(versionA, versionB, 'llmModel', 'llmModelConfig', 'LLM')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES
    // ─────────────────────────────────────────────────────────────────────────
    compareMessages(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareRoleMessages(versionA, versionB, 'llmMessages', 'llmUserMessage')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOOLS — LLM nodes do not support tools
    // ─────────────────────────────────────────────────────────────────────────
    compareTools(_versionA: ICommonObject, _versionB: ICommonObject): void {
        // Intentionally empty — LLM nodes do not have tools
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KNOWLEDGE — LLM nodes do not support knowledge sources
    // ─────────────────────────────────────────────────────────────────────────
    compareKnowledge(_versionA: ICommonObject, _versionB: ICommonObject): void {
        // Intentionally empty — LLM nodes do not have knowledge sources
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEMORY
    // ─────────────────────────────────────────────────────────────────────────
    compareMemory(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareMemoryFields(versionA, versionB, 'llm')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OUTPUT
    // ─────────────────────────────────────────────────────────────────────────
    compareOutput(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareStructuredOutput(versionA, versionB, 'llmStructuredOutput', 'llmReturnResponseAs')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────
    compareState(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareKeyValueState(versionA, versionB, 'llmUpdateState')
    }
}
