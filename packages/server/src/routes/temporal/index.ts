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

// List executions for a workflow definition
router.get('/workflows/:id/executions', temporalController.listExecutions)

// ============================================================================
// Temporal Execution APIs (operations on running Temporal workflow executions)
// Note: :executionId is the Temporal workflow ID (e.g., "durable-uuid-timestamp"),
//       not the workflow definition UUID. The service layer uses "workflowId"
//       to match Temporal SDK terminology.
// ============================================================================
router.get('/executions/:executionId/status', temporalController.getExecutionStatus)
router.post('/executions/:executionId/signal', temporalController.sendSignal)
router.get('/executions/:executionId/query/:queryName', temporalController.queryExecution)

// AgentFlows list for dropdown
router.get('/agentflows', temporalController.getWorkspaceAgentFlows)

// Schedule management
router.get('/schedules/:scheduleId', temporalController.getScheduleDetails)
router.post('/schedules/:scheduleId/pause', temporalController.pauseSchedule)
router.post('/schedules/:scheduleId/unpause', temporalController.unpauseSchedule)
router.post('/schedules/:scheduleId/trigger', temporalController.triggerSchedule)
router.delete('/schedules/:scheduleId', temporalController.deleteSchedule)

export default router
