/**
 * Unit tests for chat-messages/abortChatMessage — queue routing
 * Task: 10.7
 *
 * Covers:
 *  - MODE=queue + dedicatedQueue=true → getWorkspaceQueueEventsProducer used
 *  - MODE=queue + dedicatedQueue=false → getPredictionQueueEventsProducer used
 *  - MODE=queue + workspaceId absent → getPredictionQueueEventsProducer used (shared fallback)
 *  - MODE != queue → abortControllerPool.abort called (in-process abort)
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPublishEvent = jest.fn().mockResolvedValue(undefined)

const mockWorkspaceProducer = {
    publishEvent: mockPublishEvent
}

const mockSharedProducer = {
    publishEvent: mockPublishEvent
}

const mockAbortControllerPool = {
    abort: jest.fn()
}

const mockAppServer = {
    AppDataSource: {},
    queueManager: {
        getWorkspaceQueueEventsProducer: jest.fn().mockReturnValue(mockWorkspaceProducer),
        getPredictionQueueEventsProducer: jest.fn().mockReturnValue(mockSharedProducer)
    },
    abortControllerPool: mockAbortControllerPool
}

jest.mock('../../src/utils/getRunningExpressApp', () => ({
    getRunningExpressApp: jest.fn().mockReturnValue(mockAppServer)
}))

// isDedicatedQueue is controlled per-test
const mockIsDedicatedQueue = jest.fn()
jest.mock('../../src/queue/queueUtils', () => ({
    isDedicatedQueue: (...args: any[]) => mockIsDedicatedQueue(...args)
}))

jest.mock('../../src/utils/logger', () => ({
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}))

// ---------------------------------------------------------------------------
// Import subject under test — after mocks
// ---------------------------------------------------------------------------

import chatMessagesService from '../../src/services/chat-messages/index'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('abortChatMessage — queue routing (task 10.7)', () => {
    const CHAT_ID = 'chat-abc'
    const CHATFLOW_ID = 'cf-xyz'
    const WORKSPACE_ID = 'ws-abort-test'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    // Task 10.7 — dedicated workspace producer
    it('MODE=queue + dedicatedQueue=true → uses workspace-specific QueueEventsProducer', async () => {
        process.env.MODE = 'queue'
        mockIsDedicatedQueue.mockResolvedValue(true)

        await chatMessagesService.abortChatMessage(CHAT_ID, CHATFLOW_ID, WORKSPACE_ID)

        expect(mockAppServer.queueManager.getWorkspaceQueueEventsProducer).toHaveBeenCalledWith(WORKSPACE_ID)
        expect(mockPublishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventName: 'abort', id: `${CHATFLOW_ID}_${CHAT_ID}` })
        )
        expect(mockAppServer.queueManager.getPredictionQueueEventsProducer).not.toHaveBeenCalled()
    })

    // Task 10.7 — shared producer when dedicatedQueue=false
    it('MODE=queue + dedicatedQueue=false → uses shared getPredictionQueueEventsProducer', async () => {
        process.env.MODE = 'queue'
        mockIsDedicatedQueue.mockResolvedValue(false)

        await chatMessagesService.abortChatMessage(CHAT_ID, CHATFLOW_ID, WORKSPACE_ID)

        expect(mockAppServer.queueManager.getPredictionQueueEventsProducer).toHaveBeenCalledTimes(1)
        expect(mockAppServer.queueManager.getWorkspaceQueueEventsProducer).not.toHaveBeenCalled()
        expect(mockPublishEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventName: 'abort', id: `${CHATFLOW_ID}_${CHAT_ID}` })
        )
    })

    // Task 10.7 — shared producer when workspaceId is absent
    it('MODE=queue + workspaceId absent → uses shared getPredictionQueueEventsProducer', async () => {
        process.env.MODE = 'queue'
        // isDedicatedQueue should NOT be called when workspaceId is absent
        mockIsDedicatedQueue.mockResolvedValue(false)

        await chatMessagesService.abortChatMessage(CHAT_ID, CHATFLOW_ID, undefined)

        expect(mockAppServer.queueManager.getPredictionQueueEventsProducer).toHaveBeenCalledTimes(1)
        expect(mockAppServer.queueManager.getWorkspaceQueueEventsProducer).not.toHaveBeenCalled()
        // isDedicatedQueue must NOT be called — no workspaceId to look up
        expect(mockIsDedicatedQueue).not.toHaveBeenCalled()
    })

    // Task 10.7 — in-process abort when MODE != queue
    it('MODE != queue → calls abortControllerPool.abort (in-process)', async () => {
        process.env.MODE = 'main'

        await chatMessagesService.abortChatMessage(CHAT_ID, CHATFLOW_ID, WORKSPACE_ID)

        expect(mockAbortControllerPool.abort).toHaveBeenCalledWith(`${CHATFLOW_ID}_${CHAT_ID}`)
        expect(mockPublishEvent).not.toHaveBeenCalled()
    })

    afterAll(() => {
        delete process.env.MODE
    })
})
