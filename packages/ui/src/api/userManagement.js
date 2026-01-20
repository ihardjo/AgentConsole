import client from './client'

const getAllUsersByOrganizationId = (organizationId) => client.get(`/user-management?organizationId=${organizationId}`)
const getUserByOrganizationIdUserId = (organizationId, userId) =>
    client.get(`/user-management?organizationId=${organizationId}&userId=${userId}`)
const getUserByRoleId = (roleId) => client.get(`/user-management?roleId=${roleId}`)
const getWorkspacesByOrganizationIdUserId = (organizationId, userId) =>
    client.get(`/user-management/workspaces?organizationId=${organizationId}&userId=${userId}`)
const createOrganizationUser = (body) => client.post(`/user-management`, body)
const updateOrganizationUser = (body) => client.put(`/user-management`, body)
const deleteOrganizationUser = (organizationId, userId) =>
    client.delete(`/user-management?organizationId=${organizationId}&userId=${userId}`)
const deleteWorkspaceUser = (workspaceId, userId, organizationId) =>
    client.delete(`/user-management/workspace?workspaceId=${workspaceId}&userId=${userId}&organizationId=${organizationId}`)

export default {
    getAllUsersByOrganizationId,
    getUserByOrganizationIdUserId,
    getUserByRoleId,
    getWorkspacesByOrganizationIdUserId,
    createOrganizationUser,
    updateOrganizationUser,
    deleteOrganizationUser,
    deleteWorkspaceUser
}
