import axios from 'axios'
import { ApplicationFailure } from '@temporalio/activity'
import { getDataSource } from '../database/dataSource'

const FLOWISE_API_URL = process.env.FLOWISE_API_URL || 'http://localhost:3000'

export interface CallAgentFlowParams {
    agentFlowId: string
    question: string
    workspaceId: string
    apiKeyId?: string
    overrideConfig?: Record<string, any>
    sessionId?: string
}

export interface CallAgentFlowResult {
    text: string
    chatId?: string
    sessionId?: string
    chatMessageId?: string
    sourceDocuments?: any[]
    usedTools?: any[]
    agentReasoning?: any[]
}

/**
 * Looks up an API key from the database by ID and workspace.
 * Returns the actual API key string for use in Authorization header.
 */
async function getApiKeyFromDatabase(apiKeyId: string, workspaceId: string): Promise<string | null> {
    const dataSource = await getDataSource()

    // Query the apikey table directly (table name has no underscore)
    // Column names are quoted because PostgreSQL preserves case for quoted identifiers
    const result = await dataSource.query(
        `SELECT "apiKey" FROM apikey 
         WHERE id = $1 AND "workspaceId" = $2`,
        [apiKeyId, workspaceId]
    )

    if (!result || result.length === 0) {
        return null
    }

    return result[0].apiKey
}

/**
 * Calls an existing AgentFlow via the Flowise Prediction API with streaming disabled.
 * This is the core activity for executing AI agents within durable workflows.
 *
 * The API key is looked up from the database using the provided apiKeyId.
 */
export async function callAgentFlow(params: CallAgentFlowParams): Promise<CallAgentFlowResult> {
    const { agentFlowId, question, workspaceId, apiKeyId, overrideConfig, sessionId } = params

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-workspace-id': workspaceId
    }

    // Look up API key from database if apiKeyId is provided
    if (apiKeyId) {
        const apiKey = await getApiKeyFromDatabase(apiKeyId, workspaceId)
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`
        } else {
            console.warn(`API key not found for id: ${apiKeyId}, proceeding without authentication`)
        }
    }

    const body: Record<string, any> = {
        question,
        streaming: false // Always non-streaming for durable workflows
    }

    if (overrideConfig) {
        body.overrideConfig = overrideConfig
    }

    if (sessionId) {
        body.sessionId = sessionId
    }

    try {
        const response = await axios.post(`${FLOWISE_API_URL}/api/v1/prediction/${agentFlowId}`, body, {
            headers,
            timeout: 600000 // 10 minute timeout for long-running AI operations
        })

        if (response.status !== 200) {
            throw ApplicationFailure.nonRetryable(`AgentFlow call failed: ${response.status} ${response.statusText}`)
        }

        const data = response.data

        return {
            text: data.text || data.output || '',
            chatId: data.chatId,
            sessionId: data.sessionId,
            chatMessageId: data.chatMessageId,
            sourceDocuments: data.sourceDocuments,
            usedTools: data.usedTools,
            agentReasoning: data.agentReasoning
        }
    } catch (error: any) {
        if (error.response) {
            // Server responded with error status
            const status = error.response.status
            const message = error.response.data?.message || error.response.statusText

            if (status >= 400 && status < 500) {
                // Client errors are non-retryable
                throw ApplicationFailure.nonRetryable(`AgentFlow call failed (${status}): ${message}`)
            }
            // Server errors can be retried
            throw ApplicationFailure.retryable(`AgentFlow call failed (${status}): ${message}`)
        } else if (error.code === 'ECONNABORTED') {
            throw ApplicationFailure.retryable('AgentFlow call timed out')
        } else {
            throw ApplicationFailure.retryable(`AgentFlow call failed: ${error.message}`)
        }
    }
}
