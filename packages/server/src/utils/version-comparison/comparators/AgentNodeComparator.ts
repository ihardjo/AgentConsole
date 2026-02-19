import { BaseNodeComparator } from '../BaseNodeComparator'
import { ICommonObject, ImpactLevel, ChangeType, ChangeCategory } from '../types'

/**
 * Comparator for Agent nodes (type: 'agentAgentflow')
 * Tracks all inputs defined in packages/components/nodes/agentflow/Agent/Agent.ts
 *
 * Delegates shared patterns (model config, role messages, memory, structured output,
 * key/value state) to the protected helpers in BaseNodeComparator.
 * Only Agent-specific logic (tools, knowledge, model-label mapping) lives here.
 */
export class AgentNodeComparator extends BaseNodeComparator {
    // ─────────────────────────────────────────────────────────────────────────
    // MODEL
    // ─────────────────────────────────────────────────────────────────────────
    compareModel(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareModelConfig(versionA, versionB, 'agentModel', 'agentModelConfig', 'Agent')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MESSAGES
    // ─────────────────────────────────────────────────────────────────────────
    compareMessages(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareRoleMessages(versionA, versionB, 'agentMessages', 'agentUserMessage')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOOLS
    // Tracks: agentTools (per-tool name + requiresHumanInput),
    //         agentToolsBuiltInOpenAI, agentToolsBuiltInGemini,
    //         agentToolsBuiltInAnthropic
    // ─────────────────────────────────────────────────────────────────────────
    compareTools(versionA: ICommonObject, versionB: ICommonObject): void {
        // ── Custom tools ──
        const toolsA = this.extractTools(versionA)
        const toolsB = this.extractTools(versionB)

        const addedTools = toolsB.filter((tb) => !toolsA.find((ta) => ta.name === tb.name))
        addedTools.forEach((tool) => {
            this.addChange({
                property: `Tool: ${tool.name}`,
                category: ChangeCategory.Tools,
                changeType: ChangeType.Added,
                oldValue: null,
                newValue: tool.name,
                description: `Tool "${tool.name}" added`,
                impact: ImpactLevel.Minor
            })
        })

        const removedTools = toolsA.filter((ta) => !toolsB.find((tb) => tb.name === ta.name))
        removedTools.forEach((tool) => {
            this.addChange({
                property: `Tool: ${tool.name}`,
                category: ChangeCategory.Tools,
                changeType: ChangeType.Removed,
                oldValue: tool.name,
                newValue: null,
                description: `Tool "${tool.name}" removed`,
                impact: ImpactLevel.Breaking
            })
        })

        // Detect humanInput flag change for tools present in both versions
        toolsA.forEach((toolA) => {
            const toolB = toolsB.find((tb) => tb.name === toolA.name)
            if (toolB && this.isDifferent(toolA.requiresHumanInput, toolB.requiresHumanInput)) {
                this.addChange({
                    property: `Tool: ${toolA.name} (Human Input)`,
                    category: ChangeCategory.Tools,
                    changeType: ChangeType.Modified,
                    oldValue: toolA.requiresHumanInput ?? false,
                    newValue: toolB.requiresHumanInput ?? false,
                    description: `"Require Human Input" toggled for tool "${toolA.name}"`,
                    impact: ImpactLevel.Major
                })
            }
        })

        // ── Built-in tool sets ──
        const builtInSets: Array<{ key: string; label: string }> = [
            { key: 'agentToolsBuiltInOpenAI', label: 'OpenAI Built-in Tools' },
            { key: 'agentToolsBuiltInGemini', label: 'Gemini Built-in Tools' },
            { key: 'agentToolsBuiltInAnthropic', label: 'Anthropic Built-in Tools' }
        ]

        for (const { key, label } of builtInSets) {
            const setA: string[] = this.normaliseMultiOption(versionA.inputs?.[key])
            const setB: string[] = this.normaliseMultiOption(versionB.inputs?.[key])

            const added = setB.filter((t) => !setA.includes(t))
            const removed = setA.filter((t) => !setB.includes(t))

            added.forEach((tool) => {
                this.addChange({
                    property: `${label}: ${tool}`,
                    category: ChangeCategory.Tools,
                    changeType: ChangeType.Added,
                    oldValue: null,
                    newValue: tool,
                    description: `Built-in tool "${tool}" added to ${label}`,
                    impact: ImpactLevel.Minor
                })
            })

            removed.forEach((tool) => {
                this.addChange({
                    property: `${label}: ${tool}`,
                    category: ChangeCategory.Tools,
                    changeType: ChangeType.Removed,
                    oldValue: tool,
                    newValue: null,
                    description: `Built-in tool "${tool}" removed from ${label}`,
                    impact: ImpactLevel.Breaking
                })
            })
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KNOWLEDGE
    // Tracks: agentKnowledgeDocumentStores (store id + description + returnSourceDocs)
    //         agentKnowledgeVSEmbeddings (vectorStore + embeddingModel + names + descriptions)
    // ─────────────────────────────────────────────────────────────────────────
    compareKnowledge(versionA: ICommonObject, versionB: ICommonObject): void {
        // ── Document Stores ──
        const docStoresA: ICommonObject[] = versionA.inputs?.agentKnowledgeDocumentStores || []
        const docStoresB: ICommonObject[] = versionB.inputs?.agentKnowledgeDocumentStores || []

        const addedDocStores = docStoresB.filter((b) => !docStoresA.find((a) => a.documentStore === b.documentStore))
        addedDocStores.forEach((store) => {
            this.addChange({
                property: `Document Store: ${this.storeLabel(store.documentStore)}`,
                category: ChangeCategory.Knowledge,
                changeType: ChangeType.Added,
                oldValue: null,
                newValue: store.documentStore,
                description: `Document store "${this.storeLabel(store.documentStore)}" added`,
                impact: ImpactLevel.Major
            })
        })

        const removedDocStores = docStoresA.filter((a) => !docStoresB.find((b) => b.documentStore === a.documentStore))
        removedDocStores.forEach((store) => {
            this.addChange({
                property: `Document Store: ${this.storeLabel(store.documentStore)}`,
                category: ChangeCategory.Knowledge,
                changeType: ChangeType.Removed,
                oldValue: store.documentStore,
                newValue: null,
                description: `Document store "${this.storeLabel(store.documentStore)}" removed`,
                impact: ImpactLevel.Breaking
            })
        })

        // For stores present in both, diff description and returnSourceDocuments
        docStoresA.forEach((storeA) => {
            const storeB = docStoresB.find((b) => b.documentStore === storeA.documentStore)
            if (!storeB) return
            const storeLabel = this.storeLabel(storeA.documentStore)

            if (this.isDifferent(storeA.docStoreDescription, storeB.docStoreDescription)) {
                this.addChange({
                    property: `Document Store: ${storeLabel} – Description`,
                    category: ChangeCategory.Knowledge,
                    changeType: ChangeType.Modified,
                    oldValue: storeA.docStoreDescription,
                    newValue: storeB.docStoreDescription,
                    description: `Knowledge description for "${storeLabel}" changed`,
                    impact: ImpactLevel.Minor
                })
            }
            if (this.isDifferent(storeA.returnSourceDocuments, storeB.returnSourceDocuments)) {
                this.addChange({
                    property: `Document Store: ${storeLabel} – Return Source Docs`,
                    category: ChangeCategory.Knowledge,
                    changeType: ChangeType.Modified,
                    oldValue: storeA.returnSourceDocuments,
                    newValue: storeB.returnSourceDocuments,
                    description: `Return source documents setting changed for "${storeLabel}"`,
                    impact: ImpactLevel.Patch
                })
            }
        })

        // ── Vector Embeddings ──
        const vsEmbeddingsA: ICommonObject[] = versionA.inputs?.agentKnowledgeVSEmbeddings || []
        const vsEmbeddingsB: ICommonObject[] = versionB.inputs?.agentKnowledgeVSEmbeddings || []

        const addedVS = vsEmbeddingsB.filter((b) => !vsEmbeddingsA.find((a) => a.vectorStore === b.vectorStore))
        addedVS.forEach((vs) => {
            this.addChange({
                property: `Vector Store: ${vs.knowledgeName || vs.vectorStore}`,
                category: ChangeCategory.Knowledge,
                changeType: ChangeType.Added,
                oldValue: null,
                newValue: vs.vectorStore,
                description: `Vector store "${vs.knowledgeName || vs.vectorStore}" added`,
                impact: ImpactLevel.Major
            })
        })

        const removedVS = vsEmbeddingsA.filter((a) => !vsEmbeddingsB.find((b) => b.vectorStore === a.vectorStore))
        removedVS.forEach((vs) => {
            this.addChange({
                property: `Vector Store: ${vs.knowledgeName || vs.vectorStore}`,
                category: ChangeCategory.Knowledge,
                changeType: ChangeType.Removed,
                oldValue: vs.vectorStore,
                newValue: null,
                description: `Vector store "${vs.knowledgeName || vs.vectorStore}" removed`,
                impact: ImpactLevel.Breaking
            })
        })

        // For VS entries present in both, diff individual fields
        vsEmbeddingsA.forEach((vsA) => {
            const vsB = vsEmbeddingsB.find((b) => b.vectorStore === vsA.vectorStore)
            if (!vsB) return
            const vsLabel = vsA.knowledgeName || vsA.vectorStore

            const vsFields: Array<{ key: string; label: string; impact: ImpactLevel }> = [
                { key: 'embeddingModel', label: 'Embedding Model', impact: ImpactLevel.Major },
                { key: 'knowledgeName', label: 'Knowledge Name', impact: ImpactLevel.Minor },
                { key: 'knowledgeDescription', label: 'Knowledge Description', impact: ImpactLevel.Minor },
                { key: 'returnSourceDocuments', label: 'Return Source Documents', impact: ImpactLevel.Patch }
            ]

            for (const field of vsFields) {
                if (this.isDifferent(vsA[field.key], vsB[field.key])) {
                    this.addChange({
                        property: `Vector Store: ${vsLabel} – ${field.label}`,
                        category: ChangeCategory.Knowledge,
                        changeType: ChangeType.Modified,
                        oldValue: vsA[field.key],
                        newValue: vsB[field.key],
                        description: `${field.label} changed for vector store "${vsLabel}"`,
                        impact: field.impact
                    })
                }
            }
        })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEMORY
    // ─────────────────────────────────────────────────────────────────────────
    compareMemory(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareMemoryFields(versionA, versionB, 'agent')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OUTPUT
    // ─────────────────────────────────────────────────────────────────────────
    compareOutput(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareStructuredOutput(versionA, versionB, 'agentStructuredOutput', 'agentReturnResponseAs')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────────────────
    compareState(versionA: ICommonObject, versionB: ICommonObject): void {
        this.compareKeyValueState(versionA, versionB, 'agentUpdateState')
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private extractTools(version: ICommonObject): Array<{ name: string; requiresHumanInput?: boolean }> {
        const agentTools = version.inputs?.agentTools
        if (!Array.isArray(agentTools)) return []
        return agentTools.map((t: ICommonObject) => ({
            name: (t.agentSelectedTool as string) || (t.name as string) || 'Unknown',
            requiresHumanInput: t.agentSelectedToolRequiresHumanInput as boolean | undefined
        }))
    }

    /** Extract a human-readable label from a store id formatted as "id:name" */
    private storeLabel(storeId: string): string {
        if (!storeId) return 'Unknown'
        const parts = storeId.split(':')
        return parts.length > 1 ? parts.slice(1).join(':') : storeId
    }

    private getModelLabel(modelId: string): string {
        if (!modelId) return 'None'
        const modelMap: Record<string, string> = {
            chatOpenAI: 'OpenAI',
            chatAnthropic: 'Anthropic Claude',
            chatGoogleGenerativeAI: 'Google Gemini',
            azureChatOpenAI: 'Azure OpenAI',
            chatBedrock: 'AWS Bedrock',
            chatMistralAI: 'Mistral AI',
            chatOllama: 'Ollama',
            chatGroq: 'Groq'
        }
        for (const [key, label] of Object.entries(modelMap)) {
            if (modelId.includes(key)) return label
        }
        return modelId
    }
}
