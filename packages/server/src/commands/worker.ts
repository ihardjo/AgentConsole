import logger from '../utils/logger'
import { QueueManager } from '../queue/QueueManager'
import { BaseCommand } from './base'
import { getDataSource } from '../DataSource'
import { Telemetry } from '../utils/telemetry'
import { NodesPool } from '../NodesPool'
import { CachePool } from '../CachePool'
import { QueueEvents, QueueEventsListener } from 'bullmq'
import { AbortControllerPool } from '../AbortControllerPool'
import { UsageCacheManager } from '../UsageCacheManager'
import { MODE } from '../Interface'

interface CustomListener extends QueueEventsListener {
    abort: (args: { id: string }, id: string) => void
}

export default class Worker extends BaseCommand {
    predictionWorkerId: string
    upsertionWorkerId: string
    private queueEvents?: QueueEvents

    async run(): Promise<void> {
        logger.info('Starting Flowise Worker...')

        const { appDataSource, telemetry, componentNodes, cachePool, abortControllerPool, usageCacheManager } = await this.prepareData()

        const queueManager = QueueManager.getInstance()
        const isDedicatedMode = process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE
        const workspaceId = process.env.WORKER_WORKSPACE_ID

        if (isDedicatedMode && workspaceId) {
            /** Workspace-dedicated mode: only the two workspace-scoped queues */
            queueManager.setupWorkspaceQueue(workspaceId, {
                componentNodes,
                telemetry,
                cachePool,
                appDataSource,
                abortControllerPool,
                usageCacheManager
            })
            logger.info(`[Worker] MODE=queue-dedicated-workspace — workspace: ${workspaceId}`)

            /** Prediction */
            const predictionQueue = queueManager.getOrCreateWorkspaceQueue('prediction', workspaceId)
            const predictionWorker = predictionQueue.createWorker()
            this.predictionWorkerId = predictionWorker.id
            logger.info(`Prediction Worker ${this.predictionWorkerId} created for workspace ${workspaceId}`)

            const predictionQueueName = predictionQueue.getQueueName()
            this.queueEvents = new QueueEvents(predictionQueueName, { connection: queueManager.getConnection() })

            this.queueEvents.on<CustomListener>('abort', async ({ id }: { id: string }) => {
                abortControllerPool.abort(id)
            })

            // Exit gracefully when the queue is obliterated (workspace deleted)
            predictionWorker.on('closing', () => {
                logger.info(`[Worker] Prediction worker for workspace ${workspaceId} is closing — initiating graceful shutdown`)
                this.stopProcess().catch((err) => logger.error('[Worker] Error during shutdown after queue obliteration', err))
            })

            /** Upsertion */
            const upsertionQueue = queueManager.getOrCreateWorkspaceQueue('upsert', workspaceId)
            const upsertionWorker = upsertionQueue.createWorker()
            this.upsertionWorkerId = upsertionWorker.id
            logger.info(`Upsertion Worker ${this.upsertionWorkerId} created for workspace ${workspaceId}`)

            upsertionWorker.on('closing', () => {
                logger.info(`[Worker] Upsertion worker for workspace ${workspaceId} is closing — initiating graceful shutdown`)
                this.stopProcess().catch((err) => logger.error('[Worker] Error during shutdown after queue obliteration', err))
            })
        } else {
            /** Legacy shared-queue mode */
            if (isDedicatedMode && !workspaceId) {
                logger.warn(
                    '[Worker] MODE=queue-dedicated-workspace but WORKER_WORKSPACE_ID is not set — falling back to legacy shared queue mode'
                )
            }

            queueManager.setupAllQueues({
                componentNodes,
                telemetry,
                cachePool,
                appDataSource,
                abortControllerPool,
                usageCacheManager
            })

            /** Prediction */
            const predictionQueue = queueManager.getQueue('prediction')
            const predictionWorker = predictionQueue.createWorker()
            this.predictionWorkerId = predictionWorker.id
            logger.info(`Prediction Worker ${this.predictionWorkerId} created`)

            const predictionQueueName = predictionQueue.getQueueName()
            this.queueEvents = new QueueEvents(predictionQueueName, { connection: queueManager.getConnection() })

            this.queueEvents.on<CustomListener>('abort', async ({ id }: { id: string }) => {
                abortControllerPool.abort(id)
            })

            /** Upsertion */
            const upsertionQueue = queueManager.getQueue('upsert')
            const upsertionWorker = upsertionQueue.createWorker()
            this.upsertionWorkerId = upsertionWorker.id
            logger.info(`Upsertion Worker ${this.upsertionWorkerId} created`)
        }

        // Keep the process running
        process.stdin.resume()
    }

    async prepareData() {
        // Init database
        const appDataSource = getDataSource()
        await appDataSource.initialize()
        await appDataSource.runMigrations({ transaction: 'each' })

        // Initialize abortcontroller pool
        const abortControllerPool = new AbortControllerPool()

        // Init telemetry
        const telemetry = new Telemetry()

        // Initialize nodes pool
        const nodesPool = new NodesPool()
        await nodesPool.initialize()

        // Initialize cache pool
        const cachePool = new CachePool()

        // Initialize usage cache manager
        const usageCacheManager = await UsageCacheManager.getInstance()

        return { appDataSource, telemetry, componentNodes: nodesPool.componentNodes, cachePool, abortControllerPool, usageCacheManager }
    }

    async catch(error: Error) {
        if (error.stack) logger.error(error.stack)
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        await this.failExit()
    }

    async stopProcess() {
        try {
            const queueManager = QueueManager.getInstance()
            const isDedicatedMode = process.env.MODE === MODE.QUEUE_DEDICATED_WORKSPACE
            const workspaceId = process.env.WORKER_WORKSPACE_ID

            if (isDedicatedMode && workspaceId) {
                const predictionQueue = queueManager.getOrCreateWorkspaceQueue('prediction', workspaceId)
                const predictionWorker = predictionQueue.getWorker()
                if (predictionWorker) {
                    logger.info(`Shutting down Flowise Prediction Worker ${this.predictionWorkerId}...`)
                    await predictionWorker.close()
                }

                const upsertionQueue = queueManager.getOrCreateWorkspaceQueue('upsert', workspaceId)
                const upsertionWorker = upsertionQueue.getWorker()
                if (upsertionWorker) {
                    logger.info(`Shutting down Flowise Upsertion Worker ${this.upsertionWorkerId}...`)
                    await upsertionWorker.close()
                }
            } else {
                const predictionWorker = queueManager.getQueue('prediction').getWorker()
                logger.info(`Shutting down Flowise Prediction Worker ${this.predictionWorkerId}...`)
                await predictionWorker.close()

                const upsertWorker = queueManager.getQueue('upsert').getWorker()
                logger.info(`Shutting down Flowise Upsertion Worker ${this.upsertionWorkerId}...`)
                await upsertWorker.close()
            }

            if (this.queueEvents) {
                await this.queueEvents.close()
            }
        } catch (error) {
            logger.error('There was an error shutting down Flowise Worker...', error)
            await this.failExit()
        }

        await this.gracefullyExit()
    }
}
