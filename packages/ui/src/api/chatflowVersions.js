import client from './client'

// Get all versions across all chatflows (for agentops dashboard)
const getAllVersions = (params) => client.get('/chatflow-versions', { params })

// Get all versions grouped by chatflow (for agentops dashboard)
const getAllVersionsGrouped = (params) => client.get('/chatflow-versions/grouped', { params })

// Get all agentflows for versioning selection dropdown
const getAgentflowsForVersioning = () => client.get('/chatflow-versions/agentflows')

// Get all versions for a specific chatflow
const getVersionsByFlowId = (chatflowId, params) => client.get(`/chatflow-versions/chatflow/${chatflowId}`, { params })

// Get a specific version by ID
const getVersionById = (versionId) => client.get(`/chatflow-versions/${versionId}`)

// Create a new version for a specific chatflow
// If flowData is not provided in body, it will use the current flowData from the chatflow
const createVersion = (chatflowId, body) => client.post(`/chatflow-versions/chatflow/${chatflowId}`, body)

// Update a version's description
const updateVersion = (versionId, body) => client.patch(`/chatflow-versions/${versionId}`, body)

// Restore a version (updates the chatflow's flowData directly)
const restoreVersion = (versionId) => client.post(`/chatflow-versions/${versionId}/restore`)

// Delete a version
const deleteVersion = (versionId) => client.delete(`/chatflow-versions/${versionId}`)

export default {
    getAllVersions,
    getAllVersionsGrouped,
    getAgentflowsForVersioning,
    getVersionsByFlowId,
    getVersionById,
    createVersion,
    updateVersion,
    restoreVersion,
    deleteVersion
}
