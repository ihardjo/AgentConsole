import express from 'express'
import chatflowVersionController from '../../controllers/chatflow-versions'
import { checkAnyPermission } from '../../custom-rbac/middleware'

const router = express.Router()

// Get all versions across all chatflows (for agentops dashboard)
router.get('/', checkAnyPermission('agentops:view'), chatflowVersionController.getAllVersions)

// Get all versions grouped by chatflow (for agentops dashboard)
router.get('/grouped', checkAnyPermission('agentops:view'), chatflowVersionController.getAllVersionsGrouped)

// Get all agentflows for versioning selection dropdown
router.get('/agentflows', checkAnyPermission('agentops:view,agentops:create'), chatflowVersionController.getAgentflowsForVersioning)

// Compare two versions (must be before /:versionId to avoid route conflict)
router.get('/compare/:versionIdA/:versionIdB', checkAnyPermission('agentops:view'), chatflowVersionController.compareVersions)

// Compare a saved version against the live active flow
router.get('/compare/:versionId/active/:chatflowId', checkAnyPermission('agentops:view'), chatflowVersionController.compareVersionWithActive)

// Get all versions for a specific chatflow
router.get(
    '/chatflow/:chatflowId',
    checkAnyPermission('agentops:view'),
    chatflowVersionController.getVersionsByFlowId
)

// Create a new version for a chatflow
router.post(
    '/chatflow/:chatflowId',
    checkAnyPermission('agentops:create'),
    chatflowVersionController.createVersion
)

// Get a specific version
router.get('/:versionId', checkAnyPermission('agentops:view'), chatflowVersionController.getVersionById)

// Update a version's description
router.patch(
    '/:versionId',
    checkAnyPermission('agentops:update'),
    chatflowVersionController.updateVersion
)

// Restore a version (updates the chatflow's flowData directly)
router.post(
    '/:versionId/restore',
    checkAnyPermission('agentops:restore'),
    chatflowVersionController.restoreVersion
)

// Delete a version
router.delete('/:versionId', checkAnyPermission('agentops:delete'), chatflowVersionController.deleteVersion)

export default router
