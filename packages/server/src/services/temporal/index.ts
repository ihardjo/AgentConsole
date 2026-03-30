import { StatusCodes } from 'http-status-codes'
import { ChatFlow, EnumChatflowType } from '../../database/entities/ChatFlow'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { getErrorMessage } from '../../errors/utils'
import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import logger from '../../utils/logger'
import { getTemporalClient, getTaskQueue, getTemporalWebUIUrl } from './client'
import config from '../../utils/config'

export interface ScheduleConfig {
    triggerMode: 'manual' | 'scheduled'
    scheduleInterval: string
    overlapPolicy: 'SKIP' | 'ALLOW_ALL' | 'BUFFER_ONE' | 'CANCEL_OTHER'
    catchupWindow: string
    scheduleId?: string
}

export interface CreateScheduleResult {
    scheduleId: string
    triggerMode: 'scheduled'
    scheduleInterval: string
    overlapPolicy: string
    temporalUrl: string
}

export interface ScheduleDetailsResult {
    scheduleId: string
    status: { paused: boolean; notes: string }
    spec: Record<string, any>
    nextActionTimes: Date[]
    recentActions: Record<string, any>[]
    overlapPolicy: string
    catchupWindow: string
}

export type OverlapPolicy = 'SKIP' | 'ALLOW_ALL' | 'BUFFER_ONE' | 'CANCEL_OTHER'

export function parseDurationToMs(interval: string): number {
    const match = interval.match(/^(\d+)(s|m|h|d)$/)
    if (!match) {
        throw new InternalFlowiseError(
            StatusCodes.BAD_REQUEST,
            `Invalid interval format: '${interval}'. Expected format: <number><s|m|h|d> (e.g., 30s, 10m, 1h, 1d)`
        )
    }
    const value = parseInt(match[1], 10)
    if (value === 0) {
        throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'Interval must be greater than 0')
    }
    const unit = match[2]
    switch (unit) {
        case 's':
            return value * 1000
        case 'm':
            return value * 60 * 1000
        case 'h':
            return value * 60 * 60 * 1000
        case 'd':
            return value * 24 * 60 * 60 * 1000
        default:
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `Unknown time unit: ${unit}`)
    }
}

function getStartNodeFromFlowData(flowData: string): { type: string; data: Record<string, any> } | null {
    try {
        const parsed = JSON.parse(flowData)
        const nodes = parsed.nodes || []
        return nodes.find((n: any) => n.type === 'temporalStart') || null
    } catch {
        return null
    }
}

const getAllWorkflows = async (
    workspaceId: string,
    page: number = -1,
    limit: number = -1,
    search?: string
): Promise<ChatFlow[] | { data: ChatFlow[]; total: number }> => {
    try {
        const appServer = getRunningExpressApp()
        const queryBuilder = appServer.AppDataSource.getRepository(ChatFlow)
            .createQueryBuilder('chat_flow')
            .where('chat_flow.type = :type', { type: EnumChatflowType.TEMPORAL })
            .andWhere('chat_flow.workspaceId = :workspaceId', { workspaceId })
            .orderBy('chat_flow.updatedDate', 'DESC')

        if (search) {
            queryBuilder.andWhere('chat_flow.name ILIKE :search', { search: `%${search}%` })
        }

        if (page > 0 && limit > 0) {
            queryBuilder.skip((page - 1) * limit)
            queryBuilder.take(limit)
        }

        if (page > 0 && limit > 0) {
            const total = await queryBuilder.getCount()
            const data = await queryBuilder.getMany()
            return { data, total }
        }

        return await queryBuilder.getMany()
    } catch (error) {
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.getAllWorkflows - ${getErrorMessage(error)}`
        )
    }
}

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

const deleteWorkflow = async (id: string, workspaceId: string): Promise<void> => {
    try {
        const appServer = getRunningExpressApp()
        const workflow = await getWorkflowById(id, workspaceId)

        const startNode = getStartNodeFromFlowData(workflow.flowData)
        if (startNode?.data?.scheduleId) {
            try {
                const client = await getTemporalClient()
                const handle = client.schedule.getHandle(startNode.data.scheduleId)
                await handle.delete()
                logger.info(`Deleted Temporal schedule: ${startNode.data.scheduleId} (workflow deletion)`)
            } catch (scheduleError) {
                logger.warn(`Failed to delete schedule ${startNode.data.scheduleId}: ${getErrorMessage(scheduleError)}`)
            }
        }

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

export type StartOrScheduleResult = StartWorkflowResult | CreateScheduleResult

const startWorkflow = async (params: StartWorkflowParams): Promise<StartOrScheduleResult> => {
    try {
        const workflow = await getWorkflowById(params.flowId, params.workspaceId)

        const startNode = getStartNodeFromFlowData(workflow.flowData)
        const triggerMode = startNode?.data?.triggerMode || 'manual'

        if (triggerMode === 'scheduled') {
            return createSchedule({
                flowId: params.flowId,
                workspaceId: params.workspaceId,
                input: params.input
            })
        }

        const client = await getTemporalClient()
        const taskQueue = getTaskQueue()
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

const createSchedule = async (params: {
    flowId: string
    workspaceId: string
    input: Record<string, any>
}): Promise<CreateScheduleResult> => {
    try {
        const workflow = await getWorkflowById(params.flowId, params.workspaceId)

        const startNode = getStartNodeFromFlowData(workflow.flowData)
        if (!startNode) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'No Start node found in workflow')
        }

        const scheduleInterval = startNode.data.scheduleInterval || '1h'
        const overlapPolicy = startNode.data.overlapPolicy || 'SKIP'
        const catchupWindow = startNode.data.catchupWindow || ''

        parseDurationToMs(scheduleInterval)

        const client = await getTemporalClient()
        const taskQueue = getTaskQueue()
        const scheduleId = `schedule-${params.flowId}-${Date.now()}`

        const scheduleSpec: Record<string, any> = {
            intervals: [{ every: scheduleInterval }]
        }

        const policies: Record<string, any> = {
            overlap: overlapPolicy
        }
        if (catchupWindow) {
            policies.catchupWindow = catchupWindow
        }

        await client.schedule.create({
            scheduleId,
            action: {
                type: 'startWorkflow',
                workflowType: 'durableWorkflowExecutor',
                taskQueue,
                args: [
                    {
                        flowId: params.flowId,
                        workspaceId: params.workspaceId,
                        input: params.input
                    }
                ]
            },
            spec: scheduleSpec,
            policies
        })

        const updatedFlowData = JSON.parse(workflow.flowData)
        const startNodeIndex = updatedFlowData.nodes.findIndex((n: any) => n.type === 'temporalStart')
        if (startNodeIndex !== -1) {
            updatedFlowData.nodes[startNodeIndex].data.scheduleId = scheduleId
        }
        const appServer = getRunningExpressApp()
        workflow.flowData = JSON.stringify(updatedFlowData)
        await appServer.AppDataSource.getRepository(ChatFlow).save(workflow)

        logger.info(`Created Temporal schedule: ${scheduleId} (interval: ${scheduleInterval})`)

        return {
            scheduleId,
            triggerMode: 'scheduled',
            scheduleInterval,
            overlapPolicy,
            temporalUrl: getTemporalWebUIUrl(scheduleId)
        }
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throw new InternalFlowiseError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: temporalService.createSchedule - ${getErrorMessage(error)}`
        )
    }
}

function throwScheduleError(operation: string, scheduleId: string, error: unknown): never {
    const msg = getErrorMessage(error)
    if (msg.toLowerCase().includes('not found') || (error as any)?.statusCode === 404) {
        throw new InternalFlowiseError(StatusCodes.NOT_FOUND, `Schedule ${scheduleId} not found`)
    }
    throw new InternalFlowiseError(StatusCodes.INTERNAL_SERVER_ERROR, `Error: temporalService.${operation} - ${msg}`)
}

const getScheduleDetails = async (scheduleId: string): Promise<ScheduleDetailsResult> => {
    try {
        const client = await getTemporalClient()
        const handle = client.schedule.getHandle(scheduleId)
        const description: any = await handle.describe()

        return {
            scheduleId,
            status: description.status ?? { paused: false, notes: '' },
            spec: description.spec ?? {},
            nextActionTimes: description.info?.nextActionTimes || [],
            recentActions: description.info?.recentActions || [],
            overlapPolicy: description.policy?.overlap || 'SKIP',
            catchupWindow: description.policy?.catchupWindow || ''
        }
    } catch (error) {
        if (error instanceof InternalFlowiseError) throw error
        throwScheduleError('getScheduleDetails', scheduleId, error)
    }
}

const pauseSchedule = async (scheduleId: string, reason?: string): Promise<void> => {
    try {
        const client = await getTemporalClient()
        const handle = client.schedule.getHandle(scheduleId)
        await handle.pause(reason || 'Paused by user')
        logger.info(`Paused Temporal schedule: ${scheduleId}`)
    } catch (error) {
        throwScheduleError('pauseSchedule', scheduleId, error)
    }
}

const unpauseSchedule = async (scheduleId: string): Promise<void> => {
    try {
        const client = await getTemporalClient()
        const handle = client.schedule.getHandle(scheduleId)
        await handle.unpause()
        logger.info(`Unpaused Temporal schedule: ${scheduleId}`)
    } catch (error) {
        throwScheduleError('unpauseSchedule', scheduleId, error)
    }
}

const triggerSchedule = async (scheduleId: string): Promise<void> => {
    try {
        const client = await getTemporalClient()
        const handle = client.schedule.getHandle(scheduleId)
        await handle.trigger()
        logger.info(`Triggered Temporal schedule: ${scheduleId}`)
    } catch (error) {
        throwScheduleError('triggerSchedule', scheduleId, error)
    }
}

const deleteSchedule = async (scheduleId: string): Promise<void> => {
    try {
        const client = await getTemporalClient()
        const handle = client.schedule.getHandle(scheduleId)
        await handle.delete()
        logger.info(`Deleted Temporal schedule: ${scheduleId}`)
    } catch (error) {
        throwScheduleError('deleteSchedule', scheduleId, error)
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
    createSchedule,
    getScheduleDetails,
    pauseSchedule,
    unpauseSchedule,
    triggerSchedule,
    deleteSchedule
}
