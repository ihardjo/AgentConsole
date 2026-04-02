import { GitSyncService, GitSyncConfig, GitAuthor, getWorkspaceRepoPath } from './GitSyncService'
import { GitFileSerializer } from './GitFileSerializer'
import { getWorkspaceConfigManager, listWorkspaceConfigIds } from './GitSyncConfigManager'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlowVersion } from '../../database/entities/ChatFlowVersion'
import { ChatFlow } from '../../database/entities/ChatFlow'
import fs from 'node:fs'
import path from 'node:path'
import logger from '../../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Shared constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional config-like fields that exist on both ChatFlowVersion and the
 * serialised JSON.  Centralised here so the two sync directions (DB→Git and
 * Git→DB) always handle the same set of fields without diverging over time.
 */
const CONFIG_FIELDS = [
    'chatbotConfig',
    'apiConfig',
    'analytic',
    'category',
    'speechToText',
    'followUpPrompts',
    'textToSpeech'
] as const

type ConfigField = (typeof CONFIG_FIELDS)[number]

// ─────────────────────────────────────────────────────────────────────────────
// Per-workspace singleton maps
// ─────────────────────────────────────────────────────────────────────────────

const serviceMap = new Map<string, GitSyncService>()
const serializerMap = new Map<string, GitFileSerializer>()

/**
 * Returns a safe disabled-by-default config.
 */
function defaultConfig(): GitSyncConfig {
    return {
        enabled: false,
        remoteUrl: '',
        branch: 'main',
        authMethod: 'token',
        accessToken: '',
        sshKeyPath: ''
    }
}

/**
 * Load persisted config for a workspace, or return safe defaults.
 */
async function buildConfig(workspaceId: string): Promise<GitSyncConfig> {
    const persisted = await getWorkspaceConfigManager(workspaceId).load()
    return persisted ?? defaultConfig()
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the serialisable subset of a ChatFlowVersion for writing to git.
 * Centralises the field list so DB→Git and Git→DB always stay in sync.
 */
function toVersionPayload(version: ChatFlowVersion, chatflow: ChatFlow | null): Record<string, unknown> {
    return {
        id: version.id,
        chatFlowId: version.chatFlowId,
        chatFlowName: chatflow?.name || version.chatFlowName,
        chatFlowType: chatflow?.type || version.chatFlowType,
        version: version.version,
        flowData: version.flowData,
        changeDescription: version.changeDescription,
        createdBy: version.createdBy,
        createdDate: version.createdDate,
        updatedDate: version.updatedDate,
        ...Object.fromEntries(CONFIG_FIELDS.map((f) => [f, version[f]]))
    }
}

/**
 * Shared conflict-resolution handler used by both sync directions.
 * Attempts to auto-resolve conflicts, logs the outcome, and swallows
 * resolution errors so the caller can decide how to proceed.
 */
async function tryResolveConflicts(service: GitSyncService, workspaceId: string): Promise<void> {
    try {
        const resolution = await service.resolveConflicts()
        logger.info(`[GitSync:${workspaceId}] Auto-resolved ${resolution.resolved.length} conflict(s)`)
    } catch (resolveErr) {
        logger.warn(`[GitSync:${workspaceId}] Conflict auto-resolution failed: ${resolveErr}`)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — all functions require workspaceId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get (or create) the GitSyncService for a specific workspace.
 */
export async function getGitSyncService(workspaceId: string): Promise<GitSyncService> {
    let service = serviceMap.get(workspaceId)
    if (!service) {
        const config = await buildConfig(workspaceId)
        const repoPath = getWorkspaceRepoPath(workspaceId)
        service = new GitSyncService(config, repoPath)
        serviceMap.set(workspaceId, service)
    }
    return service
}

/**
 * Get the current Git Sync config for a workspace (with token masked).
 */
export async function getGitSyncConfig(workspaceId: string): Promise<ReturnType<GitSyncService['getConfig']>> {
    const service = serviceMap.get(workspaceId)
    if (service) {
        return service.getConfig()
    }
    const defaults = await buildConfig(workspaceId)
    return { ...defaults, accessToken: defaults.accessToken ? '••••••••' : '' }
}

/**
 * Wipe all persistent Git Sync state for a workspace: config file + local git repo.
 */
export async function clearGitSync(workspaceId: string): Promise<void> {
    const service = serviceMap.get(workspaceId)
    if (service) {
        await service.clearConfig()
    }
    getWorkspaceConfigManager(workspaceId).clear()
    serviceMap.delete(workspaceId)
    serializerMap.delete(workspaceId)
    logger.info(`[GitSync:${workspaceId}] All persistent Git Sync data cleared`)
}

/**
 * Apply a partial config update for a workspace, persist, and re-initialise.
 */
export async function resetGitSync(workspaceId: string, partial: Partial<GitSyncConfig>): Promise<void> {
    const service = await getGitSyncService(workspaceId)
    await service.updateConfig(partial)

    const resolvedConfig = service.getFullConfig()
    await getWorkspaceConfigManager(workspaceId).save(resolvedConfig)

    // Invalidate cached serializer — repoPath may have changed
    serializerMap.delete(workspaceId)

    if (service.isEnabled() && service.isInitialized()) {
        try {
            const author: GitAuthor = { name: 'Agent Console Bot', email: 'agentconsole@system' }
            const result = await syncDatabaseToLocalGit(workspaceId, author)
            if (result.versionsWritten > 0) {
                logger.info(`[GitSync:${workspaceId}] Config-change sync wrote ${result.versionsWritten} versions to git`)
            }
        } catch (syncError) {
            logger.warn(`[GitSync:${workspaceId}] Post-config DB-to-git sync failed (non-fatal): ${syncError}`)
        }
    }
}

/**
 * Get (or create) the GitFileSerializer for a specific workspace.
 */
export function getGitFileSerializer(workspaceId: string): GitFileSerializer {
    let serializer = serializerMap.get(workspaceId)
    if (!serializer) {
        serializer = new GitFileSerializer(getWorkspaceRepoPath(workspaceId), workspaceId)
        serializerMap.set(workspaceId, serializer)
    }
    return serializer
}

/**
 * Initialize Git Sync at server startup.
 * Discovers all workspace config files on disk and bootstraps each workspace that has
 * Git Sync enabled.  This replaces the old single-workspace initGitSync() call.
 *
 * Boot strategy per workspace:
 *   1. Init the local repo (fetch + checkout from remote when repo is brand-new).
 *   2. If the local DB already has versions → push them up (DB is the source of truth).
 *   3. If the local DB is empty → pull from remote and import into DB (remote is the
 *      source of truth, e.g. first boot after cloning from another instance).
 */
export async function initGitSync(): Promise<void> {
    const workspaceIds = listWorkspaceConfigIds()

    if (workspaceIds.length === 0) {
        return
    }

    const author: GitAuthor = { name: 'Agent Console Bot', email: 'agentconsole@system' }

    for (const workspaceId of workspaceIds) {
        try {
            const service = await getGitSyncService(workspaceId)
            if (!service.isEnabled()) continue

            await service.init()

            // Count local versions without loading all data
            const appServer = getRunningExpressApp()
            const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)
            const localVersionCount = await versionRepo.count({ where: { workspaceId } })

            if (localVersionCount === 0) {
                // ── Empty DB: pull from remote and import ─────────────────
                // The local repo was already bootstrapped (fetched) during init(),
                // so syncRemoteGitToDatabase only needs to parse files + upsert rows.
                logger.info(`[GitSync:${workspaceId}] Local DB is empty — pulling from remote`)
                try {
                    const pullResult = await syncRemoteGitToDatabase(workspaceId)
                    logger.info(
                        `[GitSync:${workspaceId}] Remote pull imported ${pullResult.versionsImported} version(s), ` +
                        `created ${pullResult.flowsCreated} flow(s)`
                    )
                } catch (pullError) {
                    logger.warn(`[GitSync:${workspaceId}] Remote pull on empty DB failed (non-fatal): ${pullError}`)
                }
            } else {
                // ── DB has data: commit and push local state ───────────────
                const result = await syncDatabaseToLocalGit(workspaceId, author)
                if (result.versionsWritten > 0) {
                    logger.info(`[GitSync:${workspaceId}] Initial sync wrote ${result.versionsWritten} versions to git`)
                }
            }

            logger.info(`[GitSync:${workspaceId}] Git sync initialized successfully`)
        } catch (initError) {
            logger.warn(`[GitSync:${workspaceId}] Initialization failed (non-fatal): ${initError}`)
        }
    }
}

/**
 * Helper to extract GitAuthor from the Express `req.user` object.
 */
export function getAuthorFromUser(user?: { name?: string; email?: string; id?: string }): GitAuthor {
    return {
        name: user?.name || user?.email || user?.id || 'Agent Console',
        email: user?.email || 'system@agentconsole.local'
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Operations — workspace-scoped
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize all chatflow versions belonging to `workspaceId` from the database
 * to the workspace git repo, then commit.
 *
 * **Does NOT push.**
 */
export async function syncDatabaseToLocalGit(
    workspaceId: string,
    author: GitAuthor
): Promise<{ versionsWritten: number; committed: boolean }> {
    const service = await getGitSyncService(workspaceId)
    if (!service.isEnabled() || !service.isInitialized()) {
        throw new Error(`Git sync is not enabled or not initialized for workspace ${workspaceId}`)
    }

    const serializer = getGitFileSerializer(workspaceId)
    const appServer = getRunningExpressApp()
    const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

    // Fetch all versions owned by this workspace — uses the denormalized
    // workspaceId column directly so orphaned versions (deleted chatflows)
    // are also included and preserved in git.
    const versions = await versionRepo
        .createQueryBuilder('version')
        .leftJoinAndSelect('version.chatFlow', 'chatFlow')
        .where('version.workspaceId = :workspaceId', { workspaceId })
        .orderBy('version.chatFlowId', 'ASC')
        .addOrderBy('version.version', 'ASC')
        .getMany()

    if (versions.length === 0) {
        logger.debug(`[GitSync:${workspaceId}] No local versions to sync to git`)
        return { versionsWritten: 0, committed: false }
    }

    const chatflowIds = [...new Set(versions.map((v) => v.chatFlowId))]

    // Build chatflow lookup from the LEFT-JOINed version.chatFlow relation.
    // For orphaned versions (deleted chatflows) chatFlow will be null —
    // the serializer falls back to the embedded chatFlowType / chatFlowName.
    const chatflowMap = new Map<string, ChatFlow>()
    for (const v of versions) {
        if (v.chatFlow && !chatflowMap.has(v.chatFlowId)) {
            chatflowMap.set(v.chatFlowId, v.chatFlow)
        }
    }

    let versionsWritten = 0

    for (const chatflowId of chatflowIds) {
        const chatflow = chatflowMap.get(chatflowId) ?? null
        const entityType = chatflow?.type === 'AGENTFLOW' ? 'agentflows' : 'chatflows'

        for (const version of versions.filter((v) => v.chatFlowId === chatflowId)) {
            serializer.safeWriteVersion(entityType, chatflowId, version.version, toVersionPayload(version, chatflow))
            versionsWritten++
        }
    }

    const isInitial = !(await service.hasLocalCommits())
    if (!isInitial) {
        const treeStatus = await service.getStatus()
        if (treeStatus?.isClean()) {
            logger.debug(`[GitSync:${workspaceId}] Working tree is clean — no changes to commit, skipping`)
            return { versionsWritten, committed: false }
        }
    }

    const flowCount = chatflowIds.length
    const syncLabel = isInitial ? 'INIT' : 'SYNC'
    const syncMessage =
        `[AgentOps] ${syncLabel}: ${flowCount} flow${flowCount !== 1 ? 's' : ''}, ` +
        `${versionsWritten} version${versionsWritten !== 1 ? 's' : ''}\n\n` +
        `Workspace: ${workspaceId}\n` +
        `Flows: ${flowCount}\n` +
        `Versions: ${versionsWritten}\n` +
        `Author: ${author.name} <${author.email}>\n` +
        `Timestamp: ${new Date().toISOString()}`

    let committed = false
    try {
        const commitResult = isInitial
            ? await service.commitThenMergeRemote(syncMessage, author)
            : await service.pullAndCommit(syncMessage, author)
        committed = !!commitResult
    } catch (error) {
        const errMsg = (error as Error).message || String(error)
        if (errMsg.startsWith('CONFLICTS:')) {
            logger.warn(`[GitSync:${workspaceId}] Merge conflicts detected during pullAndCommit — auto-resolving`)
            await tryResolveConflicts(service, workspaceId)
            try {
                const retryMessage = syncMessage.replace('SYNC:', 'SYNC (post-conflict resolution):')
                const retryResult = await service.pullAndCommit(retryMessage, author)
                committed = !!retryResult
            } catch (retryErr) {
                logger.warn(`[GitSync:${workspaceId}] Retry after conflict resolution failed: ${retryErr}`)
            }
        } else {
            logger.error(`[GitSync:${workspaceId}] pullAndCommit failed: ${error}`)
        }
    }

    return { versionsWritten, committed }
}

/**
 * Pull all versions from the git remote for `workspaceId`, parse every JSON
 * version file found in the repo (across ALL workspace subdirectories), and
 * upsert them into the local database — all flows are re-homed to `workspaceId`.
 *
 * This allows a repo that was originally pushed from a different workspace ID
 * (e.g. migrating environments) to be fully imported into the current workspace.
 *
 * Flows found in git that don't exist in the DB are created and assigned to `workspaceId`.
 * Flows found in git that already exist under a DIFFERENT workspaceId are re-assigned
 * to `workspaceId` on import so they become visible in the current workspace.
 */
export async function syncRemoteGitToDatabase(
    workspaceId: string
): Promise<{ versionsImported: number; flowsCreated: number; pulled: boolean }> {
    const service = await getGitSyncService(workspaceId)
    if (!service.isEnabled() || !service.isInitialized()) {
        throw new Error(`Git sync is not enabled or not initialized for workspace ${workspaceId}`)
    }

    // Use the serializer to derive the shared repo's `workspaces/` root.
    // We scan ALL subdirs under it, not just this workspace's own subtree.
    const serializer = getGitFileSerializer(workspaceId)

    let pulled = false
    try {
        await service.pull()
        pulled = true
    } catch (error) {
        const errMsg = (error as Error).message || String(error)
        if (errMsg.startsWith('CONFLICTS:')) {
            logger.warn(`[GitSync:${workspaceId}] Merge conflicts detected after pull — attempting auto-resolution`)
            await tryResolveConflicts(service, workspaceId)
            pulled = true
        } else {
            logger.warn(`[GitSync:${workspaceId}] Pull during syncRemoteGitToDatabase failed: ${error}`)
        }
    }

    const appServer = getRunningExpressApp()
    const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)
    const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

    let versionsImported = 0
    let flowsCreated = 0

    const entityTypes = ['chatflows', 'agentflows'] as const

    // ── Collect every chatflow directory across ALL workspace subdirs ──────────
    // The remote repo may have been pushed from a workspace with a different ID.
    // We scan the entire `workspaces/` root so that every version file is imported
    // and re-homed to the current `workspaceId`.
    const repoWorkspacesRoot = path.dirname(serializer.workspaceDir) // <repoPath>/workspaces/

    // Gather all workspace subdirectory names (may include our own and foreign ones)
    const workspaceSubdirs: string[] = fs.existsSync(repoWorkspacesRoot)
        ? fs.readdirSync(repoWorkspacesRoot, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => d.name)
        : []

    // Build a flat list of { workspaceSrcId, entityType, chatflowId, dir } tuples
    const allChatflowIds: string[] = []
    type ChatflowEntry = { workspaceSrcId: string; entityType: typeof entityTypes[number]; chatflowId: string; dir: string }
    const chatflowEntries: ChatflowEntry[] = []

    for (const wsSrcId of workspaceSubdirs) {
        for (const entityType of entityTypes) {
            const entityDir = path.join(repoWorkspacesRoot, wsSrcId, entityType)
            if (!fs.existsSync(entityDir)) continue
            fs.readdirSync(entityDir, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .forEach((d) => {
                    allChatflowIds.push(d.name)
                    chatflowEntries.push({
                        workspaceSrcId: wsSrcId,
                        entityType,
                        chatflowId: d.name,
                        dir: path.join(entityDir, d.name)
                    })
                })
        }
    }

    if (allChatflowIds.length === 0) {
        logger.debug(`[GitSync:${workspaceId}] No chatflow directories found in repo`)
        return { versionsImported, flowsCreated, pulled }
    }

    // Batch-fetch all referenced chatflows so we can detect create-vs-update
    const existingFlows = await flowRepo.find({ where: allChatflowIds.map((id) => ({ id })) })
    const flowMap = new Map(existingFlows.map((cf) => [cf.id, cf]))

    const existingVersions = await versionRepo.find({
        where: allChatflowIds.map((id) => ({ chatFlowId: id })),
        select: [
            'id', 'chatFlowId', 'version', 'flowData', 'changeDescription', 'createdBy',
            'chatFlowName', 'chatFlowType',
            ...CONFIG_FIELDS
        ]
    })
    const versionMap = new Map(existingVersions.map((v) => [`${v.chatFlowId}:${v.version}`, v]))

    // Accumulate all version entities to upsert — flushed in a single bulk save at the end
    const versionsToSave: ChatFlowVersion[] = []

    for (const { workspaceSrcId, entityType, chatflowId, dir: chatflowDir } of chatflowEntries) {
        let chatflow = flowMap.get(chatflowId) ?? null

        // ── Re-home cross-workspace flows ────────────────────────────────────
        // If this flow was pushed from a different workspace (workspaceSrcId ≠ workspaceId),
        // we still import it — all flows are re-assigned to the local workspaceId.
        // This makes the pull workspace-ID-agnostic, so repos migrated from other
        // environments import fully instead of being silently skipped.
        if (chatflow && chatflow.workspaceId !== workspaceId) {
            logger.info(
                `[GitSync:${workspaceId}] Re-homing chatflow ${chatflowId} from ` +
                `workspace ${chatflow.workspaceId} → ${workspaceId} (source dir: ${workspaceSrcId})`
            )
            chatflow.workspaceId = workspaceId
            chatflow = await flowRepo.save(chatflow)
            flowMap.set(chatflowId, chatflow)
        }

        const versionFiles = fs.readdirSync(chatflowDir)
            .filter((f) => f.startsWith('version_') && f.endsWith('.json'))
            .sort()

        if (!chatflow) {
            // ── Create the ChatFlow from the latest version_N.json ──────────
            if (versionFiles.length === 0) {
                logger.warn(`[GitSync:${workspaceId}] Skipping ${chatflowId} — no version files and not in DB`)
                continue
            }

            try {
                const latestVersion = JSON.parse(
                    fs.readFileSync(path.join(chatflowDir, versionFiles[versionFiles.length - 1]), 'utf-8')
                )

                const chatflowType = entityType === 'agentflows'
                    ? 'AGENTFLOW'
                    : (latestVersion.chatFlowType || 'CHATFLOW')

                const newChatflow = flowRepo.create({
                    id: chatflowId,
                    name: latestVersion.chatFlowName || `Imported ${chatflowId.substring(0, 8)}`,
                    flowData: latestVersion.flowData || '{}',
                    type: chatflowType,
                    deployed: false,
                    isPublic: false,
                    workspaceId,
                    ...Object.fromEntries(CONFIG_FIELDS.map((f) => [f, latestVersion[f] ?? null]))
                })

                chatflow = await flowRepo.save(newChatflow)
                flowMap.set(chatflowId, chatflow)
                flowsCreated++
                logger.info(
                    `[GitSync:${workspaceId}] Created chatflow ${chatflowId} (${newChatflow.name}) ` +
                    `from source workspace dir ${workspaceSrcId}`
                )
            } catch (error) {
                logger.error(`[GitSync:${workspaceId}] Failed to create chatflow ${chatflowId}: ${error}`)
                continue
            }
        } else {
            // ── Update existing chatflow from the latest version file ────────
            if (versionFiles.length > 0) {
                try {
                    const latestVersion = JSON.parse(
                        fs.readFileSync(path.join(chatflowDir, versionFiles[versionFiles.length - 1]), 'utf-8')
                    )

                    let updated = false

                    if (latestVersion.chatFlowName && latestVersion.chatFlowName !== chatflow.name) {
                        chatflow.name = latestVersion.chatFlowName
                        updated = true
                    }
                    if (latestVersion.flowData && latestVersion.flowData !== '{}' && latestVersion.flowData !== chatflow.flowData) {
                        chatflow.flowData = latestVersion.flowData
                        updated = true
                    }

                    for (const field of CONFIG_FIELDS) {
                        if (latestVersion[field] !== undefined && latestVersion[field] !== (chatflow as any)[field]) {
                            ;(chatflow as any)[field] = latestVersion[field]
                            updated = true
                        }
                    }

                    if (updated) {
                        await flowRepo.save(chatflow)
                        logger.debug(`[GitSync:${workspaceId}] Updated chatflow ${chatflowId} from latest version file`)
                    }
                } catch (error) {
                    logger.warn(`[GitSync:${workspaceId}] Failed to update chatflow ${chatflowId}: ${error}`)
                }
            }
        }

        // ── Collect version files for bulk upsert ───────────────────────────
        for (const file of versionFiles) {
            const filePath = path.join(chatflowDir, file)
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
                const versionNumber = parseInt(file.replace('version_', '').replace('.json', ''), 10)
                if (isNaN(versionNumber)) continue

                const existing = versionMap.get(`${chatflowId}:${versionNumber}`) ?? null

                if (existing) {
                    // Always re-home the version to the local workspaceId
                    let changed = existing.workspaceId !== workspaceId
                    if (changed) existing.workspaceId = workspaceId

                    if (data.flowData && data.flowData !== existing.flowData) {
                        existing.flowData = data.flowData
                        existing.changeDescription = data.changeDescription || existing.changeDescription
                        existing.createdBy = data.createdBy || existing.createdBy
                        existing.chatFlowName = data.chatFlowName || chatflow?.name || existing.chatFlowName
                        existing.chatFlowType = data.chatFlowType || chatflow?.type || existing.chatFlowType
                        for (const f of CONFIG_FIELDS) {
                            existing[f] = data[f] ?? existing[f]
                        }
                        changed = true
                    }

                    if (changed) {
                        versionsToSave.push(existing)
                        versionsImported++
                        logger.debug(`[GitSync:${workspaceId}] Queued update for version ${versionNumber} of ${chatflowId}`)
                    }
                } else {
                    const newVersion = versionRepo.create({
                        chatFlowId: chatflowId,
                        version: versionNumber,
                        flowData: data.flowData || '{}',
                        changeDescription: data.changeDescription || 'Imported from git',
                        createdBy: data.createdBy || 'git-sync',
                        chatFlowName: data.chatFlowName || chatflow?.name,
                        chatFlowType: data.chatFlowType || chatflow?.type,
                        workspaceId,
                        ...Object.fromEntries(CONFIG_FIELDS.map((f) => [f, data[f] ?? null]))
                    })
                    versionsToSave.push(newVersion)
                    versionsImported++
                    logger.debug(`[GitSync:${workspaceId}] Queued import for version ${versionNumber} of ${chatflowId}`)
                }
            } catch (error) {
                logger.error(`[GitSync:${workspaceId}] Failed to import ${filePath}: ${error}`)
            }
        }
    }

    // Flush all version upserts in a single batch write instead of N individual saves
    if (versionsToSave.length > 0) {
        await versionRepo.save(versionsToSave)
    }

    logger.info(`[GitSync:${workspaceId}] Imported ${versionsImported} versions, created ${flowsCreated} new flows`)
    return { versionsImported, flowsCreated, pulled }
}

// Re-export types
export { GitSyncService, GitSyncConfig, GitAuthor, getWorkspaceRepoPath } from './GitSyncService'
export { GitFileSerializer } from './GitFileSerializer'


