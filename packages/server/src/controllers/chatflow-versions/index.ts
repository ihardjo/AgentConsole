import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import chatflowVersionService from '../../services/chatflow-versions'
import { getPageAndLimitParams } from '../../utils/pagination'
import { NodeComparatorFactory } from '../../utils/version-comparison'
import { getGitSyncService, getGitFileSerializer, getAuthorFromUser } from '../../services/git-sync'
import logger from '../../utils/logger'

/**
 * Get all versions for a specific chatflow
 */
const getVersionsByFlowId = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.chatflowId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.getVersionsByFlowId - chatflowId not provided!`
            )
        }
        const { page, limit } = getPageAndLimitParams(req)
        const apiResponse = await chatflowVersionService.getVersionsByFlowId(req.params.chatflowId, page, limit)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Get a specific version by ID
 */
const getVersionById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.versionId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.getVersionById - versionId not provided!`
            )
        }
        const apiResponse = await chatflowVersionService.getVersionById(req.params.versionId)
        if (!apiResponse) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Version ${req.params.versionId} not found`)
        }
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Create a new version
 * If flowData is not provided in the request body, it will fetch the current flowData from the chatflow
 */
const createVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.chatflowId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.createVersion - chatflowId not provided!`
            )
        }

        const userId = req.user?.id
        const userName = req.user?.name || req.user?.email
        const workspaceId = req.user?.activeWorkspaceId

        const apiResponse = await chatflowVersionService.createVersion({
            chatFlowId: req.params.chatflowId,
            flowData: req.body.flowData ? (typeof req.body.flowData === 'string' ? req.body.flowData : JSON.stringify(req.body.flowData)) : undefined,
            changeDescription: req.body.changeDescription,
            createdBy: userName || userId,
            workspaceId
        })

        // Git Sync: serialize version to file and commit as the logged-in user
        try {
            const gitService = workspaceId ? await getGitSyncService(workspaceId) : null
            if (gitService && gitService.isEnabled() && gitService.isInitialized()) {
                const serializer = getGitFileSerializer(workspaceId!)
                const entityType = apiResponse.chatFlow?.type === 'AGENTFLOW' ? 'agentflows' : 'chatflows'

                const actualVersion = serializer.safeWriteVersion(entityType, apiResponse.chatFlowId, apiResponse.version, {
                    id: apiResponse.id,
                    version: apiResponse.version,
                    chatFlowId: apiResponse.chatFlowId,
                    chatFlowName: apiResponse.chatFlow?.name,
                    chatFlowType: apiResponse.chatFlow?.type,
                    changeDescription: apiResponse.changeDescription,
                    createdBy: apiResponse.createdBy,
                    createdDate: apiResponse.createdDate,
                    flowData: apiResponse.flowData,
                    chatbotConfig: apiResponse.chatbotConfig,
                    apiConfig: apiResponse.apiConfig,
                    analytic: apiResponse.analytic,
                    category: apiResponse.category,
                    speechToText: apiResponse.speechToText,
                    followUpPrompts: apiResponse.followUpPrompts,
                    textToSpeech: apiResponse.textToSpeech
                })

                const author = getAuthorFromUser(req.user)
                const flowName = apiResponse.chatFlow?.name || apiResponse.chatFlowName || `Chatflow ${apiResponse.chatFlowId.substring(0, 8)}`
                const flowDir = `workspaces/${workspaceId}/${entityType}/${apiResponse.chatFlowId}`
                await gitService.commit(
                    entityType,
                    apiResponse.chatFlowId,
                    `${flowName} — v${actualVersion}${apiResponse.changeDescription ? ': ' + apiResponse.changeDescription : ''}`,
                    'create',
                    author,
                    [flowDir]
                )
            }
        } catch (gitError) {
            logger.warn(`[GitSync] Failed to commit version create, but version was saved: ${gitError}`)
        }

        return res.status(StatusCodes.CREATED).json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Restore a version
 */
const restoreVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.versionId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.restoreVersion - versionId not provided!`
            )
        }

        const userName = req.user?.name || req.user?.email || req.user?.id
        const workspaceId = req.user?.activeWorkspaceId

        const apiResponse = await chatflowVersionService.restoreVersion(req.params.versionId, userName, workspaceId)

        // Git Sync: commit the restore action as the logged-in user
        try {
            const gitService = workspaceId ? await getGitSyncService(workspaceId) : null
            if (gitService && gitService.isEnabled() && gitService.isInitialized()) {
                const serializer = getGitFileSerializer(workspaceId!)
                const entityType = (apiResponse.chatFlow?.type || apiResponse.chatFlowType) === 'AGENTFLOW' ? 'agentflows' : 'chatflows'

                // chatFlow join may be null for restored-from-deleted flows at the
                // time this object was loaded; fall back to embedded metadata fields.
                const flowName = apiResponse.chatFlow?.name || apiResponse.chatFlowName || `Chatflow ${apiResponse.chatFlowId?.substring(0, 8)}`

                serializer.safeWriteVersion(entityType, apiResponse.chatFlowId, apiResponse.version, {
                    id: apiResponse.id,
                    version: apiResponse.version,
                    chatFlowId: apiResponse.chatFlowId,
                    chatFlowName: flowName,
                    chatFlowType: apiResponse.chatFlow?.type || apiResponse.chatFlowType,
                    changeDescription: `[RESTORE] Restored to version ${apiResponse.version}`,
                    createdBy: userName,
                    createdDate: apiResponse.createdDate,
                    flowData: apiResponse.flowData,
                    chatbotConfig: apiResponse.chatbotConfig,
                    apiConfig: apiResponse.apiConfig,
                    analytic: apiResponse.analytic,
                    category: apiResponse.category,
                    speechToText: apiResponse.speechToText,
                    followUpPrompts: apiResponse.followUpPrompts,
                    textToSpeech: apiResponse.textToSpeech
                })

                const author = getAuthorFromUser(req.user)
                const flowDir = `workspaces/${workspaceId}/${entityType}/${apiResponse.chatFlowId}`
                await gitService.commit(
                    entityType,
                    apiResponse.chatFlowId,
                    `${flowName} — restored to v${apiResponse.version}`,
                    'restore',
                    author,
                    [flowDir]
                )
            }
        } catch (gitError) {
            logger.warn(`[GitSync] Failed to commit version restore, but restore was applied: ${gitError}`)
        }

        return res.status(StatusCodes.CREATED).json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Update a version's description
 */
const updateVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.versionId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.updateVersion - versionId not provided!`
            )
        }
        const apiResponse = await chatflowVersionService.updateVersion(req.params.versionId, {
            changeDescription: req.body.changeDescription
        })
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Delete a version
 */
const deleteVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.versionId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.deleteVersion - versionId not provided!`
            )
        }

        // Fetch version details before deletion (needed for Git sync)
        const workspaceId = req.user?.activeWorkspaceId
        let versionInfo: { chatFlowId: string; version: number; chatFlowType?: string; chatFlowName?: string } | null = null
        const gitService = workspaceId ? await getGitSyncService(workspaceId) : null
        try {
            if (gitService && gitService.isEnabled() && gitService.isInitialized()) {
                const version = await chatflowVersionService.getVersionById(req.params.versionId)
                if (version) {
                    const resolvedType = (version.chatFlow?.type || version.chatFlowType) === 'AGENTFLOW' ? 'agentflows' : 'chatflows'
                    versionInfo = {
                        chatFlowId: version.chatFlowId,
                        version: version.version,
                        chatFlowType: resolvedType,
                        chatFlowName: version.chatFlow?.name || version.chatFlowName
                    }
                }
            }
        } catch {
            // Proceed with deletion even if version lookup fails
        }

        await chatflowVersionService.deleteVersion(req.params.versionId)

        // Git Sync: remove the version file and commit as the logged-in user
        if (versionInfo) {
            try {
                if (gitService && gitService.isEnabled() && gitService.isInitialized()) {
                    const serializer = getGitFileSerializer(workspaceId!)
                    const entityType = versionInfo.chatFlowType || 'chatflows'

                    serializer.deleteVersion(entityType, versionInfo.chatFlowId, versionInfo.version)

                    const author = getAuthorFromUser(req.user)
                    const flowName = versionInfo.chatFlowName || `Chatflow ${versionInfo.chatFlowId.substring(0, 8)}`
                    const flowDir = `workspaces/${workspaceId}/${entityType}/${versionInfo.chatFlowId}`
                    await gitService.commit(
                        entityType,
                        versionInfo.chatFlowId,
                        `${flowName} — deleted v${versionInfo.version}`,
                        'delete',
                        author,
                        [flowDir]
                    )
                }
            } catch (gitError) {
                logger.warn(`[GitSync] Failed to commit version delete, but version was deleted: ${gitError}`)
            }
        }

        return res.status(StatusCodes.NO_CONTENT).send()
    } catch (error) {
        next(error)
    }
}

/**
 * Get all versions across all chatflows (for agentops dashboard)
 */
const getAllVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = getPageAndLimitParams(req)
        const workspaceId = req.user?.activeWorkspaceId
        const chatflowType = req.query?.type as string | undefined

        const apiResponse = await chatflowVersionService.getAllVersions(workspaceId, page, limit, chatflowType)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Get all versions grouped by chatflow (for agentops dashboard)
 */
const getAllVersionsGrouped = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        const chatflowType = req.query?.type as string | undefined
        const page = parseInt(req.query?.page as string) || 1
        const limit = parseInt(req.query?.limit as string) || 12

        const apiResponse = await chatflowVersionService.getAllVersionsGrouped(workspaceId, chatflowType, page, limit)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Get all agentflows for versioning selection dropdown
 */
const getAgentflowsForVersioning = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId

        const apiResponse = await chatflowVersionService.getAgentflowsForVersioning(workspaceId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

/**
 * Compare two versions and return semantic analysis
 */
const compareVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.versionIdA || !req.params.versionIdB) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.compareVersions - versionIdA and versionIdB not provided!`
            )
        }

        const versionIdA = req.params.versionIdA
        const versionIdB = req.params.versionIdB

        // Fetch both versions
        const versionA = await chatflowVersionService.getVersionById(versionIdA)
        const versionB = await chatflowVersionService.getVersionById(versionIdB)

        if (!versionA) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Version ${versionIdA} not found`)
        }
        if (!versionB) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Version ${versionIdB} not found`)
        }

        // Parse flowData to extract node configurations
        const flowDataA = typeof versionA.flowData === 'string' ? JSON.parse(versionA.flowData) : versionA.flowData
        const flowDataB = typeof versionB.flowData === 'string' ? JSON.parse(versionB.flowData) : versionB.flowData

        const nodesA = flowDataA?.nodes || []
        const nodesB = flowDataB?.nodes || []

        // Compare all nodes between the two versions
        const comparison = NodeComparatorFactory.compareFlows(nodesA, nodesB)

        // Return comparison with version metadata
        return res.json({
            versionA: {
                id: versionA.id,
                version: versionA.version,
                description: versionA.changeDescription,
                createdDate: versionA.createdDate,
                createdBy: versionA.createdBy
            },
            versionB: {
                id: versionB.id,
                version: versionB.version,
                description: versionB.changeDescription,
                createdDate: versionB.createdDate,
                createdBy: versionB.createdBy
            },
            comparison
        })
    } catch (error) {
        next(error)
    }
}

/**
 * Compare a saved version against the live (active) flowData of its chatflow.
 * GET /chatflow-versions/compare/:versionId/active/:chatflowId
 */
const compareVersionWithActive = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.params.versionId || !req.params.chatflowId) {
            throw new InternalFlowiseError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: chatflowVersionController.compareVersionWithActive - versionId and chatflowId are required`
            )
        }

        const { versionId, chatflowId } = req.params

        const version = await chatflowVersionService.getVersionById(versionId)
        if (!version) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Version ${versionId} not found`)
        }

        const activeFlow = await chatflowVersionService.compareVersionWithActive(chatflowId)
        if (!activeFlow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Chatflow ${chatflowId} not found`)
        }

        const flowDataA = typeof version.flowData === 'string' ? JSON.parse(version.flowData) : version.flowData
        const flowDataB = typeof activeFlow.flowData === 'string' ? JSON.parse(activeFlow.flowData) : activeFlow.flowData

        const nodesA = flowDataA?.nodes || []
        const nodesB = flowDataB?.nodes || []

        const comparison = NodeComparatorFactory.compareFlows(nodesA, nodesB)

        return res.json({
            versionA: {
                id: version.id,
                version: version.version,
                description: version.changeDescription,
                createdDate: version.createdDate,
                createdBy: version.createdBy
            },
            versionB: {
                id: activeFlow.id,
                version: null,
                description: 'Active version (current unsaved state)',
                createdDate: activeFlow.updatedDate,
                createdBy: null,
                isActiveFlow: true,
                activeFlowName: activeFlow.name
            },
            comparison
        })
    } catch (error) {
        next(error)
    }
}

export default {
    getVersionsByFlowId,
    getVersionById,
    createVersion,
    updateVersion,
    restoreVersion,
    deleteVersion,
    getAllVersions,
    getAllVersionsGrouped,
    getAgentflowsForVersioning,
    compareVersions,
    compareVersionWithActive
}
