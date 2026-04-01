import express from 'express'
import temporalController from '../../controllers/temporal'

const router = express.Router()

// Health check (no auth required for monitoring)
router.get('/health', temporalController.healthCheck)

// Workflow CRUD operations (workflow definitions)
router.post('/workflows', temporalController.createWorkflow)
router.get('/workflows', temporalController.getAllWorkflows)
router.get('/workflows/:id', temporalController.getWorkflowById)
router.put('/workflows/:id', temporalController.updateWorkflow)
router.delete('/workflows/:id', temporalController.deleteWorkflow)

// Workflow execution control
router.post('/workflows/:id/start', temporalController.startWorkflow)
router.post('/workflows/:workflowId/signal', temporalController.sendSignal)
router.get('/workflows/:workflowId/status', temporalController.getWorkflowStatus)

// List executions for a workflow definition
router.get('/workflows/:flowId/executions', temporalController.listExecutions)

// Query a specific Temporal execution's state
// Note: Uses /executions path to distinguish from workflow definitions
router.get('/executions/:workflowId/query/:queryName', temporalController.queryExecution)

// AgentFlows list for dropdown
router.get('/agentflows', temporalController.getWorkspaceAgentFlows)

// Schedule management
router.get('/schedules/:scheduleId', temporalController.getScheduleDetails)
router.post('/schedules/:scheduleId/pause', temporalController.pauseSchedule)
router.post('/schedules/:scheduleId/unpause', temporalController.unpauseSchedule)
router.post('/schedules/:scheduleId/trigger', temporalController.triggerSchedule)
router.delete('/schedules/:scheduleId', temporalController.deleteSchedule)

export default router
