import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import temporalService from '../../services/temporal'
import { checkTemporalHealth } from '../../services/temporal/client'

/**
 * Get all Temporal workflows in the workspace
 */
const getAllWorkflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const workflows = await temporalService.getAllWorkflows(workspaceId)
        return res.json(workflows)
    } catch (error) {
        next(error)
    }
}

/**
 * Get a single Temporal workflow by ID
 */
const getWorkflowById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const workflow = await temporalService.getWorkflowById(id, workspaceId)
        return res.json(workflow)
    } catch (error) {
        next(error)
    }
}

/**
 * Create a new Temporal workflow
 */
const createWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, flowData } = req.body
        if (!name) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow name is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const workflow = await temporalService.createWorkflow({
            name,
            flowData: flowData || JSON.stringify({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
            workspaceId
        })

        return res.status(StatusCodes.CREATED).json(workflow)
    } catch (error) {
        next(error)
    }
}

/**
 * Update an existing Temporal workflow
 */
const updateWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const { name, flowData } = req.body
        const workflow = await temporalService.updateWorkflow(id, workspaceId, { name, flowData })

        return res.json(workflow)
    } catch (error) {
        next(error)
    }
}

/**
 * Delete a Temporal workflow
 */
const deleteWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        await temporalService.deleteWorkflow(id, workspaceId)
        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

/**
 * Start a Temporal workflow execution
 */
const startWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const { input = {} } = req.body

        const result = await temporalService.startWorkflow({
            flowId: id,
            workspaceId,
            input
        })

        return res.json(result)
    } catch (error) {
        next(error)
    }
}

/**
 * Send a signal to a running Temporal workflow
 */
const sendSignal = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { workflowId } = req.params
        if (!workflowId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const { signalName, payload } = req.body
        if (!signalName) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Signal name is required')
        }

        await temporalService.sendSignal({
            workflowId,
            signalName,
            payload
        })

        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

/**
 * Get the status of a Temporal workflow execution
 */
const getWorkflowStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { workflowId } = req.params
        if (!workflowId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const status = await temporalService.getWorkflowStatus(workflowId)
        return res.json(status)
    } catch (error) {
        next(error)
    }
}

/**
 * Get all AgentFlows in the workspace (for dropdown)
 */
const getWorkspaceAgentFlows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const agentFlows = await temporalService.getWorkspaceAgentFlows(workspaceId)
        return res.json(agentFlows)
    } catch (error) {
        next(error)
    }
}

/**
 * Health check for Temporal server connection
 */
const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const health = await checkTemporalHealth()
        if (health.healthy) {
            return res.json({ status: 'healthy' })
        } else {
            return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
                status: 'unhealthy',
                error: health.error
            })
        }
    } catch (error) {
        next(error)
    }
}

export default {
    getAllWorkflows,
    getWorkflowById,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    startWorkflow,
    sendSignal,
    getWorkflowStatus,
    getWorkspaceAgentFlows,
    healthCheck
}
