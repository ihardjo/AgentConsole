import express from 'express'
import temporalController from '../../controllers/temporal'

const router = express.Router()

// Health check (no auth required for monitoring)
router.get('/health', temporalController.healthCheck)

// Workflow CRUD operations
router.post('/workflows', temporalController.createWorkflow)
router.get('/workflows', temporalController.getAllWorkflows)
router.get('/workflows/:id', temporalController.getWorkflowById)
router.put('/workflows/:id', temporalController.updateWorkflow)
router.delete('/workflows/:id', temporalController.deleteWorkflow)

// Workflow execution control
router.post('/workflows/:id/start', temporalController.startWorkflow)
router.post('/workflows/:workflowId/signal', temporalController.sendSignal)
router.get('/workflows/:workflowId/status', temporalController.getWorkflowStatus)

// AgentFlows list for dropdown
router.get('/agentflows', temporalController.getWorkspaceAgentFlows)

export default router
