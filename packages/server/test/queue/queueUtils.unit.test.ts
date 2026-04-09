/**
 * Unit tests for queueUtils — routing helpers
 * Tasks: 10.2
 *
 * Covers:
 *  - getWorkspaceQueue: entity path (zero DB) — dedicated returns getOrCreateWorkspaceQueue
 *  - getWorkspaceQueue: entity path — shared returns getQueue
 *  - getWorkspaceQueue: string path with dataSource — dedicated returns getOrCreateWorkspaceQueue
 *  - getWorkspaceQueue: string path with dataSource — shared returns getQueue
 *  - getWorkspaceQueue: string path without dataSource — throws
 *  - isDedicatedQueue: returns value from DB and caches it
 *  - isDedicatedQueue: returns cached value within TTL (no second DB call)
 *  - invalidateDedicatedQueueCache: next call re-reads from DB
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSharedQueue = { name: 'shared-prediction' }
const mockDedicatedQueue = { name: 'dedicated-ws-prediction' }

const mockQueueManager = {
    getQueue: jest.fn().mockReturnValue(mockSharedQueue),
    getOrCreateWorkspaceQueue: jest.fn().mockReturnValue(mockDedicatedQueue)
}

jest.mock('../../src/utils/logger', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}))

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { getWorkspaceQueue, isDedicatedQueue, invalidateDedicatedQueueCache } from '../../src/queue/queueUtils'
import { Workspace } from '../../src/custom-rbac/entities/workspace.entity'
import { QueueManager } from '../../src/queue/QueueManager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkspace(dedicatedQueue: boolean, id = 'ws-test'): Workspace {
    return { id, dedicatedQueue } as Workspace
}

function makeDataSource(dedicatedQueue: boolean) {
    return {
        getRepository: jest.fn().mockReturnValue({
            findOneBy: jest.fn().mockResolvedValue({ dedicatedQueue })
        })
    } as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queueUtils — getWorkspaceQueue', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    // Task 10.2 — entity path, dedicated=true
    it('entity path: returns getOrCreateWorkspaceQueue when dedicatedQueue=true', async () => {
        const workspace = makeWorkspace(true, 'ws-dedicated')
        const result = await getWorkspaceQueue('prediction', workspace, mockQueueManager as unknown as QueueManager)

        expect(mockQueueManager.getOrCreateWorkspaceQueue).toHaveBeenCalledWith('prediction', 'ws-dedicated')
        expect(mockQueueManager.getQueue).not.toHaveBeenCalled()
        expect(result).toBe(mockDedicatedQueue)
    })

    // Task 10.2 — entity path, dedicated=false
    it('entity path: returns getQueue when dedicatedQueue=false', async () => {
        const workspace = makeWorkspace(false, 'ws-shared')
        const result = await getWorkspaceQueue('prediction', workspace, mockQueueManager as unknown as QueueManager)

        expect(mockQueueManager.getQueue).toHaveBeenCalledWith('prediction')
        expect(mockQueueManager.getOrCreateWorkspaceQueue).not.toHaveBeenCalled()
        expect(result).toBe(mockSharedQueue)
    })

    // Task 10.2 — string path, dedicated=true
    it('string path: returns getOrCreateWorkspaceQueue when DB says dedicatedQueue=true', async () => {
        const dataSource = makeDataSource(true)
        const result = await getWorkspaceQueue('prediction', 'ws-db-dedicated', mockQueueManager as unknown as QueueManager, dataSource)

        expect(mockQueueManager.getOrCreateWorkspaceQueue).toHaveBeenCalledWith('prediction', 'ws-db-dedicated')
        expect(result).toBe(mockDedicatedQueue)
    })

    // Task 10.2 — string path, dedicated=false
    it('string path: returns getQueue when DB says dedicatedQueue=false', async () => {
        const dataSource = makeDataSource(false)
        const result = await getWorkspaceQueue('upsert', 'ws-db-shared', mockQueueManager as unknown as QueueManager, dataSource)

        expect(mockQueueManager.getQueue).toHaveBeenCalledWith('upsert')
        expect(result).toBe(mockSharedQueue)
    })

    // Task 10.2 — string path without dataSource — must throw
    it('string path: throws when dataSource is absent', async () => {
        await expect(
            getWorkspaceQueue('prediction', 'ws-no-ds', mockQueueManager as unknown as QueueManager)
        ).rejects.toThrow('dataSource is required')
    })
})

describe('queueUtils — isDedicatedQueue cache behaviour', () => {
    const WORKSPACE_ID = 'ws-cache-test'

    beforeEach(() => {
        // Clear the module-level cache between tests by invalidating the key
        invalidateDedicatedQueueCache(WORKSPACE_ID)
        jest.clearAllMocks()
    })

    it('reads from DB on first call', async () => {
        const dataSource = makeDataSource(true)
        const result = await isDedicatedQueue(WORKSPACE_ID, dataSource)

        expect(result).toBe(true)
        expect(dataSource.getRepository().findOneBy).toHaveBeenCalledTimes(1)
    })

    it('returns cached value on second call within TTL (no second DB read)', async () => {
        const dataSource = makeDataSource(true)

        await isDedicatedQueue(WORKSPACE_ID, dataSource)
        const result = await isDedicatedQueue(WORKSPACE_ID, dataSource)

        expect(result).toBe(true)
        // findOneBy called only once — second call served from cache
        expect(dataSource.getRepository().findOneBy).toHaveBeenCalledTimes(1)
    })

    it('returns false when workspace not found in DB', async () => {
        const dataSource = {
            getRepository: jest.fn().mockReturnValue({
                findOneBy: jest.fn().mockResolvedValue(null)
            })
        } as any

        const result = await isDedicatedQueue(WORKSPACE_ID, dataSource)
        expect(result).toBe(false)
    })
})

describe('queueUtils — invalidateDedicatedQueueCache', () => {
    const WORKSPACE_ID = 'ws-invalidate-test'

    beforeEach(() => {
        invalidateDedicatedQueueCache(WORKSPACE_ID)
        jest.clearAllMocks()
    })

    it('forces a DB re-read after invalidation', async () => {
        const dataSource = makeDataSource(true)

        // Prime the cache
        await isDedicatedQueue(WORKSPACE_ID, dataSource)
        expect(dataSource.getRepository().findOneBy).toHaveBeenCalledTimes(1)

        // Invalidate and call again — must re-read
        invalidateDedicatedQueueCache(WORKSPACE_ID)
        await isDedicatedQueue(WORKSPACE_ID, dataSource)

        expect(dataSource.getRepository().findOneBy).toHaveBeenCalledTimes(2)
    })
})
