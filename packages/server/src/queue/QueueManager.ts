import { BaseQueue } from './BaseQueue'
import { PredictionQueue } from './PredictionQueue'
import { UpsertQueue } from './UpsertQueue'
import { IComponentNodes, MODE } from '../Interface'
import { Telemetry } from '../utils/telemetry'
import { CachePool } from '../CachePool'
import { DataSource } from 'typeorm'
import { AbortControllerPool } from '../AbortControllerPool'
import { QueueEventsProducer, RedisOptions } from 'bullmq'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { Express } from 'express'
import { UsageCacheManager } from '../UsageCacheManager'
import { ExpressAdapter } from '@bull-board/express'
import logger from '../utils/logger'

const QUEUE_NAME = process.env.QUEUE_NAME || 'flowise-queue'

export type QUEUE_TYPE = 'prediction' | 'upsert'

export class QueueManager {
    private static instance: QueueManager
    private queues: Map<string, BaseQueue> = new Map()
    private connection: RedisOptions
    private bullBoardRouter?: Express
    private serverAdapter?: ExpressAdapter
    private bullBoardApi?: { addQueue: (q: BullMQAdapter) => void; replaceQueues: (qs: ReadonlyArray<BullMQAdapter>) => void }
    private predictionQueueEventsProducer?: QueueEventsProducer
    private workspaceQueueEventsProducers: Map<string, QueueEventsProducer> = new Map()

    private constructor() {
        if (process.env.REDIS_URL) {
            let tlsOpts = undefined
            if (process.env.REDIS_URL.startsWith('rediss://')) {
                tlsOpts = {
                    rejectUnauthorized: false
                }
            } else if (process.env.REDIS_TLS === 'true') {
                tlsOpts = {
                    cert: process.env.REDIS_CERT ? Buffer.from(process.env.REDIS_CERT, 'base64') : undefined,
                    key: process.env.REDIS_KEY ? Buffer.from(process.env.REDIS_KEY, 'base64') : undefined,
                    ca: process.env.REDIS_CA ? Buffer.from(process.env.REDIS_CA, 'base64') : undefined
                }
            }
            this.connection = {
                url: process.env.REDIS_URL,
                tls: tlsOpts,
                enableReadyCheck: true,
                keepAlive:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            }
        } else {
            let tlsOpts = undefined
            if (process.env.REDIS_TLS === 'true') {
                tlsOpts = {
                    cert: process.env.REDIS_CERT ? Buffer.from(process.env.REDIS_CERT, 'base64') : undefined,
                    key: process.env.REDIS_KEY ? Buffer.from(process.env.REDIS_KEY, 'base64') : undefined,
                    ca: process.env.REDIS_CA ? Buffer.from(process.env.REDIS_CA, 'base64') : undefined
                }
            }
            this.connection = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                username: process.env.REDIS_USERNAME || undefined,
                password: process.env.REDIS_PASSWORD || undefined,
                tls: tlsOpts,
                enableReadyCheck: true,
                keepAlive:
                    process.env.REDIS_KEEP_ALIVE && !isNaN(parseInt(process.env.REDIS_KEEP_ALIVE, 10))
                        ? parseInt(process.env.REDIS_KEEP_ALIVE, 10)
                        : undefined
            }
        }
    }

    public static getInstance(): QueueManager {
        if (!QueueManager.instance) {
            QueueManager.instance = new QueueManager()
        }
        return QueueManager.instance
    }

    public registerQueue(name: string, queue: BaseQueue) {
        this.queues.set(name, queue)
    }

    public getConnection() {
        return this.connection
    }

    public getQueue(name: QUEUE_TYPE): BaseQueue {
        const queue = this.queues.get(name)
        if (!queue) throw new Error(`Queue ${name} not found`)
        return queue
    }

    /**
     * Returns the workspace-scoped queue for the given type and workspaceId.
     * Lazily creates and caches the queue under key `<queueName>:<workspaceId>:<type>`.
     * Queue name: `<QUEUE_NAME>-<workspaceId>-<type>`
     *
     * TODO: Each workspace queue currently opens its own IORedis connection via `this.connection`.
     * A future optimisation is to share a single IORedis connection (or a small pool) across all
     * workspace queues to reduce the total number of open Redis connections.
     */
    public getOrCreateWorkspaceQueue(
        type: QUEUE_TYPE,
        workspaceId: string,
        options?: {
            componentNodes?: IComponentNodes
            telemetry?: Telemetry
            cachePool?: CachePool
            appDataSource?: DataSource
            abortControllerPool?: AbortControllerPool
            usageCacheManager?: UsageCacheManager
        }
    ): BaseQueue {
        const cacheKey = `${QUEUE_NAME}:${workspaceId}:${type}`
        const existing = this.queues.get(cacheKey)
        if (existing) return existing

        const queueName = `${QUEUE_NAME}-${workspaceId}-${type === 'prediction' ? 'prediction' : 'upsertion'}`

        let queue: BaseQueue
        if (type === 'prediction') {
            queue = new PredictionQueue(queueName, this.connection, {
                componentNodes: options?.componentNodes ?? ({} as IComponentNodes),
                telemetry: options?.telemetry,
                cachePool: options?.cachePool,
                appDataSource: options?.appDataSource,
                abortControllerPool: options?.abortControllerPool,
                usageCacheManager: options?.usageCacheManager
            })
            // QueueEventsProducer required for abort event propagation on this workspace queue
            const producer = new QueueEventsProducer(queueName, { connection: this.connection })
            this.workspaceQueueEventsProducers.set(cacheKey, producer)
        } else {
            queue = new UpsertQueue(queueName, this.connection, {
                componentNodes: options?.componentNodes ?? ({} as IComponentNodes),
                telemetry: options?.telemetry,
                cachePool: options?.cachePool,
                appDataSource: options?.appDataSource,
                usageCacheManager: options?.usageCacheManager
            })
        }

        this.queues.set(cacheKey, queue)

        // Incrementally register the new queue with BullBoard (avoids full map rebuild)
        if (this.bullBoardApi) {
            this.bullBoardApi.addQueue(new BullMQAdapter(queue.getQueue()))
        }

        return queue
    }

    /**
     * Worker-side initialisation for dedicated-queue mode (`MODE=queue` + `WORKER_WORKSPACE_ID` set).
     * Eagerly creates both workspace-scoped queues (prediction + upsert) by delegating to
     * `getOrCreateWorkspaceQueue`, ensuring they are cached and available before the worker starts.
     *
     * Returns the two created queues so callers can attach workers without a second look-up.
     */
    public setupWorkspaceQueue(
        workspaceId: string,
        options: {
            componentNodes: IComponentNodes
            telemetry: Telemetry
            cachePool: CachePool
            appDataSource: DataSource
            abortControllerPool: AbortControllerPool
            usageCacheManager: UsageCacheManager
        }
    ): { predictionQueue: BaseQueue; upsertQueue: BaseQueue } {
        const predictionQueue = this.getOrCreateWorkspaceQueue('prediction', workspaceId, options)
        const upsertQueue = this.getOrCreateWorkspaceQueue('upsert', workspaceId, options)
        return { predictionQueue, upsertQueue }
    }

    /**
     * Internal helper: closes the QueueEvents connections for both workspace queues.
     * Separated from obliterate for testability.
     */
    private async closeWorkspaceQueues(workspaceId: string): Promise<void> {
        const predictionKey = `${QUEUE_NAME}:${workspaceId}:prediction`
        const upsertKey = `${QUEUE_NAME}:${workspaceId}:upsert`

        const predProducer = this.workspaceQueueEventsProducers.get(predictionKey)
        if (predProducer) {
            await predProducer.close()
            this.workspaceQueueEventsProducers.delete(predictionKey)
        }

        const predQueue = this.queues.get(predictionKey)
        if (predQueue) {
            await predQueue.getQueueEvents().close()
        }

        const upsertQueue = this.queues.get(upsertKey)
        if (upsertQueue) {
            await upsertQueue.getQueueEvents().close()
        }
    }

    /**
     * Tears down both workspace-scoped queues for the given workspaceId:
     * 1. Logs a warning if there are active jobs.
     * 2. Obliterates both queues from Redis (removes all jobs and keys).
     * 3. Closes all QueueEvents connections for the workspace queues.
     * 4. Removes the queue instances from the internal cache.
     * 5. Removes BullBoard adapter registrations.
     *
     * Called after workspace deletion DB transaction commits.
     * Only active in MODE=queue when workspace.dedicatedQueue=true.
     */
    public async teardownWorkspaceQueue(workspaceId: string): Promise<void> {
        const predictionKey = `${QUEUE_NAME}:${workspaceId}:prediction`
        const upsertKey = `${QUEUE_NAME}:${workspaceId}:upsert`

        const predQueue = this.queues.get(predictionKey)
        const upsertQueue = this.queues.get(upsertKey)

        // No-op if workspace has no registered queues (e.g., no job was ever enqueued)
        if (!predQueue && !upsertQueue) {
            logger.debug(`[QueueManager] No workspace queues registered for workspace ${workspaceId} — skipping teardown`)
            return
        }

        // Warn if any jobs are still active
        for (const [label, queue] of [
            ['prediction', predQueue],
            ['upsert', upsertQueue]
        ] as [string, BaseQueue | undefined][]) {
            if (!queue) continue
            try {
                const counts = await queue.getJobCounts()
                const activeCount = counts['active'] ?? 0
                if (activeCount > 0) {
                    logger.warn(
                        `[QueueManager] Workspace ${workspaceId} ${label} queue has ${activeCount} active job(s) — obliterating with force:true. In-flight jobs will be abandoned.`
                    )
                }
            } catch (err) {
                logger.warn(`[QueueManager] Could not read job counts for workspace ${workspaceId} ${label} queue: ${err}`)
            }
        }

        // Obliterate queues from Redis
        if (predQueue) {
            await predQueue.clearQueue()
        }
        if (upsertQueue) {
            await upsertQueue.clearQueue()
        }

        // Close QueueEvents connections
        await this.closeWorkspaceQueues(workspaceId)

        // Remove from internal cache
        this.queues.delete(predictionKey)
        this.queues.delete(upsertKey)

        // Deregister from BullBoard
        if (this.bullBoardApi) {
            const remainingAdapters = Array.from(this.queues.values()).map((q) => new BullMQAdapter(q.getQueue()))
            this.bullBoardApi.replaceQueues(remainingAdapters)
        }

        logger.info(`[QueueManager] Workspace ${workspaceId} queues torn down successfully`)
    }

    public getPredictionQueueEventsProducer(): QueueEventsProducer {
        if (!this.predictionQueueEventsProducer) throw new Error('Prediction queue events producer not found')
        return this.predictionQueueEventsProducer
    }

    public getWorkspaceQueueEventsProducer(workspaceId: string): QueueEventsProducer {
        const producer = this.workspaceQueueEventsProducers.get(`${QUEUE_NAME}:${workspaceId}:prediction`)
        if (!producer) throw new Error(`No QueueEventsProducer found for workspace ${workspaceId}`)
        return producer
    }

    /**
     * Initialises BullBoard with an empty queue list and stores the serverAdapter.
     * Used in MODE=queue where workspace queues are lazily registered
     * later via `getOrCreateWorkspaceQueue`.
     */
    public initBullBoard(serverAdapter: ExpressAdapter): void {
        this.serverAdapter = serverAdapter
        this.bullBoardApi = createBullBoard({ queues: [], serverAdapter })
        this.bullBoardRouter = serverAdapter.getRouter()
    }

    public getBullBoardRouter(): Express {
        if (!this.bullBoardRouter) throw new Error('BullBoard router not found')
        return this.bullBoardRouter
    }

    public async getAllJobCounts(): Promise<{ [queueName: string]: { [status: string]: number } }> {
        const counts: { [queueName: string]: { [status: string]: number } } = {}

        for (const [name, queue] of this.queues) {
            counts[name] = await queue.getJobCounts()
        }

        return counts
    }

    public setupAllQueues({
        componentNodes,
        telemetry,
        cachePool,
        appDataSource,
        abortControllerPool,
        usageCacheManager,
        serverAdapter
    }: {
        componentNodes: IComponentNodes
        telemetry: Telemetry
        cachePool: CachePool
        appDataSource: DataSource
        abortControllerPool: AbortControllerPool
        usageCacheManager: UsageCacheManager
        serverAdapter?: ExpressAdapter
    }) {
        const predictionQueueName = `${QUEUE_NAME}-prediction`
        const predictionQueue = new PredictionQueue(predictionQueueName, this.connection, {
            componentNodes,
            telemetry,
            cachePool,
            appDataSource,
            abortControllerPool,
            usageCacheManager
        })
        this.registerQueue('prediction', predictionQueue)

        this.predictionQueueEventsProducer = new QueueEventsProducer(predictionQueue.getQueueName(), {
            connection: this.connection
        })

        const upsertionQueueName = `${QUEUE_NAME}-upsertion`
        const upsertionQueue = new UpsertQueue(upsertionQueueName, this.connection, {
            componentNodes,
            telemetry,
            cachePool,
            appDataSource,
            usageCacheManager
        })
        this.registerQueue('upsert', upsertionQueue)

        if (serverAdapter) {
            this.serverAdapter = serverAdapter
            this.bullBoardApi = createBullBoard({
                queues: [new BullMQAdapter(predictionQueue.getQueue()), new BullMQAdapter(upsertionQueue.getQueue())],
                serverAdapter: serverAdapter
            })
            this.bullBoardRouter = serverAdapter.getRouter()
        }
    }
}

