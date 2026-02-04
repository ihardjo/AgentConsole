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
            createdBy: data.createdBy
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
 * Restore a specific version (updates the chatflow's flowData directly)
 */
const restoreVersion = async (versionId: string, userId?: string): Promise<ChatFlowVersion> => {
    try {
        const appServer = getRunningExpressApp()
        const flowRepo = appServer.AppDataSource.getRepository(ChatFlow)

        const version = await getVersionById(versionId)
        if (!version) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Version not found')
        }

        // Create a backup version of the current state before restoring
        const currentChatflow = await flowRepo.findOne({ where: { id: version.chatFlowId } })
        if (currentChatflow) {
            await createVersion({
                chatFlowId: version.chatFlowId,
                flowData: currentChatflow.flowData,
                changeDescription: `Backup before restoring to version ${version.version}`,
                createdBy: userId
            })
        }

        // Update the main chatflow with this version's flowData
        await flowRepo
            .createQueryBuilder()
            .update(ChatFlow)
            .set({ flowData: version.flowData })
            .where('id = :id', { id: version.chatFlowId })
            .execute()

        logger.info(`[ChatFlowVersion] Restored chatflow ${version.chatFlowId} to version ${version.version}`)

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
                chatFlowName: version.chatFlow?.name || 'Unknown',
                chatFlowType: version.chatFlow?.type || 'Unknown'
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
 * Get all versions grouped by chatflow (for agentops dashboard)
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

        // First, get all chatflows of the specified type
        const flowQueryBuilder = flowRepo.createQueryBuilder('chatFlow')

        if (workspaceId) {
            flowQueryBuilder.andWhere('chatFlow.workspaceId = :workspaceId', { workspaceId })
        }

        if (chatflowType) {
            flowQueryBuilder.andWhere('chatFlow.type = :type', { type: chatflowType })
        }

        flowQueryBuilder.orderBy('chatFlow.name', 'ASC')

        const chatflows = await flowQueryBuilder.getMany()

        // For each chatflow, get its versions
        const groupedData = await Promise.all(
            chatflows.map(async (chatflow) => {
                const versions = await versionRepo
                    .createQueryBuilder('version')
                    .where('version.chatFlowId = :chatFlowId', { chatFlowId: chatflow.id })
                    .orderBy('version.version', 'DESC')
                    .getMany()

                return {
                    chatFlowId: chatflow.id,
                    chatFlowName: chatflow.name,
                    chatFlowType: chatflow.type,
                    versionCount: versions.length,
                    versions: versions.map((v) => {
                        return {
                            ...v
                        }
                    })
                }
            })
        )

        // Filter out chatflows with no versions if needed, or keep all
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

export default {
    createVersion,
    getVersionsByFlowId,
    getVersionById,
    updateVersion,
    restoreVersion,
    deleteVersion,
    getAllVersions,
    getAllVersionsGrouped,
    getAgentflowsForVersioning
}
