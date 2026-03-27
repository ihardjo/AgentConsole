import { StatusCodes } from 'http-status-codes'
import { ChatFlow, EnumChatflowType } from '../../database/entities/ChatFlow'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'
import { getTemporalClient, getTaskQueue, getTemporalWebUIUrl } from './client'
import config from '../../utils/config'

/**
 * Get all Temporal workflows for a workspace
 */
const getAllWorkflows = async (workspaceId: string): Promise<ChatFlow[]> => {
    try {
        const appServer = getRunningExpressApp()
        const workflows = await appServer.AppDataSource.getRepository(ChatFlow).find({
            where: {
                type: EnumChatflowType.TEMPORAL,
                workspaceId
            },
            order: {
                updatedDate: 'DESC'
            }
        })
        return workflows
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.getAllWorkflows - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get a single Temporal workflow by ID
 */
const getWorkflowById = async (id: string, workspaceId: string): Promise<ChatFlow> => {
    try {
        const appServer = getRunningExpressApp()
        const workflow = await appServer.AppDataSource.getRepository(ChatFlow).findOne({
            where: {
                id,
                type: EnumChatflowType.TEMPORAL,
                workspaceId
            }
        })

        if (!workflow) {
            throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Temporal workflow ${id} not found`)
        }

        return workflow
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.getWorkflowById - ${getErrorMessage(error)}`
        )
    }
}

export interface CreateWorkflowParams {
    name: string
    flowData: string
    workspaceId: string
}

/**
 * Create a new Temporal workflow
 */
const createWorkflow = async (params: CreateWorkflowParams): Promise<ChatFlow> => {
    try {
        const appServer = getRunningExpressApp()
        const newWorkflow = new ChatFlow()

        newWorkflow.name = params.name
        newWorkflow.flowData = params.flowData
        newWorkflow.type = EnumChatflowType.TEMPORAL
        newWorkflow.workspaceId = params.workspaceId

        const workflow = await appServer.AppDataSource.getRepository(ChatFlow).save(newWorkflow)
        return workflow
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.createWorkflow - ${getErrorMessage(error)}`
        )
    }
}

export interface UpdateWorkflowParams {
    name?: string
    flowData?: string
}

/**
 * Update an existing Temporal workflow
 */
const updateWorkflow = async (id: string, workspaceId: string, params: UpdateWorkflowParams): Promise<ChatFlow> => {
    try {
        const appServer = getRunningExpressApp()
        const workflow = await getWorkflowById(id, workspaceId)

        if (params.name !== undefined) {
            workflow.name = params.name
        }
        if (params.flowData !== undefined) {
            workflow.flowData = params.flowData
        }

        const updatedWorkflow = await appServer.AppDataSource.getRepository(ChatFlow).save(workflow)
        return updatedWorkflow
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.updateWorkflow - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Delete a Temporal workflow
 */
const deleteWorkflow = async (id: string, workspaceId: string): Promise<void> => {
    try {
        const appServer = getRunningExpressApp()
        const workflow = await getWorkflowById(id, workspaceId)

        await appServer.AppDataSource.getRepository(ChatFlow).delete({ id: workflow.id })
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.deleteWorkflow - ${getErrorMessage(error)}`
        )
    }
}

export interface StartWorkflowParams {
    flowId: string
    workspaceId: string
    input: Record<string, any>
}

export interface StartWorkflowResult {
    workflowId: string
    runId: string
    temporalUrl: string
}

/**
 * Start a Temporal workflow execution
 */
const startWorkflow = async (params: StartWorkflowParams): Promise<StartWorkflowResult> => {
    try {
        // Verify the workflow exists
        const workflow = await getWorkflowById(params.flowId, params.workspaceId)

        const client = await getTemporalClient()
        const taskQueue = getTaskQueue()

        // Generate a unique workflow ID
        const workflowId = `durable-${params.flowId}-${Date.now()}`

        const handle = await client.workflow.start('durableWorkflowExecutor', {
            taskQueue,
            workflowId,
            args: [
                {
                    flowId: params.flowId,
                    workspaceId: params.workspaceId,
                    input: params.input
                }
            ]
        })

        const runId = handle.firstExecutionRunId

        logger.info(`Started Temporal workflow: ${workflowId} (runId: ${runId})`)

        return {
            workflowId,
            runId,
            temporalUrl: getTemporalWebUIUrl(workflowId, runId)
        }
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.startWorkflow - ${getErrorMessage(error)}`
        )
    }
}

export interface SendSignalParams {
    workflowId: string
    signalName: string
    payload?: any
}

/**
 * Send a signal to a running Temporal workflow
 */
const sendSignal = async (params: SendSignalParams): Promise<void> => {
    try {
        const client = await getTemporalClient()
        const handle = client.workflow.getHandle(params.workflowId)

        await handle.signal(params.signalName, params.payload)

        logger.info(`Sent signal '${params.signalName}' to workflow ${params.workflowId}`)
    } catch (error) {
        throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: temporalService.sendSignal - ${getErrorMessage(error)}`)
    }
}

export interface WorkflowStatus {
    workflowId: string
    runId?: string
    status: string
    startTime?: Date
    closeTime?: Date
    temporalUrl: string
}

/**
 * Get the status of a Temporal workflow execution
 */
const getWorkflowStatus = async (workflowId: string): Promise<WorkflowStatus> => {
    try {
        const client = await getTemporalClient()
        const handle = client.workflow.getHandle(workflowId)
        const description = await handle.describe()

        return {
            workflowId,
            runId: description.runId,
            status: description.status.name,
            startTime: description.startTime,
            closeTime: description.closeTime,
            temporalUrl: getTemporalWebUIUrl(workflowId, description.runId)
        }
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.getWorkflowStatus - ${getErrorMessage(error)}`
        )
    }
}

/**
 * Get all AgentFlows in a workspace (for the AgentFlowCall node dropdown)
 */
const getWorkspaceAgentFlows = async (workspaceId: string): Promise<{ id: string; name: string }[]> => {
    try {
        const appServer = getRunningExpressApp()
        const agentFlows = await appServer.AppDataSource.getRepository(ChatFlow).find({
            where: {
                type: EnumChatflowType.AGENTFLOW,
                workspaceId
            },
            select: ['id', 'name'],
            order: {
                name: 'ASC'
            }
        })

        return agentFlows.map((flow) => ({
            id: flow.id,
            name: flow.name
        }))
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.getWorkspaceAgentFlows - ${getErrorMessage(error)}`
        )
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
    getWorkspaceAgentFlows
}
