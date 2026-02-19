import { BaseNodeComparator } from '../BaseNodeComparator'
import { ICommonObject, IVersionChange, ImpactLevel, ChangeType, ChangeCategory } from '../types'

/**
 * Comparator for ConditionAgent nodes (type: 'ConditionAgent', name: 'conditionAgentAgentflow')
 * Tracks all inputs defined in packages/components/nodes/agentflow/ConditionAgent/ConditionAgent.ts
 *
 * Categories used:
 *   model     — model provider + model config parameters
 *   messages  — instructions, input template, system-prompt override
 *   scenarios — scenario list (the branching conditions)
 *
 * No-ops (intentional):
 *   compareTools / compareKnowledge / compareMemory / compareOutput / compareState
 *   — ConditionAgent has no tool, knowledge, memory, output or state fields.
 */
export class ConditionAgentNodeComparator extends BaseNodeComparator {
    // ─────────────────────────────────────────────────────────────────────────
    // MODEL
    // ─────────────────────────────────────────────────────────────────────────
    compareModel(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareModelConfig(versionA, versionB, 'conditionAgentModel', 'conditionAgentModelConfig', 'Condition Agent')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES
    // Tracks: instructions, input template, system prompt override, system prompt
    // ─────────────────────────────────────────────────────────────────────────
    compareMessages(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareScalarField(versionA, versionB, 'conditionAgentInstructions', {
            property: 'Instructions',
            category: ChangeCategory.Messages,
            description: 'Condition Agent instructions changed',
            impact: ImpactLevel.Major
        })

        this.compareScalarField(versionA, versionB, 'conditionAgentInput', {
            property: 'Input Template',
            category: ChangeCategory.Messages,
            description: 'Condition Agent input template changed',
            impact: ImpactLevel.Minor
        })

        this.compareScalarField(versionA, versionB, 'conditionAgentOverrideSystemPrompt', {
            property: 'Override System Prompt',
            category: ChangeCategory.Messages,
            description: 'System prompt override setting changed',
            impact: ImpactLevel.Minor
        })

        this.compareScalarField(versionA, versionB, 'conditionAgentSystemPrompt', {
            property: 'System Prompt',
            category: ChangeCategory.Messages,
            description: 'Custom system prompt changed',
            impact: ImpactLevel.Major
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOOLS / KNOWLEDGE / MEMORY / OUTPUT / STATE — not applicable
    // ─────────────────────────────────────────────────────────────────────────
    compareTools(_versionA: ICommonObject, _versionB: ICommonObject): void {}
    compareKnowledge(_versionA: ICommonObject, _versionB: ICommonObject): void {}
    compareMemory(_versionA: ICommonObject, _versionB: ICommonObject): void {}
    compareOutput(_versionA: ICommonObject, _versionB: ICommonObject): void {}
    compareState(_versionA: ICommonObject, _versionB: ICommonObject): void {}

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIOS (custom comparison — called by overriding compare())
    // Tracks: conditionAgentScenarios — array of { scenario: string }
    //   Detects additions, removals, reordering and content edits per scenario.
    // ─────────────────────────────────────────────────────────────────────────
    private compareScenarios(versionA: ICommonObject, versionB: ICommonObject): void {
        const scenariosA: Array<{ scenario: string }> = this.normaliseArray(versionA.inputs?.conditionAgentScenarios)
        const scenariosB: Array<{ scenario: string }> = this.normaliseArray(versionB.inputs?.conditionAgentScenarios)

        const countA = scenariosA.length
        const countB = scenariosB.length

        if (countA !== countB) {
            this.addChange({
                property: 'Scenario Count',
                category: ChangeCategory.Scenarios,
                changeType: ChangeType.Modified,
                oldValue: countA,
                newValue: countB,
                description: `Number of scenarios changed from ${countA} to ${countB}`,
                impact: ImpactLevel.Breaking
            })
        }

        const maxLen = Math.max(countA, countB)
        for (let i = 0; i < maxLen; i++) {
            const entryA = scenariosA[i]
            const entryB = scenariosB[i]

            if (!entryA && entryB) {
                this.addChange({
                    property: `Scenario ${i + 1}`,
                    category: ChangeCategory.Scenarios,
                    changeType: ChangeType.Added,
                    oldValue: undefined,
                    newValue: entryB.scenario,
                    description: `Scenario ${i + 1} added: "${entryB.scenario}"`,
                    impact: ImpactLevel.Breaking
                })
            } else if (entryA && !entryB) {
                this.addChange({
                    property: `Scenario ${i + 1}`,
                    category: ChangeCategory.Scenarios,
                    changeType: ChangeType.Removed,
                    oldValue: entryA.scenario,
                    newValue: undefined,
                    description: `Scenario ${i + 1} removed: "${entryA.scenario}"`,
                    impact: ImpactLevel.Breaking
                })
            } else if (entryA && entryB && this.isDifferent(entryA.scenario, entryB.scenario)) {
                this.addChange({
                    property: `Scenario ${i + 1}`,
                    category: ChangeCategory.Scenarios,
                    changeType: ChangeType.Modified,
                    oldValue: entryA.scenario,
                    newValue: entryB.scenario,
                    description: `Scenario ${i + 1} text changed`,
                    impact: ImpactLevel.Major
                })
            }
        }
    }

    /**
     * Override compare() to add Scenarios comparison after the standard passes.
     */
    compare(versionA: ICommonObject, versionB: ICommonObject): IVersionChange[] {
        super.compare(versionA, versionB)
        this.compareScenarios(versionA, versionB)
        return this.changes
    }
}
