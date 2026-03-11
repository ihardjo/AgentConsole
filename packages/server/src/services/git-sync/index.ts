import { GitSyncService, GitSyncConfig, GitAuthor, gitSyncRepoPath } from './GitSyncService'
import { GitFileSerializer } from './GitFileSerializer'
import configManager from './GitSyncConfigManager'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlowVersion } from '../../database/entities/ChatFlowVersion'
import { ChatFlow } from '../../database/entities/ChatFlow'
import fs from 'node:fs'
import path from 'node:path'
import logger from '../../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instances
// ─────────────────────────────────────────────────────────────────────────────

let serviceInstance: GitSyncService | null = null
let serializerInstance: GitFileSerializer | null = null

/**
 * Returns a safe disabled-by-default config.
 * Used when no persisted config exists yet (first run).
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
 * Load config exclusively from the persisted config file.
 * Returns safe disabled defaults when no config file exists yet.
 */
async function buildConfig(): Promise<GitSyncConfig> {
    const persisted = await configManager.load()
    if (persisted) {
        return persisted
    }
    return defaultConfig()
}

/**
 * Get (or create) the singleton GitSyncService.
 * If the service has not been created yet, loads persisted config asynchronously.
 */
export async function getGitSyncService(): Promise<GitSyncService> {
    if (!serviceInstance) {
        const config = await buildConfig()
        serviceInstance = new GitSyncService(config)
    }
    return serviceInstance
}

/**
 * Get the current Git Sync config (with token masked).
 * Returns a default config object when the service has not yet been created.
 */
export async function getGitSyncConfig(): Promise<ReturnType<GitSyncService['getConfig']>> {
    if (serviceInstance) {
        return serviceInstance.getConfig()
    }
    const defaults = await buildConfig()
    return { ...defaults, accessToken: defaults.accessToken ? '••••••••' : '' }
}

/**
 * Wipe all persistent Git Sync state: config file on disk AND the local git repo.
 * Called when the user explicitly disables Git Sync.
 */
export async function clearGitSync(): Promise<void> {
    if (serviceInstance) {
        await serviceInstance.clearConfig()
    }
    // Remove the persisted config file so the next startup starts fresh
    await configManager.clear()
    // Reset singletons so next request starts from defaults
    serviceInstance = null
    serializerInstance = null
    logger.info('[GitSync] All persistent Git Sync data cleared')
}

/**
 * Replace the singleton with a new service after a runtime config change.
 * Persists the new configuration to disk with encrypted credentials.
 */
export async function resetGitSync(partial: Partial<GitSyncConfig>): Promise<void> {
    // Ensure the singleton exists before updating
    const service = await getGitSyncService()
    await service.updateConfig(partial)

    // Persist the full resolved config to disk (encrypted)
    const resolvedConfig = service.getFullConfig()
    await configManager.save(resolvedConfig)

    // Re-create serializer for potentially new repoPath
    serializerInstance = null
    getGitFileSerializer()

    // When git sync is (re-)enabled and initialized, sync all DB versions
    // into the local repo so the first commit contains the full state.
    // This does NOT push — the user must push manually.
    if (service.isEnabled() && service.isInitialized()) {
        try {
            const author: GitAuthor = { name: 'Agent Console Bot', email: 'agentconsole@system' }
            const result = await syncDatabaseToLocalGit(author)
            if (result.versionsWritten > 0) {
                logger.info(`[GitSync] Config-change sync wrote ${result.versionsWritten} versions to git`)
            }
        } catch (syncError) {
            logger.warn(`[GitSync] Post-config DB-to-git sync failed (non-fatal): ${syncError}`)
        }
    }
}

/**
 * Get (or create) the singleton GitFileSerializer.
 */
export function getGitFileSerializer(): GitFileSerializer {
    if (!serializerInstance) {
        serializerInstance = new GitFileSerializer(gitSyncRepoPath)
    }
    return serializerInstance
}

/**
 * Initialize Git Sync at server startup.
 * Should be called from the main App initialization flow.
 */
export async function initGitSync(): Promise<void> {
    const config = await buildConfig()

    if (!config.enabled) {
        // No persisted enabled config — Git Sync will be configured at runtime via the UI
        return
    }

    const service = await getGitSyncService()
    await service.init()

    // Also pre-create the serializer
    getGitFileSerializer()

    // Sync all existing DB versions into the local git repo so the
    // initial commit contains the full database state.  This is a
    // no-op if the repo already has the versions serialized.
    try {
        const author: GitAuthor = { name: 'Agent Console Bot', email: 'agentconsole@system' }
        const result = await syncDatabaseToLocalGit(author)
        if (result.versionsWritten > 0) {
            logger.info(`[GitSync] Initial sync wrote ${result.versionsWritten} versions to git`)
        }
    } catch (initSyncError) {
        logger.warn(`[GitSync] Initial DB-to-git sync failed (non-fatal): ${initSyncError}`)
    }

    logger.info('[GitSync] Git sync initialized successfully')
}

/**
 * Helper to extract GitAuthor from the Express `req.user` object.
 * Falls back to a system author if user info is unavailable.
 */
export function getAuthorFromUser(user?: { name?: string; email?: string; id?: string }): GitAuthor {
    return {
        name: user?.name || user?.email || user?.id || 'Agent Console',
        email: user?.email || 'system@agentconsole.local'
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial Sync Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize all local chatflow versions from the database to the git
 * repository working tree, then commit (and merge remote for the very
 * first commit on an unborn branch).
 *
 * **Does NOT push.**  The caller is responsible for pushing when
 * appropriate (e.g. the explicit Push button / endpoint).
 */
export async function syncDatabaseToLocalGit(author: GitAuthor): Promise<{ versionsWritten: number; committed: boolean }> {
    const service = await getGitSyncService()
    if (!service.isEnabled() || !service.isInitialized()) {
        throw new Error('Git sync is not enabled or not initialized')
    }

    const serializer = getGitFileSerializer()
    const appServer = getRunningExpressApp()
    const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)
    const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

    // Get all versions from the database
    const versions = await versionRepo
        .createQueryBuilder('version')
        .leftJoinAndSelect('version.chatFlow', 'chatFlow')
        .orderBy('version.chatFlowId', 'ASC')
        .addOrderBy('version.version', 'ASC')
        .getMany()

    if (versions.length === 0) {
        logger.debug('[GitSync] No local versions to sync to git')
        return { versionsWritten: 0, committed: false }
    }

    let versionsWritten = 0

    // Group by chatflow and write each version
    const chatflowIds = [...new Set(versions.map((v) => v.chatFlowId))]

    // Batch-fetch all referenced chatflows in one query (avoids N+1)
    const chatflows = await flowRepo.find({ where: chatflowIds.map((id) => ({ id })) })
    const chatflowMap = new Map(chatflows.map((cf) => [cf.id, cf]))

    for (const chatflowId of chatflowIds) {
        const chatflow = chatflowMap.get(chatflowId) ?? null
        const entityType = chatflow?.type === 'AGENTFLOW' ? 'agentflows' : 'chatflows'

        // Write each version
        const chatflowVersions = versions.filter((v) => v.chatFlowId === chatflowId)
        for (const version of chatflowVersions) {
            serializer.safeWriteVersion(entityType, chatflowId, version.version, {
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
                chatbotConfig: version.chatbotConfig,
                apiConfig: version.apiConfig,
                analytic: version.analytic,
                category: version.category,
                speechToText: version.speechToText,
                followUpPrompts: version.followUpPrompts,
                textToSpeech: version.textToSpeech
            })
            versionsWritten++
        }
    }

    // ── Dirty check ────────────────────────────────────────────────────────
    // After writing files, inspect the working tree.  If nothing changed on
    // disk (all files were identical to what was already committed) there is
    // nothing to commit.  This prevents noisy empty "SYNC" commits on every
    // server restart when the repo is already up to date.
    const isInitial = !(await service.hasLocalCommits())
    if (!isInitial) {
        const treeStatus = await service.getStatus()
        if (treeStatus?.isClean()) {
            logger.debug('[GitSync] Working tree is clean — no changes to commit, skipping')
            return { versionsWritten, committed: false }
        }
    }

    // Build a descriptive commit message with counts
    const flowCount = chatflowIds.length
    const syncLabel = isInitial ? 'INIT' : 'SYNC'
    const syncMessage =
        `[AgentOps] ${syncLabel}: ${flowCount} flow${flowCount !== 1 ? 's' : ''}, ` +
        `${versionsWritten} version${versionsWritten !== 1 ? 's' : ''}\n\n` +
        `Flows: ${flowCount}\n` +
        `Versions: ${versionsWritten}\n` +
        `Author: ${author.name} <${author.email}>\n` +
        `Timestamp: ${new Date().toISOString()}`

    // For the very first commit (unborn branch) we must commit locally
    // before pulling, because `git pull` fails on an unborn branch.
    // For subsequent syncs we pull first, then commit (pullAndCommit).
    let committed = false
    try {
        const commitResult = isInitial
            ? await service.commitThenMergeRemote(syncMessage, author)
            : await service.pullAndCommit(syncMessage, author)
        committed = !!commitResult
    } catch (error) {
        const errMsg = (error as Error).message || String(error)
        if (errMsg.startsWith('CONFLICTS:')) {
            logger.warn(`[GitSync] Merge conflicts detected during pullAndCommit — auto-resolving`)
            try {
                const resolution = await service.resolveConflicts()
                logger.info(`[GitSync] Auto-resolved ${resolution.resolved.length} conflict(s) before commit`)
                // Re-attempt with a post-resolution message
                const retryMessage = syncMessage.replace('SYNC:', 'SYNC (post-conflict resolution):')
                const retryResult = await service.pullAndCommit(retryMessage, author)
                committed = !!retryResult
            } catch (resolveErr) {
                logger.warn(`[GitSync] Pre-commit conflict resolution failed: ${resolveErr}`)
            }
        } else {
            logger.error(`[GitSync] pullAndCommit failed: ${error}`)
        }
    }

    return { versionsWritten, committed }
}

/**
 * Pull all versions from the git remote, parse the JSON files,
 * and upsert them into the local database (chat_flow_version table).
 *
 * If a chatflow/agentflow exists in the git repo but not in the local DB,
 * it will be created from the latest version_N.json file so that the pulled
 * versions are visible immediately without a manual re-creation step.
 *
 * @param workspaceId  The workspace to assign newly-created chatflows to.
 *                     Required for flows that don't yet exist in the local DB.
 */
export async function syncRemoteGitToDatabase(workspaceId?: string): Promise<{ versionsImported: number; flowsCreated: number; pulled: boolean }> {
    const service = await getGitSyncService()
    if (!service.isEnabled() || !service.isInitialized()) {
        throw new Error('Git sync is not enabled or not initialized')
    }

    // Pull from remote first
    let pulled = false
    try {
        await service.pull()
        pulled = true
    } catch (error) {
        const errMsg = (error as Error).message || String(error)
        if (errMsg.startsWith('CONFLICTS:')) {
            // Auto-resolve merge conflicts before importing
            logger.warn(`[GitSync] Merge conflicts detected after pull — attempting auto-resolution`)
            try {
                const resolution = await service.resolveConflicts()
                logger.info(`[GitSync] Auto-resolved ${resolution.resolved.length} conflict(s)`)
                pulled = true
            } catch (resolveErr) {
                logger.error(`[GitSync] Auto-resolution failed: ${resolveErr}`)
                // Still continue — import whatever is in the working tree
            }
        } else {
            logger.warn(`[GitSync] Pull during syncRemoteGitToDatabase failed: ${error}`)
            // Continue — there may be local files to import even if pull fails
        }
    }

    const appServer = getRunningExpressApp()
    const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)
    const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

    let versionsImported = 0
    let flowsCreated = 0

    // Scan the repo directory for entity type folders
    const entityTypes = ['chatflows', 'agentflows']

    // Collect all chatflow IDs across entity types first for batch query
    const allChatflowIds: string[] = []
    for (const entityType of entityTypes) {
        const entityDir = path.join(gitSyncRepoPath, entityType)
        if (!fs.existsSync(entityDir)) continue
        const dirs = fs.readdirSync(entityDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
        allChatflowIds.push(...dirs)
    }

    // Batch-fetch all referenced chatflows + versions in one query each (avoids N+1)
    const existingFlows = allChatflowIds.length > 0
        ? await flowRepo.find({ where: allChatflowIds.map((id) => ({ id })) })
        : []
    const flowMap = new Map(existingFlows.map((cf) => [cf.id, cf]))

    const existingVersions = allChatflowIds.length > 0
        ? await versionRepo.find({
            where: allChatflowIds.map((id) => ({ chatFlowId: id })),
            select: [
                'id', 'chatFlowId', 'version', 'flowData', 'changeDescription', 'createdBy',
                'chatFlowName', 'chatFlowType',
                'chatbotConfig', 'apiConfig', 'analytic', 'category',
                'speechToText', 'followUpPrompts', 'textToSpeech'
            ]
        })
        : []
    // Key: "chatflowId:versionNumber"
    const versionMap = new Map(existingVersions.map((v) => [`${v.chatFlowId}:${v.version}`, v]))

    for (const entityType of entityTypes) {
        const entityDir = path.join(gitSyncRepoPath, entityType)
        if (!fs.existsSync(entityDir)) continue

        const chatflowDirs = fs.readdirSync(entityDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)

        for (const chatflowId of chatflowDirs) {
            const chatflowDir = path.join(entityDir, chatflowId)

            // Check if this chatflow exists in the DB (from pre-fetched map)
            let chatflow = flowMap.get(chatflowId) ?? null

            // Read version files once — reused for create, update, and upsert passes below
            const versionFiles = fs.readdirSync(chatflowDir)
                .filter((f) => f.startsWith('version_') && f.endsWith('.json'))
                .sort()

            if (!chatflow) {
                // ── Recreate the ChatFlow from the latest version_N.json ──
                // version_N.json is the canonical source of truth: it contains
                // chatFlowId, chatFlowName, chatFlowType, flowData and all 7
                // config fields captured at save time — exactly like restoreVersion.
                if (versionFiles.length === 0) {
                    logger.warn(`[GitSync] Skipping import for chatflow ${chatflowId} — not found in local DB and no version files`)
                    continue
                }

                try {
                    const latestVersion = JSON.parse(
                        fs.readFileSync(path.join(chatflowDir, versionFiles[versionFiles.length - 1]), 'utf-8')
                    )

                    // workspaceId must be supplied by the caller (from the authenticated request)
                    if (!workspaceId) {
                        logger.warn(`[GitSync] Skipping import for chatflow ${chatflowId} — no workspaceId available`)
                        continue
                    }

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
                        chatbotConfig: latestVersion.chatbotConfig || null,
                        apiConfig: latestVersion.apiConfig || null,
                        analytic: latestVersion.analytic || null,
                        category: latestVersion.category || null,
                        speechToText: latestVersion.speechToText || null,
                        followUpPrompts: latestVersion.followUpPrompts || null,
                        textToSpeech: latestVersion.textToSpeech || null,
                        workspaceId: workspaceId
                    })

                    chatflow = await flowRepo.save(newChatflow)
                    flowMap.set(chatflowId, chatflow)
                    flowsCreated++
                    logger.info(`[GitSync] Created chatflow ${chatflowId} (${newChatflow.name}) from latest version file`)
                } catch (error) {
                    logger.error(`[GitSync] Failed to create chatflow ${chatflowId} from version files: ${error}`)
                    continue
                }
            } else {
                // ── Chatflow exists — update it from the latest version file ──
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

                        // Sync all 7 config fields
                        const configFields = ['chatbotConfig', 'apiConfig', 'analytic', 'category', 'speechToText', 'followUpPrompts', 'textToSpeech'] as const
                        for (const field of configFields) {
                            if (latestVersion[field] !== undefined && latestVersion[field] !== (chatflow as any)[field]) {
                                ;(chatflow as any)[field] = latestVersion[field]
                                updated = true
                            }
                        }

                        if (updated) {
                            await flowRepo.save(chatflow)
                            logger.info(`[GitSync] Updated chatflow ${chatflowId} from latest version file`)
                        }
                    } catch (error) {
                        logger.warn(`[GitSync] Failed to update chatflow ${chatflowId} from version files: ${error}`)
                    }
                }
            }

            // Upsert all version_*.json files into the DB
            const files = versionFiles

            for (const file of files) {
                const filePath = path.join(chatflowDir, file)
                try {
                    const content = fs.readFileSync(filePath, 'utf-8')
                    const data = JSON.parse(content)

                    const versionNumber = parseInt(file.replace('version_', '').replace('.json', ''), 10)
                    if (isNaN(versionNumber)) continue

                    // Check if this version already exists (from pre-fetched map)
                    const existing = versionMap.get(`${chatflowId}:${versionNumber}`) ?? null

                    if (existing) {
                        // Update if the git version has newer data
                        if (data.flowData && data.flowData !== existing.flowData) {
                            existing.flowData = data.flowData
                            existing.changeDescription = data.changeDescription || existing.changeDescription
                            existing.createdBy = data.createdBy || existing.createdBy
                            existing.chatFlowName = data.chatFlowName || chatflow?.name || existing.chatFlowName
                            existing.chatFlowType = data.chatFlowType || chatflow?.type || existing.chatFlowType
                            existing.chatbotConfig = data.chatbotConfig ?? existing.chatbotConfig
                            existing.apiConfig = data.apiConfig ?? existing.apiConfig
                            existing.analytic = data.analytic ?? existing.analytic
                            existing.category = data.category ?? existing.category
                            existing.speechToText = data.speechToText ?? existing.speechToText
                            existing.followUpPrompts = data.followUpPrompts ?? existing.followUpPrompts
                            existing.textToSpeech = data.textToSpeech ?? existing.textToSpeech
                            await versionRepo.save(existing)
                            versionsImported++
                            logger.info(`[GitSync] Updated version ${versionNumber} for ${chatflowId} from git`)
                        }
                    } else {
                        // Create new version entry
                        const newVersion = versionRepo.create({
                            chatFlowId: chatflowId,
                            version: versionNumber,
                            flowData: data.flowData || '{}',
                            changeDescription: data.changeDescription || `Imported from git`,
                            createdBy: data.createdBy || 'git-sync',
                            chatFlowName: data.chatFlowName || chatflow?.name,
                            chatFlowType: data.chatFlowType || chatflow?.type,
                            chatbotConfig: data.chatbotConfig || null,
                            apiConfig: data.apiConfig || null,
                            analytic: data.analytic || null,
                            category: data.category || null,
                            speechToText: data.speechToText || null,
                            followUpPrompts: data.followUpPrompts || null,
                            textToSpeech: data.textToSpeech || null
                        })
                        await versionRepo.save(newVersion)
                        versionsImported++
                        logger.info(`[GitSync] Imported version ${versionNumber} for ${chatflowId} from git`)
                    }
                } catch (error) {
                    logger.error(`[GitSync] Failed to import ${filePath}: ${error}`)
                }
            }
        }
    }

    logger.info(`[GitSync] Imported ${versionsImported} versions, created ${flowsCreated} new flows from git`)
    return { versionsImported, flowsCreated, pulled }
}

// Re-export types
export { GitSyncService, GitSyncConfig, GitAuthor, GitCommitResult, GitLogEntry, gitSyncRepoPath } from './GitSyncService'
export { GitFileSerializer } from './GitFileSerializer'
export type { GitSyncConfig as PartialGitSyncConfig }
