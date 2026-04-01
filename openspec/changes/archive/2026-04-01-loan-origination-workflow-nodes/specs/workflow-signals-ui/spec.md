## REMOVED

This capability has been removed from the change scope.

Signal sending and workflow state viewing are handled by the frontend using the following APIs:

-   `GET /api/v1/temporal/workflows/:flowId/executions` - List executions
-   `GET /api/v1/temporal/workflows/:workflowId/query/getWorkflowState` - Query workflow state
-   `POST /api/v1/temporal/workflows/:workflowId/signal` - Send signal (existing)

See `temporal-api/spec.md` for API specifications.
