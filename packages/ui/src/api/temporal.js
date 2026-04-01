import client from './client'

const getAllTemporalWorkflows = (params) => client.get('/temporal/workflows', { params })

const getTemporalWorkflow = (id) => client.get(`/temporal/workflows/${id}`)

const createTemporalWorkflow = (body) => client.post('/temporal/workflows', body)

const updateTemporalWorkflow = (id, body) => client.put(`/temporal/workflows/${id}`, body)

const deleteTemporalWorkflow = (id) => client.delete(`/temporal/workflows/${id}`)

const startTemporalWorkflow = (id, body) => client.post(`/temporal/workflows/${id}/start`, body)

// Temporal Execution APIs (operations on running Temporal workflow executions)
// Note: executionId is the Temporal workflow ID (e.g., "durable-uuid-timestamp")
const sendSignal = (executionId, body) => client.post(`/temporal/executions/${executionId}/signal`, body)

const getExecutionStatus = (executionId) => client.get(`/temporal/executions/${executionId}/status`)

const getAgentFlows = () => client.get('/temporal/agentflows')

const getScheduleDetails = (scheduleId) => client.get(`/temporal/schedules/${scheduleId}`)

const pauseSchedule = (scheduleId, body) => client.post(`/temporal/schedules/${scheduleId}/pause`, body)

const unpauseSchedule = (scheduleId) => client.post(`/temporal/schedules/${scheduleId}/unpause`)

const triggerSchedule = (scheduleId) => client.post(`/temporal/schedules/${scheduleId}/trigger`)

const deleteSchedule = (scheduleId) => client.delete(`/temporal/schedules/${scheduleId}`)

export default {
    getAllTemporalWorkflows,
    getTemporalWorkflow,
    createTemporalWorkflow,
    updateTemporalWorkflow,
    deleteTemporalWorkflow,
    startTemporalWorkflow,
    sendSignal,
    getExecutionStatus,
    getAgentFlows,
    getScheduleDetails,
    pauseSchedule,
    unpauseSchedule,
    triggerSchedule,
    deleteSchedule
}
