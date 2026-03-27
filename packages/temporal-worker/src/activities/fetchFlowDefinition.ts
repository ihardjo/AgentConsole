import { getDataSource } from '../database/dataSource'

export interface FlowDefinition {
    id: string
    name: string
    flowData: {
        nodes: FlowNode[]
        edges: FlowEdge[]
    }
}

export interface FlowNode {
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, any>
}

export interface FlowEdge {
    id: string
    source: string
    sourceHandle?: string
    target: string
    targetHandle?: string
}

export interface FetchFlowDefinitionParams {
    flowId: string
    workspaceId: string
}

/**
 * Fetches the flow definition directly from the database.
 * This avoids the HTTP API authentication requirement by querying the database directly.
 * This activity is called at the start of workflow execution to get the graph definition.
 */
export async function fetchFlowDefinition(params: FetchFlowDefinitionParams): Promise<FlowDefinition> {
    const { flowId, workspaceId } = params

    const dataSource = await getDataSource()

    // Query the chat_flow table directly
    // Note: Column names are quoted because PostgreSQL preserves case for quoted identifiers
    const result = await dataSource.query(
        `SELECT id, name, "flowData" FROM chat_flow 
         WHERE id = $1 AND "workspaceId" = $2 AND type = 'TEMPORAL'`,
        [flowId, workspaceId]
    )

    if (!result || result.length === 0) {
        throw new Error(`Temporal workflow not found: ${flowId} in workspace ${workspaceId}`)
    }

    const flow = result[0]

    // Parse flowData if it's a string
    const flowData = typeof flow.flowData === 'string' ? JSON.parse(flow.flowData) : flow.flowData

    return {
        id: flow.id,
        name: flow.name,
        flowData: {
            nodes: flowData.nodes || [],
            edges: flowData.edges || []
        }
    }
}
