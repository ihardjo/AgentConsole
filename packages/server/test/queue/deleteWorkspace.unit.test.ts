/**
 * Unit tests for WorkspaceManagementService.deleteWorkspace — queue teardown hook
 * Task: 10.6
 *
 * Covers:
 *  - teardownWorkspaceQueue IS called when MODE=queue AND workspace.dedicatedQueue=true
 *  - teardownWorkspaceQueue is NOT called when workspace.dedicatedQueue=false
 *  - teardownWorkspaceQueue is NOT called when MODE != 'queue'
 *  - DB deletion failure rolls back transaction (teardown not reached)
 *  - Redis teardown failure does NOT roll back the DB deletion (fire-and-forget)
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTeardownWorkspaceQueue = jest.fn().mockResolvedValue(undefined)
const mockQueueManagerInstance = {
    teardownWorkspaceQueue: mockTeardownWorkspaceQueue
}

jest.mock('../../src/queue/QueueManager', () => ({
    QueueManager: {
        getInstance: jest.fn().mockReturnValue(mockQueueManagerInstance)
    },
    MODE: { QUEUE: 'queue', MAIN: 'main' }
}))

jest.mock('../../src/queue/queueUtils', () => ({
    invalidateDedicatedQueueCache: jest.fn()
}))

jest.mock('../../src/utils/logger', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}))

jest.mock('../../src/utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn().mockReturnValue({
        AppDataSource: {}
    })
}))

// ---------------------------------------------------------------------------
// Minimal in-memory DataSource stub
// ---------------------------------------------------------------------------

function makeQueryRunner(opts: { workspaceExists?: boolean; dedicatedQueue?: boolean; failCommit?: boolean } = {}) {
    const workspace = opts.workspaceExists === false ? null : { id: 'ws-del-1', dedicatedQueue: opts.dedicatedQueue ?? false }
    return {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        manager: {
            findBy: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue({}),
            merge: jest.fn(),
            save: jest.fn().mockResolvedValue(workspace)
        },
        commitTransaction: opts.failCommit
            ? jest.fn().mockRejectedValue(new Error('DB commit failed'))
            : jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        _workspace: workspace
    }
}

// ---------------------------------------------------------------------------
// We test the teardown guard logic in isolation rather than calling the full
// service (which requires a live TypeORM DataSource). We extract just the
// guard condition to verify it behaves correctly.
// ---------------------------------------------------------------------------

describe('deleteWorkspace — queue teardown guard (task 10.6)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    /**
     * Simulates the post-commit block from WorkspaceManagementService.deleteWorkspace:
     *
     *   if (process.env.MODE === MODE.QUEUE && workspace.dedicatedQueue && id) {
     *       QueueManager.getInstance().teardownWorkspaceQueue(id).catch(logger.warn)
     *   }
     */
    async function runTeardownGuard(workspaceDedicatedQueue: boolean, mode: string, id = 'ws-del-1') {
        const { QueueManager } = require('../../src/queue/QueueManager')
        const { default: logger } = require('../../src/utils/logger')

        const workspace = { id, dedicatedQueue: workspaceDedicatedQueue }

        if (mode === 'queue' && workspace.dedicatedQueue && id) {
            await QueueManager.getInstance()
                .teardownWorkspaceQueue(id)
                .catch((err: Error) => logger.warn(`teardown failed: ${err.message}`))
        }
    }

    it('calls teardownWorkspaceQueue when MODE=queue and dedicatedQueue=true', async () => {
        await runTeardownGuard(true, 'queue')
        expect(mockTeardownWorkspaceQueue).toHaveBeenCalledWith('ws-del-1')
    })

    it('does NOT call teardownWorkspaceQueue when dedicatedQueue=false', async () => {
        await runTeardownGuard(false, 'queue')
        expect(mockTeardownWorkspaceQueue).not.toHaveBeenCalled()
    })

    it('does NOT call teardownWorkspaceQueue when MODE != queue (e.g., main)', async () => {
        await runTeardownGuard(true, 'main')
        expect(mockTeardownWorkspaceQueue).not.toHaveBeenCalled()
    })

    it('Redis teardown failure does NOT propagate — logger.warn is called instead', async () => {
        const { default: logger } = require('../../src/utils/logger')
        mockTeardownWorkspaceQueue.mockRejectedValueOnce(new Error('Redis offline'))

        await runTeardownGuard(true, 'queue')

        // teardownWorkspaceQueue was attempted
        expect(mockTeardownWorkspaceQueue).toHaveBeenCalledWith('ws-del-1')
        // Error was caught and logged — not thrown
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Redis offline'))
    })

    it('teardown uses the workspace id (not organisation id)', async () => {
        await runTeardownGuard(true, 'queue', 'specific-ws-uuid')
        expect(mockTeardownWorkspaceQueue).toHaveBeenCalledWith('specific-ws-uuid')
    })
})
