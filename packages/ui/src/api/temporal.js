import client from './client'

// Temporal Workflow CRUD operations
const getAllTemporalWorkflows = (params) => client.get('/temporal/workflows', { params })

const getTemporalWorkflow = (id) => client.get(`/temporal/workflows/${id}`)

const createTemporalWorkflow = (body) => client.post('/temporal/workflows', body)

const updateTemporalWorkflow = (id, body) => client.put(`/temporal/workflows/${id}`, body)

const deleteTemporalWorkflow = (id) => client.delete(`/temporal/workflows/${id}`)

// Workflow execution operations
const startTemporalWorkflow = (id, body) => client.post(`/temporal/workflows/${id}/start`, body)

const sendSignal = (workflowId, body) => client.post(`/temporal/workflows/${workflowId}/signal`, body)

const getWorkflowStatus = (workflowId) => client.get(`/temporal/workflows/${workflowId}/status`)

// Get AgentFlows for dropdown (workspace-scoped)
const getAgentFlows = () => client.get('/temporal/agentflows')

export default {
    getAllTemporalWorkflows,
    getTemporalWorkflow,
    createTemporalWorkflow,
    updateTemporalWorkflow,
    deleteTemporalWorkflow,
    startTemporalWorkflow,
    sendSignal,
    getWorkflowStatus,
    getAgentFlows
}
