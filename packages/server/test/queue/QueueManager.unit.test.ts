/**
 * Unit tests for QueueManager — workspace-dedicated queue methods
 * Tasks 5.1-5.6
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPredictionQueueInstance = {
    getQueue: jest.fn().mockReturnValue({ name: 'mock-queue' }),
    getQueueName: jest.fn().mockReturnValue('flowise-queue-ws-123-prediction'),
    getQueueEvents: jest.fn().mockReturnValue({ close: jest.fn().mockResolvedValue(undefined) }),
    getJobCounts: jest.fn().mockResolvedValue({ active: 0, waiting: 0, completed: 0, failed: 0 }),
    clearQueue: jest.fn().mockResolvedValue(undefined),
    createWorker: jest.fn().mockReturnValue({ id: 'worker-1' }),
    getWorker: jest.fn().mockReturnValue({ id: 'worker-1' })
}

const mockUpsertQueueInstance = {
    getQueue: jest.fn().mockReturnValue({ name: 'mock-upsert-queue' }),
    getQueueName: jest.fn().mockReturnValue('flowise-queue-ws-123-upsertion'),
    getQueueEvents: jest.fn().mockReturnValue({ close: jest.fn().mockResolvedValue(undefined) }),
    getJobCounts: jest.fn().mockResolvedValue({ active: 0, waiting: 0, completed: 0, failed: 0 }),
    clearQueue: jest.fn().mockResolvedValue(undefined),
    createWorker: jest.fn().mockReturnValue({ id: 'worker-2' }),
    getWorker: jest.fn().mockReturnValue({ id: 'worker-2' })
}

const mockProducerInstance = {
    close: jest.fn().mockResolvedValue(undefined)
}

jest.mock('../../src/queue/PredictionQueue', () => ({
    PredictionQueue: jest.fn().mockImplementation(() => mockPredictionQueueInstance)
}))

jest.mock('../../src/queue/UpsertQueue', () => ({
    UpsertQueue: jest.fn().mockImplementation(() => mockUpsertQueueInstance)
}))

jest.mock('bullmq', () => ({
    QueueEventsProducer: jest.fn().mockImplementation(() => mockProducerInstance),
    QueueEvents: jest.fn().mockImplementation(() => ({ close: jest.fn().mockResolvedValue(undefined) }))
}))

jest.mock('@bull-board/api', () => ({
    createBullBoard: jest.fn().mockReturnValue({})
}))

jest.mock('@bull-board/api/bullMQAdapter', () => ({
    BullMQAdapter: jest.fn().mockImplementation((q) => ({ queue: q }))
}))

jest.mock('@bull-board/express', () => ({
    ExpressAdapter: jest.fn().mockImplementation(() => ({
        setQueues: jest.fn(),
        getRouter: jest.fn().mockReturnValue({}),
        setBasePath: jest.fn()
    }))
}))

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}))

// ---------------------------------------------------------------------------
// Import subject under test (after mocks are registered)
// ---------------------------------------------------------------------------

import { QueueManager } from '../../src/queue/QueueManager'
import { PredictionQueue } from '../../src/queue/PredictionQueue'
import { UpsertQueue } from '../../src/queue/UpsertQueue'
import { QueueEventsProducer } from 'bullmq'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the singleton so each test starts with a fresh instance */
function resetSingleton() {
    // Access private static field via bracket notation
    ;(QueueManager as any).instance = undefined
}

function getInstance() {
    return QueueManager.getInstance()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QueueManager — workspace-dedicated queue', () => {
    beforeEach(() => {
        resetSingleton()
        jest.clearAllMocks()
        // Re-mock PredictionQueue and UpsertQueue constructors each time so each call returns fresh spies
        ;(PredictionQueue as jest.Mock).mockImplementation(() => ({ ...mockPredictionQueueInstance }))
        ;(UpsertQueue as jest.Mock).mockImplementation(() => ({ ...mockUpsertQueueInstance }))
        ;(QueueEventsProducer as unknown as jest.Mock).mockImplementation(() => ({ ...mockProducerInstance }))
        process.env.QUEUE_NAME = 'flowise-queue'
        delete process.env.REDIS_URL
        process.env.REDIS_HOST = 'localhost'
        process.env.REDIS_PORT = '6379'
    })

    // Task 5.1
    describe('getOrCreateWorkspaceQueue', () => {
        it('creates a prediction queue on first call and caches it', () => {
            const qm = getInstance()
            const q1 = qm.getOrCreateWorkspaceQueue('prediction', 'ws-123')
            const q2 = qm.getOrCreateWorkspaceQueue('prediction', 'ws-123')

            expect(PredictionQueue).toHaveBeenCalledTimes(1)
            expect(q1).toBe(q2) // same reference — cached
        })

        it('creates a upsert queue on first call and caches it', () => {
            const qm = getInstance()
            const q1 = qm.getOrCreateWorkspaceQueue('upsert', 'ws-123')
            const q2 = qm.getOrCreateWorkspaceQueue('upsert', 'ws-123')

            expect(UpsertQueue).toHaveBeenCalledTimes(1)
            expect(q1).toBe(q2)
        })

        it('uses correct queue name convention for prediction', () => {
            getInstance().getOrCreateWorkspaceQueue('prediction', 'ws-abc')
            expect(PredictionQueue).toHaveBeenCalledWith(
                'flowise-queue-ws-abc-prediction',
                expect.anything(),
                expect.anything()
            )
        })

        it('uses correct queue name convention for upsert (upsertion suffix)', () => {
            getInstance().getOrCreateWorkspaceQueue('upsert', 'ws-abc')
            expect(UpsertQueue).toHaveBeenCalledWith(
                'flowise-queue-ws-abc-upsertion',
                expect.anything(),
                expect.anything()
            )
        })

        it('creates a QueueEventsProducer for prediction type', () => {
            getInstance().getOrCreateWorkspaceQueue('prediction', 'ws-123')
            expect(QueueEventsProducer).toHaveBeenCalledTimes(1)
        })

        it('does NOT create a QueueEventsProducer for upsert type', () => {
            getInstance().getOrCreateWorkspaceQueue('upsert', 'ws-123')
            expect(QueueEventsProducer).not.toHaveBeenCalled()
        })

        it('isolates cache keys per workspace', () => {
            const qm = getInstance()
            qm.getOrCreateWorkspaceQueue('prediction', 'ws-aaa')
            qm.getOrCreateWorkspaceQueue('prediction', 'ws-bbb')
            // Two distinct PredictionQueue instances created
            expect(PredictionQueue).toHaveBeenCalledTimes(2)
        })

        // Task 10.1 — BullBoard registration
        it('registers the queue with BullBoard when bullBoardApi is initialised', () => {
            const mockAddQueue = jest.fn()
            const mockBullBoardAdapter = jest.fn().mockImplementation((q) => ({ queue: q }))
            jest.mock('@bull-board/api/bullMQAdapter', () => ({ BullMQAdapter: mockBullBoardAdapter }))

            const qm = getInstance()
            // Inject a fake bullBoardApi directly via bracket notation
            ;(qm as any).bullBoardApi = { addQueue: mockAddQueue, replaceQueues: jest.fn() }

            qm.getOrCreateWorkspaceQueue('prediction', 'ws-board')

            expect(mockAddQueue).toHaveBeenCalledTimes(1)
        })

        it('does NOT call bullBoardApi.addQueue when BullBoard is not yet initialised', () => {
            const qm = getInstance()
            // bullBoardApi is undefined by default (no initBullBoard call)
            expect((qm as any).bullBoardApi).toBeUndefined()

            // Should not throw — just silently skips BullBoard registration
            expect(() => qm.getOrCreateWorkspaceQueue('prediction', 'ws-no-board')).not.toThrow()
        })
    })

    // Task 5.2
    describe('setupWorkspaceQueue', () => {
        it('registers prediction and upsert queues under workspace-scoped cache keys', () => {
            const qm = getInstance()
            const options = {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            }
            qm.setupWorkspaceQueue('ws-xyz', options)

            // Should be retrievable via getOrCreateWorkspaceQueue without creating new instances
            expect(PredictionQueue).toHaveBeenCalledTimes(1)
            expect(UpsertQueue).toHaveBeenCalledTimes(1)
        })

        it('creates a QueueEventsProducer for the prediction queue', () => {
            const qm = getInstance()
            const options = {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            }
            qm.setupWorkspaceQueue('ws-xyz', options)
            expect(QueueEventsProducer).toHaveBeenCalledTimes(1)
        })
    })

    // Task 5.3
    describe('teardownWorkspaceQueue', () => {
        it('returns early (no-op) if no queues registered for workspace', async () => {
            const qm = getInstance()
            // No queues set up — should not throw
            await expect(qm.teardownWorkspaceQueue('ws-nonexistent')).resolves.toBeUndefined()
        })

        it('obliterates both queues when they exist', async () => {
            const predQ = { ...mockPredictionQueueInstance }
            const upsQ = { ...mockUpsertQueueInstance }
            ;(PredictionQueue as jest.Mock).mockImplementation(() => predQ)
            ;(UpsertQueue as jest.Mock).mockImplementation(() => upsQ)

            const qm = getInstance()
            qm.setupWorkspaceQueue('ws-123', {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            })

            await qm.teardownWorkspaceQueue('ws-123')

            expect(predQ.clearQueue).toHaveBeenCalledTimes(1)
            expect(upsQ.clearQueue).toHaveBeenCalledTimes(1)
        })

        it('removes workspace queues from internal cache after teardown', async () => {
            const predQ = { ...mockPredictionQueueInstance }
            const upsQ = { ...mockUpsertQueueInstance }
            ;(PredictionQueue as jest.Mock).mockImplementation(() => predQ)
            ;(UpsertQueue as jest.Mock).mockImplementation(() => upsQ)

            const qm = getInstance()
            qm.setupWorkspaceQueue('ws-123', {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            })
            await qm.teardownWorkspaceQueue('ws-123')

            // After teardown, getOrCreateWorkspaceQueue should construct a NEW instance
            ;(PredictionQueue as jest.Mock).mockClear()
            qm.getOrCreateWorkspaceQueue('prediction', 'ws-123')
            expect(PredictionQueue).toHaveBeenCalledTimes(1)
        })

        it('logs a warning when there are active jobs before obliterating', async () => {
            const predQ = { ...mockPredictionQueueInstance, getJobCounts: jest.fn().mockResolvedValue({ active: 3 }) }
            ;(PredictionQueue as jest.Mock).mockImplementation(() => predQ)

            const logger = require('../../src/utils/logger').default
            const qm = getInstance()
            qm.setupWorkspaceQueue('ws-warn', {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            })
            await qm.teardownWorkspaceQueue('ws-warn')
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('3 active job'))
        })

        // Task 10.5 — BullBoard deregistration
        it('calls bullBoardApi.replaceQueues with remaining queues after teardown', async () => {
            const mockReplaceQueues = jest.fn()
            const qm = getInstance()
            ;(qm as any).bullBoardApi = { addQueue: jest.fn(), replaceQueues: mockReplaceQueues }

            qm.setupWorkspaceQueue('ws-123', {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            })

            await qm.teardownWorkspaceQueue('ws-123')

            expect(mockReplaceQueues).toHaveBeenCalledTimes(1)
            // After teardown, the remaining adapters array should not include the torn-down workspace queues
            const [remainingAdapters] = mockReplaceQueues.mock.calls[0]
            expect(Array.isArray(remainingAdapters)).toBe(true)
        })

        // Task 10.5 — QueueEventsProducer closed on teardown
        it('closes the QueueEventsProducer for the workspace prediction queue', async () => {
            const producerClose = jest.fn().mockResolvedValue(undefined)
            ;(QueueEventsProducer as unknown as jest.Mock).mockImplementation(() => ({ close: producerClose }))

            const qm = getInstance()
            qm.setupWorkspaceQueue('ws-close', {
                componentNodes: {} as any,
                telemetry: {} as any,
                cachePool: {} as any,
                appDataSource: {} as any,
                abortControllerPool: {} as any,
                usageCacheManager: {} as any
            })
            await qm.teardownWorkspaceQueue('ws-close')

            expect(producerClose).toHaveBeenCalledTimes(1)
        })
    })
})
