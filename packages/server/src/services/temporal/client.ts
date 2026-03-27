import { Client, Connection } from '@temporalio/client'
import config from '../../utils/config'
import logger from '../../utils/logger'

let temporalClient: Client | null = null
let connectionPromise: Promise<Client> | null = null

/**
 * Gets or creates a Temporal client connection.
 * Uses singleton pattern to reuse the connection.
 */
export async function getTemporalClient(): Promise<Client> {
    if (temporalClient) {
        return temporalClient
    }

    // Avoid multiple simultaneous connection attempts
    if (connectionPromise) {
        return connectionPromise
    }

    connectionPromise = createTemporalClient()
    temporalClient = await connectionPromise
    connectionPromise = null

    return temporalClient
}

/**
 * Creates a new Temporal client connection
 */
async function createTemporalClient(): Promise<Client> {
    const { address, namespace } = config.temporal

    logger.info(`Connecting to Temporal server at ${address}...`)

    try {
        const connection = await Connection.connect({
            address
        })

        const client = new Client({
            connection,
            namespace
        })

        logger.info(`Connected to Temporal server (namespace: ${namespace})`)
        return client
    } catch (error: any) {
        logger.error(`Failed to connect to Temporal server: ${error.message}`)
        throw error
    }
}

/**
 * Checks if Temporal server is available
 */
export async function checkTemporalHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
        const client = await getTemporalClient()
        // Try to describe the namespace to verify connection
        await client.workflowService.describeNamespace({ namespace: config.temporal.namespace })
        return { healthy: true }
    } catch (error: any) {
        return { healthy: false, error: error.message }
    }
}

/**
 * Gets the Temporal Web UI URL for a workflow
 */
export function getTemporalWebUIUrl(workflowId: string, runId?: string): string {
    const baseUrl = config.temporal.webUiUrl
    const namespace = config.temporal.namespace

    if (runId) {
        return `${baseUrl}/namespaces/${namespace}/workflows/${workflowId}/${runId}`
    }
    return `${baseUrl}/namespaces/${namespace}/workflows/${workflowId}`
}

/**
 * Gets the configured task queue name
 */
export function getTaskQueue(): string {
    return config.temporal.taskQueue
}

export default {
    getTemporalClient,
    checkTemporalHealth,
    getTemporalWebUIUrl,
    getTaskQueue
}
