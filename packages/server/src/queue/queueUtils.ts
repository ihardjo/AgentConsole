/**
 * queueUtils — workspace-queue routing helpers
 *
 * Single source of truth for deciding whether a given workspace should route
 * jobs to its dedicated per-workspace queue or to the shared global queue.
 *
 * Design rules:
 *  - When `Workspace.dedicatedQueue === true` the job goes to the workspace-scoped
 *    BullMQ queue created by `QueueManager.getOrCreateWorkspaceQueue`.
 *  - Otherwise jobs go to the shared `getQueue('prediction')` / `getQueue('upsert')`.
 *  - `isDedicatedQueue` caches the DB look-up for TTL_MS (30 s) to avoid hot-path
 *    overhead; call `invalidateDedicatedQueueCache` on workspace update.
 */

import { DataSource } from 'typeorm'
import { Workspace } from '../custom-rbac/entities/workspace.entity'
import { QueueManager, QUEUE_TYPE } from './QueueManager'
import { BaseQueue } from './BaseQueue'

export type { QUEUE_TYPE }

const TTL_MS = 30_000

interface CacheEntry {
    value: boolean
    expiresAt: number
}

const dedicatedQueueCache = new Map<string, CacheEntry>()

/**
 * Returns whether the workspace currently has `dedicatedQueue=true`, with a
 * 30-second in-process cache to avoid per-request DB round-trips.
 *
 * @param workspaceId  UUID of the workspace
 * @param dataSource   TypeORM DataSource for the DB look-up
 */
export async function isDedicatedQueue(workspaceId: string, dataSource: DataSource): Promise<boolean> {
    const cached = dedicatedQueueCache.get(workspaceId)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    const workspace = await dataSource.getRepository(Workspace).findOneBy({ id: workspaceId })
    const value = workspace?.dedicatedQueue ?? false
    dedicatedQueueCache.set(workspaceId, { value, expiresAt: Date.now() + TTL_MS })
    return value
}

/**
 * Explicitly evicts the cached `dedicatedQueue` flag for a workspace.
 * Call this after `updateWorkspace` so the next routing decision reads
 * the freshly persisted value.
 *
 * @param workspaceId  UUID of the workspace whose cache entry should be removed
 */
export function invalidateDedicatedQueueCache(workspaceId: string): void {
    dedicatedQueueCache.delete(workspaceId)
}

/**
 * Returns the appropriate BullMQ queue for the given job type and workspace.
 *
 * Accepts either:
 *  - A full `Workspace` entity (zero DB calls — use when the entity is already in scope)
 *  - A bare `workspaceId` string (one DB call, cached for TTL_MS)
 *
 * @param type           `'prediction'` or `'upsert'`
 * @param workspaceOrId  The `Workspace` entity or its UUID string
 * @param queueManager   The singleton `QueueManager` instance
 * @param dataSource     Required only when `workspaceOrId` is a string
 */
export async function getWorkspaceQueue(
    type: QUEUE_TYPE,
    workspaceOrId: Workspace | string,
    queueManager: QueueManager,
    dataSource?: DataSource
): Promise<BaseQueue> {
    let dedicatedQueue: boolean
    let workspaceId: string

    if (typeof workspaceOrId === 'string') {
        workspaceId = workspaceOrId
        if (!dataSource) {
            throw new Error(`getWorkspaceQueue: dataSource is required when workspaceOrId is a string (workspaceId=${workspaceId})`)
        }
        dedicatedQueue = await isDedicatedQueue(workspaceId, dataSource)
    } else {
        workspaceId = workspaceOrId.id
        dedicatedQueue = workspaceOrId.dedicatedQueue
    }

    if (dedicatedQueue) {
        return queueManager.getOrCreateWorkspaceQueue(type, workspaceId)
    }
    return queueManager.getQueue(type)
}
