import express from 'express'
import roleManagementController from '../../custom-rbac/controllers/role-management'
import { checkPermission } from '../../custom-rbac/middleware'

const router = express.Router()

router.get('/', checkPermission('roles:manage'), roleManagementController.readRole)

router.post('/', checkPermission('roles:manage'), roleManagementController.createRole)

router.put('/', checkPermission('roles:manage'), roleManagementController.updateRole)

router.delete('/', checkPermission('roles:manage'), roleManagementController.deleteRole)

export default router
