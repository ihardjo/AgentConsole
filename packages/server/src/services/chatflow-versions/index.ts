import { StatusCodes } from 'http-status-codes'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { ChatFlowVersion } from '../../database/entities/ChatFlowVersion'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'

export interface CreateVersionDTO {
    chatFlowId: string
    flowData?: string // Optional - if not provided, will fetch from chatflow
    changeDescription?: string
    createdBy?: string
}

/**
 * Create a new version of an agent flow
 * If flowData is not provided, it will fetch the current flowData from the chatflow
 */
const createVersion = async (data: CreateVersionDTO): Promise<ChatFlowVersion> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)
        const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

        // Verify chatflow exists
        const chatflow = await flowRepo.findOne({ where: { id: data.chatFlowId } })
        if (!chatflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `ChatFlow ${data.chatFlowId} not found`)
        }

        // Use provided flowData or fetch from chatflow if not provided
        const flowData = data.flowData || chatflow.flowData

        // Get latest version number
        const latestVersion = await versionRepo
            .createQueryBuilder('version')
            .where('version.chatFlowId = :chatFlowId', { chatFlowId: data.chatFlowId })
            .orderBy('version.version', 'DESC')
            .getOne()

        const nextVersion = latestVersion ? latestVersion.version + 1 : 1

        const newVersion = versionRepo.create({
            chatFlowId: data.chatFlowId,
            version: nextVersion,
            flowData: flowData,
            changeDescription: data.changeDescription,
            createdBy: data.createdBy,
            chatFlowName: chatflow.name,
            chatFlowType: chatflow.type,
            chatbotConfig: chatflow.chatbotConfig,
            apiConfig: chatflow.apiConfig,
            analytic: chatflow.analytic,
            category: chatflow.category,
            speechToText: chatflow.speechToText,
            followUpPrompts: chatflow.followUpPrompts,
            textToSpeech: chatflow.textToSpeech
        })

        const savedVersion = await versionRepo.save(newVersion)
        logger.info(`[ChatFlowVersion] Created version ${nextVersion} for chatflow ${data.chatFlowId}`)

        return savedVersion
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.createVersion - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get all versions for an agent flow
 */
const getVersionsByFlowId = async (
    chatFlowId: string,
    page: number = 1,
    limit: number = 20
): Promise<{ data: ChatFlowVersion[]; total: number }> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

        const queryBuilder = versionRepo
            .createQueryBuilder('version')
            .where('version.chatFlowId = :chatFlowId', { chatFlowId })
            .orderBy('version.version', 'DESC')

        const total = await queryBuilder.getCount()

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit).take(limit)
        }

        const data = await queryBuilder.getMany()

        return { data, total }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.getVersionsByFlowId - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get a specific version by ID
 */
const getVersionById = async (versionId: string): Promise<ChatFlowVersion | null> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

        const version = await versionRepo
            .createQueryBuilder('version')
            .leftJoinAndSelect('version.chatFlow', 'chatFlow')
            .where('version.id = :versionId', { versionId })
            .getOne()

        return version
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.getVersionById - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Restore a specific version.
 *
 * - If the parent chatflow still exists → backs up the current state and
 *   updates its `flowData` to the version's data.
 * - If the parent chatflow has been deleted → recreates it from the
 *   version's embedded metadata (`chatFlowName`, `chatFlowType`, `flowData`)
 *   using the **same chatflow ID** so that references and git history are
 *   preserved, then re-links any legacy NULL-id versions by name.
 *
 * @param versionId   UUID of the ChatFlowVersion to restore.
 * @param userId      Name/email of the user performing the restore (for audit).
 * @param workspaceId Active workspace — required when recreating a deleted flow.
 */
const restoreVersion = async (versionId: string, userId?: string, workspaceId?: string): Promise<ChatFlowVersion> => {
    try {
        const appServer = getRunningExpressApp()
        const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

        const version = await getVersionById(versionId)
        if (!version) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Version not found')
        }

        // Guard: a version with no chatFlowId cannot be restored to a specific flow.
        // This only happens for legacy git-imported versions that were never linked.
        if (!version.chatFlowId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                'Cannot restore: version has no associated chatflow ID'
            )
        }

        const currentChatflow = await flowRepo.findOne({ where: { id: version.chatFlowId } })

        if (currentChatflow) {
            // ── Flow exists — apply the version directly ──────────────────
            // No autosave: the caller is responsible for confirming the user
            // is aware of unsaved changes before invoking this function.
            // Restore flowData plus all config fields captured at version-save time.
            await flowRepo
                .createQueryBuilder()
                .update(ChatFlow)
                .set({
                    flowData: version.flowData,
                    ...(version.chatbotConfig !== undefined && { chatbotConfig: version.chatbotConfig }),
                    ...(version.apiConfig !== undefined && { apiConfig: version.apiConfig }),
                    ...(version.analytic !== undefined && { analytic: version.analytic }),
                    ...(version.category !== undefined && { category: version.category }),
                    ...(version.speechToText !== undefined && { speechToText: version.speechToText }),
                    ...(version.followUpPrompts !== undefined && { followUpPrompts: version.followUpPrompts }),
                    ...(version.textToSpeech !== undefined && { textToSpeech: version.textToSpeech })
                })
                .where('id = :id', { id: version.chatFlowId })
                .execute()

            logger.info(`[ChatFlowVersion] Restored chatflow ${version.chatFlowId} to version ${version.version}`)
        } else {
            // ── Flow was deleted — recreate it at the original UUID ────────
            const flowName = version.chatFlowName || `Restored Agent ${version.chatFlowId.substring(0, 8)}`
            const flowType = version.chatFlowType || 'AGENTFLOW'

            // workspaceId is required to satisfy the NOT NULL constraint.
            // The caller (controller) passes the user's active workspace.
            const targetWorkspaceId = workspaceId
            if (!targetWorkspaceId) {
                throw new InternalFlowiseError(
                    StatusCodes.PRECONDITION_FAILED,
                    'Cannot restore deleted flow: workspaceId is required'
                )
            }

            // Insert at the original ID so all version rows and git history
            // that reference this chatFlowId remain valid without any re-linking.
            await flowRepo
                .createQueryBuilder()
                .insert()
                .into(ChatFlow)
                .values({
                    id: version.chatFlowId,
                    name: flowName,
                    flowData: version.flowData,
                    type: flowType as any,
                    deployed: false,
                    isPublic: false,
                    workspaceId: targetWorkspaceId,
                    chatbotConfig: version.chatbotConfig,
                    apiConfig: version.apiConfig,
                    analytic: version.analytic,
                    category: version.category,
                    speechToText: version.speechToText,
                    followUpPrompts: version.followUpPrompts,
                    textToSpeech: version.textToSpeech
                })
                .execute()

            // Re-link any legacy NULL-id versions (git-imported) that share the
            // same name — chatFlowId-bearing versions are already correctly linked
            // because the id was preserved on delete.
            await versionRepo
                .createQueryBuilder()
                .update(ChatFlowVersion)
                .set({ chatFlowId: version.chatFlowId })
                .where('chatFlowName = :name AND chatFlowId IS NULL', { name: flowName })
                .execute()

            logger.info(
                `[ChatFlowVersion] Recreated deleted chatflow ${version.chatFlowId} ("${flowName}") ` +
                `in workspace ${targetWorkspaceId} and restored to version ${version.version}`
            )
        }

        return version
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.restoreVersion - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Update a version's description
 */
const updateVersion = async (versionId: string, data: { changeDescription?: string }): Promise<ChatFlowVersion> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

        const version = await versionRepo.findOne({ where: { id: versionId } })

        if (!version) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Version not found')
        }

        version.changeDescription = data.changeDescription || ''
        const updatedVersion = await versionRepo.save(version)
        
        logger.info(`[ChatFlowVersion] Updated version ${version.version} for chatflow ${version.chatFlowId}`)
        
        return updatedVersion
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.updateVersion - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Delete a version
 */
const deleteVersion = async (versionId: string): Promise<void> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

        const version = await versionRepo.findOne({ where: { id: versionId } })

        if (!version) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Version not found')
        }

        await versionRepo.remove(version)
        logger.info(`[ChatFlowVersion] Deleted version ${version.version} for chatflow ${version.chatFlowId}`)
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.deleteVersion - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get all versions across all chatflows (for agentops dashboard)
 */
const getAllVersions = async (
    workspaceId?: string,
    page: number = 1,
    limit: number = 20,
    chatflowType?: string
): Promise<{ data: any[]; total: number }> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)

        const queryBuilder = versionRepo
            .createQueryBuilder('version')
            .leftJoinAndSelect('version.chatFlow', 'chatFlow')
            .orderBy('version.createdDate', 'DESC')

        if (workspaceId) {
            queryBuilder.andWhere('chatFlow.workspaceId = :workspaceId', { workspaceId })
        }

        if (chatflowType) {
            queryBuilder.andWhere('chatFlow.type = :type', { type: chatflowType })
        }

        const total = await queryBuilder.getCount()

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit).take(limit)
        }

        const versions = await queryBuilder.getMany()

        // Transform the data to include chatflow name
        const data = versions.map((version) => {
            return {
                ...version,
                chatFlowName: version.chatFlow?.name || version.chatFlowName || 'Unknown',
                chatFlowType: version.chatFlow?.type || version.chatFlowType || 'Unknown'
            }
        })

        return { data, total }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.getAllVersions - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get all versions grouped by chatflow (for agentops dashboard).
 *
 * Includes **orphaned** versions whose parent chatflow was deleted
 * (chatFlowId IS NULL after SET NULL cascade).  These are grouped by
 * their embedded `chatFlowName` so the user can still see and restore them.
 */
const getAllVersionsGrouped = async (
    workspaceId?: string,
    chatflowType?: string,
    page: number = 1,
    limit: number = 12
): Promise<{ data: any[]; total: number }> => {
    try {
        const appServer = getRunningExpressApp()
        const versionRepo = appServer.AppDataSource.getRepository(ChatFlowVersion)
        const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

        // ── 1. Active chatflows ─────────────────────────────────────
        const flowQueryBuilder = flowRepo.createQueryBuilder('chatFlow')

        if (workspaceId) {
            flowQueryBuilder.andWhere('chatFlow.workspaceId = :workspaceId', { workspaceId })
        }

        if (chatflowType) {
            flowQueryBuilder.andWhere('chatFlow.type = :type', { type: chatflowType })
        }

        flowQueryBuilder.orderBy('chatFlow.name', 'ASC')

        const chatflows = await flowQueryBuilder.getMany()

        const groupedData = await Promise.all(
            chatflows.map(async (chatflow) => {
                const versions = await versionRepo
                    .createQueryBuilder('version')
                    .where('version.chatFlowId = :chatFlowId', { chatFlowId: chatflow.id })
                    .orderBy('version.version', 'DESC')
                    .getMany()

                // Normalise the live flowData once for comparison.
                // We parse-then-stringify to eliminate whitespace / key-order noise.
                let normalizedLive: string
                try {
                    normalizedLive = JSON.stringify(JSON.parse(chatflow.flowData))
                } catch {
                    normalizedLive = chatflow.flowData
                }

                // Find the single version whose flowData exactly matches the live
                // chatflow — that version is considered "Active".
                let activeVersionId: string | null = null
                for (const v of versions) {
                    try {
                        if (JSON.stringify(JSON.parse(v.flowData)) === normalizedLive) {
                            activeVersionId = v.id
                            break
                        }
                    } catch {
                        if (v.flowData === chatflow.flowData) {
                            activeVersionId = v.id
                            break
                        }
                    }
                }

                // "Unsaved Changes" — live flowData does not match any saved version.
                const hasUnsavedChanges = activeVersionId === null

                return {
                    chatFlowId: chatflow.id,
                    chatFlowName: chatflow.name,
                    chatFlowType: chatflow.type,
                    versionCount: versions.length,
                    isDeleted: false,
                    hasUnsavedChanges,
                    activeVersionId,
                    versions: versions.map((v) => ({ ...v }))
                }
            })
        )

        // ── 2. Orphaned versions ────────────────────────────────────
        // A version is orphaned when its parent ChatFlow no longer exists.
        // This covers two cases:
        //  a) chatFlowId references a deleted flow (NOT IN active flows) — the
        //     normal case after a chatflow delete where chatFlowId is preserved
        //  b) chatFlowId IS NULL — legacy / git-imported versions with no id
        const activeFlowIds = chatflows.map((cf) => cf.id)

        const orphanQueryBuilder = versionRepo
            .createQueryBuilder('version')
            .orderBy('version.chatFlowName', 'ASC')
            .addOrderBy('version.version', 'DESC')

        if (activeFlowIds.length > 0) {
            orphanQueryBuilder.where(
                'version.chatFlowId IS NULL OR version.chatFlowId NOT IN (:...activeFlowIds)',
                { activeFlowIds }
            )
        } else {
            // No active flows at all — all versions are orphaned
            orphanQueryBuilder.where('1=1')
        }

        if (chatflowType) {
            orphanQueryBuilder.andWhere('version.chatFlowType = :type', { type: chatflowType })
        }

        const orphanedVersions = await orphanQueryBuilder.getMany()

        // Group orphans by chatFlowId first (preserved on delete), then fall back
        // to chatFlowName for legacy/git-imported versions that have no id.
        const orphanGroups = new Map<string, any[]>()
        for (const v of orphanedVersions) {
            const key = v.chatFlowId || v.chatFlowName || `Unknown (${v.id.substring(0, 8)})`
            if (!orphanGroups.has(key)) orphanGroups.set(key, [])
            orphanGroups.get(key)!.push({ ...v })
        }

        for (const [, versions] of orphanGroups) {
            groupedData.push({
                chatFlowId: versions[0]?.chatFlowId || versions[0]?.id,
                chatFlowName: versions[0]?.chatFlowName || `Unknown (${(versions[0]?.chatFlowId || versions[0]?.id || '').substring(0, 8)})`,
                chatFlowType: versions[0]?.chatFlowType || 'AGENTFLOW',
                versionCount: versions.length,
                isDeleted: true,
                hasUnsavedChanges: false,
                activeVersionId: null,
                versions
            })
        }

        // Filter out chatflows with no versions
        const allData = groupedData.filter((g) => g.versionCount > 0)
        
        // Get total count before pagination
        const total = allData.length

        // Apply pagination
        const skip = (page - 1) * limit
        const data = allData.slice(skip, skip + limit)

        return { data, total }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.getAllVersionsGrouped - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get all agentflows for selection dropdown (only AGENTFLOW type)
 */
const getAgentflowsForVersioning = async (workspaceId?: string): Promise<any[]> => {
    try {
        const appServer = getRunningExpressApp()
        const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

        const queryBuilder = flowRepo
            .createQueryBuilder('chatFlow')
            .select(['chatFlow.id', 'chatFlow.name', 'chatFlow.flowData', 'chatFlow.updatedDate'])
            .where('chatFlow.type = :type', { type: 'AGENTFLOW' })
            .orderBy('chatFlow.name', 'ASC')

        if (workspaceId) {
            queryBuilder.andWhere('chatFlow.workspaceId = :workspaceId', { workspaceId })
        }

        const chatflows = await queryBuilder.getMany()

        return chatflows
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.getAgentflowsForVersioning - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Fetch the live (active) flowData for a chatflow and return it in the same
 * shape that compareVersions uses, so the caller can diff a saved version
 * against the current unsaved state of the flow.
 */
const compareVersionWithActive = async (
    chatflowId: string
): Promise<{ id: string; name: string; flowData: string; updatedDate: Date } | null> => {
    try {
        const appServer = getRunningExpressApp()
        const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

        const chatflow = await flowRepo
            .createQueryBuilder('chatFlow')
            .select(['chatFlow.id', 'chatFlow.name', 'chatFlow.flowData', 'chatFlow.updatedDate'])
            .where('chatFlow.id = :id', { id: chatflowId })
            .getOne()

        if (!chatflow) return null

        return {
            id: chatflow.id,
            name: chatflow.name,
            flowData: chatflow.flowData,
            updatedDate: chatflow.updatedDate
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: chatflowVersionService.compareVersionWithActive - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createVersion,
    getVersionsByFlowId,
    getVersionById,
    updateVersion,
    restoreVersion,
    deleteVersion,
    getAllVersions,
    getAllVersionsGrouped,
    getAgentflowsForVersioning,
    compareVersionWithActive
}
