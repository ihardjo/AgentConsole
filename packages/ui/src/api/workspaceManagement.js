import client from './client'

const getAllWorkspacesByOrganizationId = (organizationId) => client.get(`/workspace-management?organizationId=${organizationId}`)
const getWorkspaceById = (id) => client.get(`/workspace-management?id=${id}`)
const createWorkspace = (body) => client.post(`/workspace-management`, body)
const updateWorkspace = (body) => client.put(`/workspace-management`, body)
const deleteWorkspace = (id, organizationId) => client.delete(`/workspace-management?id=${id}&organizationId=${organizationId}`)
const getAllUsersByWorkspaceId = (workspaceId) => client.get(`/workspace-management/users/${workspaceId}`)
const updateWorkspaceUserRole = (body) => client.put(`/workspace-management/users`, body)
const switchWorkspace = (workspaceId) => client.post(`/workspace-management/switch/${workspaceId}`)

export default {
    getAllWorkspacesByOrganizationId,
    getWorkspaceById,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    getAllUsersByWorkspaceId,
    updateWorkspaceUserRole,
    switchWorkspace
}
