/**
 * Unit tests for the Worker command
 * Tasks: 10.3 (startup paths), 10.4 (shutdown)
 *
 * Covers:
 *  - Dedicated mode (WORKER_WORKSPACE_ID set): setupWorkspaceQueue called, shared path skipped
 *  - Shared mode (WORKER_WORKSPACE_ID absent): setupAllQueues called, workspace path skipped
 *  - stopProcess dedicated: closes prediction + upsert workers and queueEvents
 *  - stopProcess shared: closes prediction + upsert workers and queueEvents
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockWorkerInstance = {
    id: 'worker-id-1',
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
}

const mockUpsertWorkerInstance = {
    id: 'worker-id-2',
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn()
}

const mockPredQueueForWorker = {
    createWorker: jest.fn().mockReturnValue(mockWorkerInstance),
    getWorker: jest.fn().mockReturnValue(mockWorkerInstance),
    getQueueName: jest.fn().mockReturnValue('flowise-queue-ws-pred'),
    getQueue: jest.fn().mockReturnValue({ name: 'flowise-queue-ws-pred' })
}

const mockUpsertQueueForWorker = {
    createWorker: jest.fn().mockReturnValue(mockUpsertWorkerInstance),
    getWorker: jest.fn().mockReturnValue(mockUpsertWorkerInstance),
    getQueueName: jest.fn().mockReturnValue('flowise-queue-ws-ups'),
    getQueue: jest.fn().mockReturnValue({ name: 'flowise-queue-ws-ups' })
}

const mockQueueEventsInstance = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined)
}

const mockQueueManagerForWorker = {
    setupWorkspaceQueue: jest.fn().mockReturnValue({
        predictionQueue: mockPredQueueForWorker,
        upsertQueue: mockUpsertQueueForWorker
    }),
    setupAllQueues: jest.fn(),
    getQueue: jest.fn().mockImplementation((type) =>
        type === 'prediction' ? mockPredQueueForWorker : mockUpsertQueueForWorker
    ),
    getOrCreateWorkspaceQueue: jest.fn().mockImplementation((type) =>
        type === 'prediction' ? mockPredQueueForWorker : mockUpsertQueueForWorker
    ),
    getConnection: jest.fn().mockReturnValue({})
}

jest.mock('../../src/queue/QueueManager', () => ({
    QueueManager: {
        getInstance: jest.fn().mockReturnValue(mockQueueManagerForWorker)
    }
}))

jest.mock('bullmq', () => ({
    QueueEvents: jest.fn().mockImplementation(() => mockQueueEventsInstance),
    QueueEventsListener: jest.fn()
}))

jest.mock('../../src/DataSource', () => ({
    getDataSource: jest.fn().mockReturnValue({
        initialize: jest.fn().mockResolvedValue(undefined),
        runMigrations: jest.fn().mockResolvedValue(undefined)
    })
}))

jest.mock('../../src/utils/telemetry', () => ({
    Telemetry: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../src/NodesPool', () => ({
    NodesPool: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        componentNodes: {}
    }))
}))

jest.mock('../../src/CachePool', () => ({
    CachePool: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../src/AbortControllerPool', () => ({
    AbortControllerPool: jest.fn().mockImplementation(() => ({ abort: jest.fn() }))
}))

jest.mock('../../src/UsageCacheManager', () => ({
    UsageCacheManager: { getInstance: jest.fn().mockResolvedValue({}) }
}))

jest.mock('../../src/utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}))

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { QueueEvents } from 'bullmq'
import Worker from '../../src/commands/worker'
import { QueueManager } from '../../src/queue/QueueManager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Instantiate a Worker with private fields overridden via bracket notation. */
function makeWorker(opts: { workspaceId?: string; isDedicatedMode?: boolean } = {}) {
    const w = new Worker([], {} as any)
    if (opts.workspaceId !== undefined) {
        ;(w as any).workspaceId = opts.workspaceId
    }
    if (opts.isDedicatedMode !== undefined) {
        ;(w as any).isDedicatedMode = opts.isDedicatedMode
    }
    // stub gracefullyExit so tests don't call process.exit
    ;(w as any).gracefullyExit = jest.fn().mockResolvedValue(undefined)
    ;(w as any).failExit = jest.fn().mockResolvedValue(undefined)
    return w
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Worker — startup paths', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        delete process.env.WORKER_WORKSPACE_ID
        // Reset MODE to ensure isDedicatedMode logic is deterministic
        delete process.env.MODE
    })

    // Task 10.3 — dedicated path
    it('dedicated path: calls setupWorkspaceQueue (not setupAllQueues) when WORKER_WORKSPACE_ID is set', async () => {
        process.env.MODE = 'queue'
        process.env.WORKER_WORKSPACE_ID = 'ws-dedicated-123'

        const w = makeWorker({ workspaceId: 'ws-dedicated-123', isDedicatedMode: true })
        // Override prepareData to avoid real DB calls
        ;(w as any).prepareData = jest.fn().mockResolvedValue({
            appDataSource: {},
            telemetry: {},
            componentNodes: {},
            cachePool: {},
            abortControllerPool: { abort: jest.fn() },
            usageCacheManager: {}
        })
        // Prevent process.stdin.resume from blocking
        jest.spyOn(process.stdin, 'resume').mockImplementation(() => process.stdin)

        await w.run()

        expect(mockQueueManagerForWorker.setupWorkspaceQueue).toHaveBeenCalledWith(
            'ws-dedicated-123',
            expect.objectContaining({ componentNodes: expect.anything() })
        )
        expect(mockQueueManagerForWorker.setupAllQueues).not.toHaveBeenCalled()
    })

    it('dedicated path: creates two workers (prediction + upsert) for the workspace', async () => {
        process.env.MODE = 'queue'
        process.env.WORKER_WORKSPACE_ID = 'ws-dedicated-123'

        const w = makeWorker({ workspaceId: 'ws-dedicated-123', isDedicatedMode: true })
        ;(w as any).prepareData = jest.fn().mockResolvedValue({
            appDataSource: {},
            telemetry: {},
            componentNodes: {},
            cachePool: {},
            abortControllerPool: { abort: jest.fn() },
            usageCacheManager: {}
        })
        jest.spyOn(process.stdin, 'resume').mockImplementation(() => process.stdin)

        await w.run()

        expect(mockPredQueueForWorker.createWorker).toHaveBeenCalledTimes(1)
        expect(mockUpsertQueueForWorker.createWorker).toHaveBeenCalledTimes(1)
    })

    // Task 10.3 — shared path
    it('shared path: calls setupAllQueues (not setupWorkspaceQueue) when WORKER_WORKSPACE_ID is absent', async () => {
        process.env.MODE = 'queue'
        delete process.env.WORKER_WORKSPACE_ID

        const w = makeWorker({ workspaceId: undefined, isDedicatedMode: false })
        ;(w as any).prepareData = jest.fn().mockResolvedValue({
            appDataSource: {},
            telemetry: {},
            componentNodes: {},
            cachePool: {},
            abortControllerPool: { abort: jest.fn() },
            usageCacheManager: {}
        })
        jest.spyOn(process.stdin, 'resume').mockImplementation(() => process.stdin)

        await w.run()

        expect(mockQueueManagerForWorker.setupAllQueues).toHaveBeenCalledTimes(1)
        expect(mockQueueManagerForWorker.setupWorkspaceQueue).not.toHaveBeenCalled()
    })
})

describe('Worker — shutdown (stopProcess)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // Task 10.4 — dedicated shutdown
    it('dedicated mode: closes prediction worker, upsert worker, and QueueEvents on stopProcess', async () => {
        const w = makeWorker({ workspaceId: 'ws-stop-123', isDedicatedMode: true })
        w.predictionWorkerId = 'pred-1'
        w.upsertionWorkerId = 'ups-1'
        // Simulate queueEvents having been assigned during run()
        ;(w as any).queueEvents = mockQueueEventsInstance

        await (w as any).stopProcess()

        expect(mockWorkerInstance.close).toHaveBeenCalledTimes(1)
        expect(mockUpsertWorkerInstance.close).toHaveBeenCalledTimes(1)
        expect(mockQueueEventsInstance.close).toHaveBeenCalledTimes(1)
    })

    // Task 10.4 — shared shutdown
    it('shared mode: closes prediction worker, upsert worker, and QueueEvents on stopProcess', async () => {
        const w = makeWorker({ workspaceId: undefined, isDedicatedMode: false })
        w.predictionWorkerId = 'pred-shared'
        w.upsertionWorkerId = 'ups-shared'
        ;(w as any).queueEvents = mockQueueEventsInstance

        await (w as any).stopProcess()

        expect(mockWorkerInstance.close).toHaveBeenCalledTimes(1)
        expect(mockUpsertWorkerInstance.close).toHaveBeenCalledTimes(1)
        expect(mockQueueEventsInstance.close).toHaveBeenCalledTimes(1)
    })

    // Task 10.4 — no queueEvents means no close call
    it('does not throw when queueEvents is undefined', async () => {
        const w = makeWorker({ workspaceId: undefined, isDedicatedMode: false })
        ;(w as any).queueEvents = undefined

        await expect((w as any).stopProcess()).resolves.not.toThrow()
    })
})
