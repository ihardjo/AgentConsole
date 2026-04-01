import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import temporalService from '../../services/temporal'
import { checkTemporalHealth } from '../../services/temporal/client'

import logger from '../../utils/logger'
import { getPageAndLimitParams } from '../../utils/pagination'

function extractFlowIdFromScheduleId(scheduleId: string): string | null {
    const match = scheduleId.match(/^schedule-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
    return match ? match[1] : null
}

async function verifyScheduleOwnership(scheduleId: string, workspaceId: string): Promise<void> {
    const flowId = extractFlowIdFromScheduleId(scheduleId)
    if (!flowId) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Invalid schedule ID format')
    }
    await temporalService.getWorkflowById(flowId, workspaceId)
}

const getAllWorkflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        const { page, limit } = getPageAndLimitParams(req)
        const search = req.query?.search as string | undefined

        const workflows = await temporalService.getAllWorkflows(workspaceId, page, limit, search)
        return res.json(workflows)
    } catch (error) {
        next(error)
    }
}

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

// ============================================================================
// Temporal Execution APIs
// Note: API uses "executionId" for clarity, but service layer uses "workflowId"
//       to match Temporal SDK terminology. The executionId IS a Temporal workflowId.
// ============================================================================

const sendSignal = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { executionId } = req.params
        if (!executionId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Execution ID is required')
        }

        const { signalName, payload } = req.body
        if (!signalName) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Signal name is required')
        }

        // Map API executionId to service workflowId (Temporal SDK terminology)
        await temporalService.sendSignal({
            workflowId: executionId,
            signalName,
            payload
        })

        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

const getExecutionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { executionId } = req.params
        if (!executionId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Execution ID is required')
        }

        // Map API executionId to service workflowId (Temporal SDK terminology)
        const status = await temporalService.getWorkflowStatus(executionId)
        return res.json(status)
    } catch (error) {
        next(error)
    }
}

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

const getScheduleDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { scheduleId } = req.params
        if (!scheduleId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Schedule ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        await verifyScheduleOwnership(scheduleId, workspaceId)

        const details = await temporalService.getScheduleDetails(scheduleId)
        return res.json(details)
    } catch (error) {
        if (error instanceof InternalFlowiseError && error.statusCode === StatusCodes.NOT_FOUND) {
            return res.status(StatusCodes.NOT_FOUND).json({ error: error.message })
        }
        next(error)
    }
}

const pauseSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { scheduleId } = req.params
        if (!scheduleId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Schedule ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        await verifyScheduleOwnership(scheduleId, workspaceId)

        const { reason } = req.body || {}
        await temporalService.pauseSchedule(scheduleId, reason)
        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

const unpauseSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { scheduleId } = req.params
        if (!scheduleId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Schedule ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        await verifyScheduleOwnership(scheduleId, workspaceId)

        await temporalService.unpauseSchedule(scheduleId)
        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

const triggerSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { scheduleId } = req.params
        if (!scheduleId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Schedule ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        await verifyScheduleOwnership(scheduleId, workspaceId)

        await temporalService.triggerSchedule(scheduleId)
        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

const deleteSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { scheduleId } = req.params
        if (!scheduleId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Schedule ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        await verifyScheduleOwnership(scheduleId, workspaceId)

        await temporalService.deleteSchedule(scheduleId)
        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

// ============================================================================
// Workflow Execution APIs (for querying running Temporal executions)
// ============================================================================

/**
 * List all workflow executions for a given flow definition
 * GET /workflows/:id/executions
 */
const listExecutions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workflow ID is required')
        }

        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Workspace ID is required')
        }

        // Verify the flow belongs to this workspace
        await temporalService.getWorkflowById(id, workspaceId)

        const status = req.query?.status as string | undefined
        const result = await temporalService.listWorkflowExecutions(id, status)
        return res.json(result)
    } catch (error) {
        next(error)
    }
}

/**
 * Query a specific workflow execution's state
 * GET /executions/:executionId/query/:queryName
 */
const queryExecution = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { executionId, queryName } = req.params
        if (!executionId) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Execution ID is required')
        }
        if (!queryName) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Query name is required')
        }

        // Note: We don't verify workspace ownership here because the executionId
        // is a Temporal execution ID, not a flow definition ID. The Temporal
        // namespace already provides isolation.

        // Map API executionId to service workflowId (Temporal SDK terminology)
        const result = await temporalService.queryWorkflowExecution({
            workflowId: executionId,
            queryName
        })
        return res.json(result)
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
    getExecutionStatus,
    getWorkspaceAgentFlows,
    healthCheck,
    getScheduleDetails,
    pauseSchedule,
    unpauseSchedule,
    triggerSchedule,
    deleteSchedule,
    listExecutions,
    queryExecution
}
