import client from './client'

const getAllRolesByOrganizationId = (organizationId) => client.get(`/role-management?organizationId=${organizationId}`)
const getRoleById = (id) => client.get(`/role-management?id=${id}`)
const createRole = (body) => client.post(`/role-management`, body)
const updateRole = (body) => client.put(`/role-management`, body)
const deleteRole = (id, organizationId) => client.delete(`/role-management?id=${id}&organizationId=${organizationId}`)

export default {
    getAllRolesByOrganizationId,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
}
