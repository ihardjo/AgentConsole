import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import chatflowVersionService from '../../services/chatflow-versions'
import { getPageAndLimitParams } from '../../utils/pagination'

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

        const apiResponse = await chatflowVersionService.createVersion({
            chatFlowId: req.params.chatflowId,
            flowData: req.body.flowData ? (typeof req.body.flowData === 'string' ? req.body.flowData : JSON.stringify(req.body.flowData)) : undefined,
            changeDescription: req.body.changeDescription,
            createdBy: userName || userId
        })
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

        const apiResponse = await chatflowVersionService.restoreVersion(req.params.versionId, userName)
        return res.status(StatusCodes.CREATED).json(apiResponse)
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
        await chatflowVersionService.deleteVersion(req.params.versionId)
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

export default {
    getVersionsByFlowId,
    getVersionById,
    createVersion,
    restoreVersion,
    deleteVersion,
    getAllVersions,
    getAllVersionsGrouped,
    getAgentflowsForVersioning
}
