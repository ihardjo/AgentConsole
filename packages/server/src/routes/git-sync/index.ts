import express from 'express'
import gitSyncController from '../../controllers/git-sync'
import { checkAnyPermission } from '../../custom-rbac/middleware'

const router = express.Router()

// Get / update Git sync configuration (runtime, no restart needed)
router.get('/config', checkAnyPermission('agentops:view'), gitSyncController.getConfig)
router.post('/config', checkAnyPermission('agentops:git-sync'), gitSyncController.updateConfig)

// Get git sync status
router.get('/status', checkAnyPermission('agentops:view'), gitSyncController.getStatus)

// Get commit log (paginated)
router.get('/log', checkAnyPermission('agentops:view'), gitSyncController.getLog)

// Get diff for a specific commit
router.get('/diff/:commitHash', checkAnyPermission('agentops:view'), gitSyncController.getDiff)

// Push local commits to remote
router.post('/push', checkAnyPermission('agentops:git-sync'), gitSyncController.push)

// Pull latest changes from remote
router.post('/pull', checkAnyPermission('agentops:git-sync'), gitSyncController.pull)

// Fetch updates from remote (without merging)
router.post('/fetch', checkAnyPermission('agentops:git-sync'), gitSyncController.fetch)

// Disable Git Sync and wipe all persistent config + local repo
router.post('/disable', checkAnyPermission('agentops:git-sync'), gitSyncController.disable)

// Test remote connection / auth
router.post('/test-connection', checkAnyPermission('agentops:git-sync'), gitSyncController.testConnection)

export default router
