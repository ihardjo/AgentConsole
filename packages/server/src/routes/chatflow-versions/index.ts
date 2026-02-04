import express from 'express'
import chatflowVersionController from '../../controllers/chatflow-versions'
import { checkAnyPermission } from '../../custom-rbac/middleware'

const router = express.Router()

// Get all versions across all chatflows (for agentops dashboard)
router.get('/', checkAnyPermission('agentflows:view,chatflows:view'), chatflowVersionController.getAllVersions)

// Get all versions grouped by chatflow (for agentops dashboard)
router.get('/grouped', checkAnyPermission('agentflows:view,chatflows:view'), chatflowVersionController.getAllVersionsGrouped)

// Get all agentflows for versioning selection dropdown
router.get('/agentflows', checkAnyPermission('agentflows:view'), chatflowVersionController.getAgentflowsForVersioning)

// Get all versions for a specific chatflow
router.get(
    '/chatflow/:chatflowId',
    checkAnyPermission('agentflows:view,chatflows:view'),
    chatflowVersionController.getVersionsByFlowId
)

// Create a new version for a chatflow
router.post(
    '/chatflow/:chatflowId',
    checkAnyPermission('agentflows:create,agentflows:update,chatflows:create,chatflows:update'),
    chatflowVersionController.createVersion
)

// Get a specific version
router.get('/:versionId', checkAnyPermission('agentflows:view,chatflows:view'), chatflowVersionController.getVersionById)

// Restore a version (updates the chatflow's flowData directly)
router.post(
    '/:versionId/restore',
    checkAnyPermission('agentflows:update,chatflows:update'),
    chatflowVersionController.restoreVersion
)

// Delete a version
router.delete('/:versionId', checkAnyPermission('agentflows:delete,chatflows:delete'), chatflowVersionController.deleteVersion)

export default router
