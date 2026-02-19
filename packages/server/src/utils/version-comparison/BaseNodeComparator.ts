import { ICommonObject, IVersionChange, ImpactLevel, ChangeType, ChangeCategory } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared field descriptors used by the protected helper methods.
// Concrete comparators pass their node-specific prefix to the helpers.
// ─────────────────────────────────────────────────────────────────────────────

/** Descriptor for a single config field comparison. */
export interface FieldDescriptor {
    key: string
    label: string
    impact: ImpactLevel
}

/** Common model-config fields shared across Agent, LLM, ConditionAgent, etc. */
export const MODEL_CONFIG_FIELDS: FieldDescriptor[] = [
    { key: 'modelName', label: 'Model Name', impact: ImpactLevel.Major },
    { key: 'temperature', label: 'Temperature', impact: ImpactLevel.Minor },
    { key: 'maxOutputTokens', label: 'Max Tokens', impact: ImpactLevel.Minor },
    { key: 'streaming', label: 'Streaming', impact: ImpactLevel.Patch },
    { key: 'topP', label: 'Top P', impact: ImpactLevel.Minor },
    { key: 'topK', label: 'Top K', impact: ImpactLevel.Minor },
    { key: 'maxRetries', label: 'Max Retries', impact: ImpactLevel.Patch },
    { key: 'seed', label: 'Seed', impact: ImpactLevel.Patch },
    { key: 'frequencyPenalty', label: 'Frequency Penalty', impact: ImpactLevel.Minor },
    { key: 'presencePenalty', label: 'Presence Penalty', impact: ImpactLevel.Minor },
    { key: 'baseURL', label: 'Base URL', impact: ImpactLevel.Major }
]

/** Role descriptors for per-role message comparison. */
export const MESSAGE_ROLES: Array<{ role: string; label: string; impact: ImpactLevel }> = [
    { role: 'system', label: 'System Message', impact: ImpactLevel.Major },
    { role: 'developer', label: 'Developer Message', impact: ImpactLevel.Major },
    { role: 'assistant', label: 'Assistant Message', impact: ImpactLevel.Minor },
    { role: 'user', label: 'User Message (Preset)', impact: ImpactLevel.Minor }
]

/** Structured output sub-field descriptors. */
const STRUCTURED_OUTPUT_PROPS: Array<{ k: string; label: string }> = [
    { k: 'type', label: 'type' },
    { k: 'description', label: 'description' },
    { k: 'enumValues', label: 'enum values' },
    { k: 'jsonSchema', label: 'JSON schema' }
]

/**
 * Abstract base class for node-specific comparators.
 *
 * Provides:
 * - Template-method `compare()` that orchestrates all 7 abstract category methods.
 * - Shared helper methods for common patterns (model config, role-based messages,
 *   memory, structured output, key/value state) so concrete comparators stay DRY.
 * - Utility methods: `isDifferent`, `addChange`, `normaliseArray`, `normaliseMultiOption`.
 *
 * Implement this class for each node type (Agent, LLM, ConditionAgent, etc.).
 */
export abstract class BaseNodeComparator {
    protected changes: IVersionChange[] = []

    // ──────────────────────────── Abstract methods ────────────────────────────

    abstract compareModel(versionA: ICommonObject, versionB: ICommonObject): void
    abstract compareMessages(versionA: ICommonObject, versionB: ICommonObject): void
    abstract compareTools(versionA: ICommonObject, versionB: ICommonObject): void
    abstract compareKnowledge(versionA: ICommonObject, versionB: ICommonObject): void
    abstract compareMemory(versionA: ICommonObject, versionB: ICommonObject): void
    abstract compareOutput(versionA: ICommonObject, versionB: ICommonObject): void
    abstract compareState(versionA: ICommonObject, versionB: ICommonObject): void

    // ──────────────────────────── Template method ─────────────────────────────

    /**
     * Main comparison entry point — orchestrates all category comparisons.
     * Override in subclasses that need extra categories (e.g. scenarios).
     */
    compare(versionA: ICommonObject, versionB: ICommonObject): IVersionChange[] {
        this.changes = []
        this.compareModel(versionA, versionB)
        this.compareMessages(versionA, versionB)
        this.compareTools(versionA, versionB)
        this.compareKnowledge(versionA, versionB)
        this.compareMemory(versionA, versionB)
        this.compareOutput(versionA, versionB)
        this.compareState(versionA, versionB)
        return this.changes
    }

    // ──────────────────────────── Core helpers ────────────────────────────────

    /** Register a detected change. */
    protected addChange(change: IVersionChange): void {
        this.changes.push(change)
    }

    /**
     * Deep-compare two values.
     * Treats `undefined`, `null`, `''`, and `[]` as equivalent "not set" values.
     */
    protected isDifferent(valueA: any, valueB: any): boolean {
        const normalise = (v: any): any => {
            if (v === undefined || v === null) return null
            if (v === '') return null
            if (Array.isArray(v) && v.length === 0) return null
            return v
        }

        const normA = normalise(valueA)
        const normB = normalise(valueB)

        if (normA === null && normB === null) return false
        if (normA === normB) return false

        if (typeof normA === 'object' || typeof normB === 'object') {
            try {
                return JSON.stringify(normA) !== JSON.stringify(normB)
            } catch {
                return normA !== normB
            }
        }

        return true
    }

    // ──────────────────────────── Normalisation helpers ───────────────────────

    /** Normalise an array-like field to a concrete array. */
    protected normaliseArray<T = ICommonObject>(value: T[] | undefined | null): T[] {
        if (!value) return []
        return Array.isArray(value) ? value : []
    }

    /** Normalise a multi-option field (string | string[] | undefined) → string[]. */
    protected normaliseMultiOption(value: unknown): string[] {
        if (!value) return []
        if (Array.isArray(value)) return value as string[]
        if (typeof value === 'string') {
            return value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
        }
        return []
    }

    // ──────────────────────────── Reusable comparison blocks ──────────────────
    // These are the DRY building-blocks that concrete comparators compose.
    // Each accepts the relevant field prefix so the same logic works for
    // agentModel / llmModel / conditionAgentModel etc.

    /**
     * Compare a model provider field and its config sub-fields.
     *
     * @param versionA - First version data
     * @param versionB - Second version data
     * @param modelKey - Input key for the model provider, e.g. 'agentModel'
     * @param configKey - Input key for the config object, e.g. 'agentModelConfig'
     * @param nodeLabel - Human label for descriptions, e.g. 'Agent'
     * @param fields - Config field descriptors (defaults to MODEL_CONFIG_FIELDS)
     */
    protected compareModelConfig(
        versionA: ICommonObject,
        versionB: ICommonObject,
        modelKey: string,
        configKey: string,
        nodeLabel: string,
        fields: FieldDescriptor[] = MODEL_CONFIG_FIELDS
    ): void {
        const modelA = versionA.inputs?.[modelKey]
        const modelB = versionB.inputs?.[modelKey]

        if (this.isDifferent(modelA, modelB)) {
            this.addChange({
                property: 'Model',
                category: ChangeCategory.Model,
                changeType: ChangeType.Modified,
                oldValue: modelA,
                newValue: modelB,
                description: `${nodeLabel} model provider changed`,
                impact: ImpactLevel.Major
            })
        }

        const cfgA = (versionA.inputs?.[configKey] as ICommonObject) || {}
        const cfgB = (versionB.inputs?.[configKey] as ICommonObject) || {}

        for (const field of fields) {
            const valA = cfgA[field.key]
            const valB = cfgB[field.key]
            if ((valA !== undefined || valB !== undefined) && this.isDifferent(valA, valB)) {
                this.addChange({
                    property: field.label,
                    category: ChangeCategory.Model,
                    changeType: ChangeType.Modified,
                    oldValue: valA,
                    newValue: valB,
                    description: `Model ${field.label.toLowerCase()} changed`,
                    impact: field.impact
                })
            }
        }
    }

    /**
     * Compare role-based messages (system / developer / assistant / user arrays)
     * plus an overall message count and an optional user-message template field.
     *
     * @param versionA - First version data
     * @param versionB - Second version data
     * @param messagesKey - Input key for the messages array, e.g. 'agentMessages'
     * @param userMessageKey - Optional input key for the user-message template, e.g. 'agentUserMessage'
     */
    protected compareRoleMessages(
        versionA: ICommonObject,
        versionB: ICommonObject,
        messagesKey: string,
        userMessageKey?: string
    ): void {
        const messagesA: Array<{ role: string; content: string }> = versionA.inputs?.[messagesKey] || []
        const messagesB: Array<{ role: string; content: string }> = versionB.inputs?.[messagesKey] || []

        for (const { role, label, impact } of MESSAGE_ROLES) {
            const contentA = messagesA.filter((m) => m.role === role).map((m) => m.content)
            const contentB = messagesB.filter((m) => m.role === role).map((m) => m.content)

            if (this.isDifferent(contentA, contentB)) {
                const changeType =
                    contentA.length === 0 ? ChangeType.Added : contentB.length === 0 ? ChangeType.Removed : ChangeType.Modified
                this.addChange({
                    property: label,
                    category: ChangeCategory.Messages,
                    changeType,
                    oldValue: contentA.length === 1 ? contentA[0] : contentA.length === 0 ? null : contentA,
                    newValue: contentB.length === 1 ? contentB[0] : contentB.length === 0 ? null : contentB,
                    description: `${label} changed`,
                    impact
                })
            }
        }

        // Overall message count
        if ((messagesA.length > 0 || messagesB.length > 0) && this.isDifferent(messagesA.length, messagesB.length)) {
            this.addChange({
                property: 'Message Count',
                category: ChangeCategory.Messages,
                changeType: ChangeType.Modified,
                oldValue: messagesA.length,
                newValue: messagesB.length,
                description: 'Total number of predefined messages changed',
                impact: ImpactLevel.Minor
            })
        }

        // Optional user-message template
        if (userMessageKey) {
            const userMsgA = versionA.inputs?.[userMessageKey]
            const userMsgB = versionB.inputs?.[userMessageKey]
            if (this.isDifferent(userMsgA, userMsgB)) {
                this.addChange({
                    property: 'User Message Template',
                    category: ChangeCategory.Messages,
                    changeType: ChangeType.Modified,
                    oldValue: userMsgA,
                    newValue: userMsgB,
                    description: 'User message template (memory input) changed',
                    impact: ImpactLevel.Minor
                })
            }
        }
    }

    /**
     * Compare memory fields (enable, type, window size, max token limit).
     *
     * @param versionA - First version data
     * @param versionB - Second version data
     * @param prefix - Field prefix, e.g. 'agent' → reads agentEnableMemory etc.
     */
    protected compareMemoryFields(versionA: ICommonObject, versionB: ICommonObject, prefix: string): void {
        const fields: Array<{ key: string; label: string; description: string; impact: ImpactLevel }> = [
            { key: `${prefix}EnableMemory`, label: 'Memory Enabled', description: 'Memory feature toggled', impact: ImpactLevel.Major },
            { key: `${prefix}MemoryType`, label: 'Memory Type', description: 'Memory strategy changed', impact: ImpactLevel.Major },
            {
                key: `${prefix}MemoryWindowSize`,
                label: 'Memory Window Size',
                description: 'Number of messages retained in memory window changed',
                impact: ImpactLevel.Minor
            },
            {
                key: `${prefix}MemoryMaxTokenLimit`,
                label: 'Memory Max Token Limit',
                description: 'Conversation summary buffer token limit changed',
                impact: ImpactLevel.Minor
            }
        ]

        for (const field of fields) {
            const valA = versionA.inputs?.[field.key]
            const valB = versionB.inputs?.[field.key]
            if (this.isDifferent(valA, valB)) {
                this.addChange({
                    property: field.label,
                    category: ChangeCategory.Memory,
                    changeType: ChangeType.Modified,
                    oldValue: valA,
                    newValue: valB,
                    description: field.description,
                    impact: field.impact
                })
            }
        }
    }

    /**
     * Compare a structured output array field (key-based schema with type/description/enum/jsonSchema).
     *
     * @param versionA - First version data
     * @param versionB - Second version data
     * @param fieldKey - Input key for the structured output array, e.g. 'agentStructuredOutput'
     * @param returnAsKey - Optional input key for a "return response as" selector
     */
    protected compareStructuredOutput(
        versionA: ICommonObject,
        versionB: ICommonObject,
        fieldKey: string,
        returnAsKey?: string
    ): void {
        // Return-as selector
        if (returnAsKey) {
            const returnAsA = versionA.inputs?.[returnAsKey]
            const returnAsB = versionB.inputs?.[returnAsKey]
            if (this.isDifferent(returnAsA, returnAsB)) {
                this.addChange({
                    property: 'Return Response As',
                    category: ChangeCategory.Output,
                    changeType: ChangeType.Modified,
                    oldValue: returnAsA,
                    newValue: returnAsB,
                    description: 'Output response type changed',
                    impact: ImpactLevel.Major
                })
            }
        }

        const outputA: ICommonObject[] = this.normaliseArray(versionA.inputs?.[fieldKey])
        const outputB: ICommonObject[] = this.normaliseArray(versionB.inputs?.[fieldKey])
        const hasA = outputA.length > 0
        const hasB = outputB.length > 0

        if (!hasA && hasB) {
            this.addChange({
                property: 'Structured Output',
                category: ChangeCategory.Output,
                changeType: ChangeType.Added,
                oldValue: null,
                newValue: outputB,
                description: 'JSON structured output schema added',
                impact: ImpactLevel.Major
            })
        } else if (hasA && !hasB) {
            this.addChange({
                property: 'Structured Output',
                category: ChangeCategory.Output,
                changeType: ChangeType.Removed,
                oldValue: outputA,
                newValue: null,
                description: 'JSON structured output schema removed',
                impact: ImpactLevel.Major
            })
        } else if (hasA && hasB && this.isDifferent(outputA, outputB)) {
            const keysA = new Set(outputA.map((f) => f.key))
            const keysB = new Set(outputB.map((f) => f.key))

            for (const key of keysB) {
                if (!keysA.has(key)) {
                    this.addChange({
                        property: `Structured Output: ${key}`,
                        category: ChangeCategory.Output,
                        changeType: ChangeType.Added,
                        oldValue: null,
                        newValue: outputB.find((f) => f.key === key),
                        description: `Structured output field "${key}" added`,
                        impact: ImpactLevel.Major
                    })
                }
            }

            for (const key of keysA) {
                if (!keysB.has(key)) {
                    this.addChange({
                        property: `Structured Output: ${key}`,
                        category: ChangeCategory.Output,
                        changeType: ChangeType.Removed,
                        oldValue: outputA.find((f) => f.key === key),
                        newValue: null,
                        description: `Structured output field "${key}" removed`,
                        impact: ImpactLevel.Breaking
                    })
                }
            }

            // Diff individual sub-fields for keys present in both
            for (const fieldA of outputA) {
                const fieldB = outputB.find((f) => f.key === fieldA.key)
                if (!fieldB) continue
                for (const prop of STRUCTURED_OUTPUT_PROPS) {
                    if (this.isDifferent(fieldA[prop.k], fieldB[prop.k])) {
                        this.addChange({
                            property: `Structured Output: ${fieldA.key} (${prop.label})`,
                            category: ChangeCategory.Output,
                            changeType: ChangeType.Modified,
                            oldValue: fieldA[prop.k],
                            newValue: fieldB[prop.k],
                            description: `${prop.label} of structured output field "${fieldA.key}" changed`,
                            impact: ImpactLevel.Major
                        })
                    }
                }
            }
        }
    }

    /**
     * Compare a key/value state array (e.g. agentUpdateState / llmUpdateState).
     *
     * @param versionA - First version data
     * @param versionB - Second version data
     * @param fieldKey - Input key for the state array, e.g. 'agentUpdateState'
     */
    protected compareKeyValueState(versionA: ICommonObject, versionB: ICommonObject, fieldKey: string): void {
        const stateA: ICommonObject[] = this.normaliseArray(versionA.inputs?.[fieldKey])
        const stateB: ICommonObject[] = this.normaliseArray(versionB.inputs?.[fieldKey])
        const hasA = stateA.length > 0
        const hasB = stateB.length > 0

        if (!hasA && hasB) {
            this.addChange({
                property: 'Update Flow State',
                category: ChangeCategory.State,
                changeType: ChangeType.Added,
                oldValue: null,
                newValue: stateB,
                description: 'Flow state update configuration added',
                impact: ImpactLevel.Major
            })
        } else if (hasA && !hasB) {
            this.addChange({
                property: 'Update Flow State',
                category: ChangeCategory.State,
                changeType: ChangeType.Removed,
                oldValue: stateA,
                newValue: null,
                description: 'Flow state update configuration removed',
                impact: ImpactLevel.Major
            })
        } else if (hasA && hasB && this.isDifferent(stateA, stateB)) {
            const keysA = new Set(stateA.map((s) => s.key))
            const keysB = new Set(stateB.map((s) => s.key))

            for (const key of keysB) {
                if (!keysA.has(key)) {
                    this.addChange({
                        property: `State: ${key}`,
                        category: ChangeCategory.State,
                        changeType: ChangeType.Added,
                        oldValue: null,
                        newValue: stateB.find((s) => s.key === key)?.value,
                        description: `State key "${key}" added`,
                        impact: ImpactLevel.Major
                    })
                }
            }

            for (const key of keysA) {
                if (!keysB.has(key)) {
                    this.addChange({
                        property: `State: ${key}`,
                        category: ChangeCategory.State,
                        changeType: ChangeType.Removed,
                        oldValue: stateA.find((s) => s.key === key)?.value,
                        newValue: null,
                        description: `State key "${key}" removed`,
                        impact: ImpactLevel.Major
                    })
                }
            }

            for (const entryA of stateA) {
                const entryB = stateB.find((s) => s.key === entryA.key)
                if (entryB && this.isDifferent(entryA.value, entryB.value)) {
                    this.addChange({
                        property: `State: ${entryA.key}`,
                        category: ChangeCategory.State,
                        changeType: ChangeType.Modified,
                        oldValue: entryA.value,
                        newValue: entryB.value,
                        description: `Value for state key "${entryA.key}" changed`,
                        impact: ImpactLevel.Major
                    })
                }
            }
        }
    }

    /**
     * Compare a simple scalar input field.
     * Convenience for comparing a single named input with custom property label,
     * category, description and impact.
     */
    protected compareScalarField(
        versionA: ICommonObject,
        versionB: ICommonObject,
        fieldKey: string,
        opts: { property: string; category: string; description: string; impact: ImpactLevel }
    ): void {
        const valA = versionA.inputs?.[fieldKey]
        const valB = versionB.inputs?.[fieldKey]
        if (this.isDifferent(valA, valB)) {
            this.addChange({
                property: opts.property,
                category: opts.category,
                changeType: ChangeType.Modified,
                oldValue: valA,
                newValue: valB,
                description: opts.description,
                impact: opts.impact
            })
        }
    }
}
