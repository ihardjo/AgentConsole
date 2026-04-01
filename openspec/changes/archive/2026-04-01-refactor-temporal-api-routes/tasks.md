## 1. Server Routes

-   [x] 1.1 Update route for list executions: change `/workflows/:flowId/executions` to `/workflows/:id/executions`
-   [x] 1.2 Move get status route: change `/workflows/:workflowId/status` to `/executions/:executionId/status`
-   [x] 1.3 Move send signal route: change `/workflows/:workflowId/signal` to `/executions/:executionId/signal`
-   [x] 1.4 Update query route parameter: change `/executions/:workflowId/query/:queryName` to `/executions/:executionId/query/:queryName`
-   [x] 1.5 Reorder routes to group execution endpoints together with comments

## 2. Server Controller

-   [x] 2.1 Rename `getWorkflowStatus` function to `getExecutionStatus`
-   [x] 2.2 Update `getExecutionStatus`: change `req.params.workflowId` to `req.params.executionId`, update error message to say "Execution ID is required"
-   [x] 2.3 Update `sendSignal`: change `req.params.workflowId` to `req.params.executionId`, update error message to say "Execution ID is required"
-   [x] 2.4 Update `listExecutions`: change `req.params.flowId` to `req.params.id`
-   [x] 2.5 Update `queryExecution`: change `req.params.workflowId` to `req.params.executionId`, update error message to say "Execution ID is required"
-   [x] 2.6 Update controller export: rename `getWorkflowStatus` to `getExecutionStatus`
-   [x] 2.7 Add comment explaining API parameter naming vs service layer naming convention

## 3. UI API Client

-   [x] 3.1 Update `sendSignal` function: change path to `/temporal/executions/${executionId}/signal`, rename parameter to `executionId`
-   [x] 3.2 Rename `getWorkflowStatus` to `getExecutionStatus`: change path to `/temporal/executions/${executionId}/status`, rename parameter to `executionId`
-   [x] 3.3 Update exports: rename `getWorkflowStatus` to `getExecutionStatus`

## 4. Documentation

-   [x] 4.1 Update "Get Workflow Status" section: rename to "Get Execution Status", change path to `/executions/:executionId/status`, update parameter description
-   [x] 4.2 Update "Send Signal" section: change path to `/executions/:executionId/signal`, update parameter description
-   [x] 4.3 Update "List Executions" section: change `:flowId` to `:id` in path and description
-   [x] 4.4 Update "Query Workflow State" section: change `:workflowId` to `:executionId` in path
-   [x] 4.5 Update integration example "Complete Human Task Flow": fix signal URL to use `/executions/`
-   [x] 4.6 Update integration example "Monitor Workflow Status": fix status URL to use `/executions/`, rename function references

## 5. Verification

-   [x] 5.1 Run TypeScript build to verify no type errors
-   [x] 5.2 Verify route definitions compile correctly
-   [x] 5.3 Grep codebase for any remaining references to old routes
