import client from './client'

const getAllTemporalWorkflows = (params) => client.get('/temporal/workflows', { params })

const getTemporalWorkflow = (id) => client.get(`/temporal/workflows/${id}`)

const createTemporalWorkflow = (body) => client.post('/temporal/workflows', body)

const updateTemporalWorkflow = (id, body) => client.put(`/temporal/workflows/${id}`, body)

const deleteTemporalWorkflow = (id) => client.delete(`/temporal/workflows/${id}`)

const startTemporalWorkflow = (id, body) => client.post(`/temporal/workflows/${id}/start`, body)

const sendSignal = (workflowId, body) => client.post(`/temporal/workflows/${workflowId}/signal`, body)

const getWorkflowStatus = (workflowId) => client.get(`/temporal/workflows/${workflowId}/status`)

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
    getWorkflowStatus,
    getAgentFlows,
    getScheduleDetails,
    pauseSchedule,
    unpauseSchedule,
    triggerSchedule,
    deleteSchedule
}
