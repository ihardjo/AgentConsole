## Context

The Temporal Workflow Canvas feature was recently implemented with REST APIs for managing workflow definitions and executions. During documentation review, inconsistencies were identified in the API route structure:

1. **Semantic confusion**: Routes like `GET /workflows/:workflowId/status` suggest they operate on workflow definitions, but `:workflowId` is actually a Temporal execution ID (e.g., `durable-uuid-timestamp`)
2. **Inconsistent parameter naming**: Some routes use `:workflowId`, others use `:flowId`, others use `:id` for the same concept
3. **Mixed resource paths**: Execution-related operations (status, signal) are under `/workflows` but should logically be under `/executions`

The codebase already has a partial separation with `GET /executions/:workflowId/query/:queryName`, but this inconsistency makes the API harder to understand.

## Goals / Non-Goals

**Goals:**

-   Clear semantic separation between workflow definitions (canvas configs stored in DB) and workflow executions (Temporal runtime instances)
-   Consistent parameter naming: `:id` for definitions, `:executionId` for Temporal executions
-   All execution-related endpoints grouped under `/executions` path
-   Controller and UI API function names that reflect their actual purpose
-   Updated documentation matching the new route structure

**Non-Goals:**

-   Changing the service layer interface (it should continue to use `workflowId` since that's Temporal SDK terminology)
-   Modifying the demo app (`loan-origination-demo-main/`) - it's a separate project
-   Adding new functionality - this is purely a refactoring change
-   Backward compatibility routes (the affected functions are not in production use)

## Decisions

### Decision 1: Move execution endpoints to `/executions` path

**Choice**: Group all execution-related endpoints under `/executions/:executionId`

**Rationale**:

-   Matches the existing `/executions/:workflowId/query/:queryName` pattern
-   Clear distinction: `/workflows` = definitions, `/executions` = Temporal runs
-   RESTful resource grouping

**Alternatives considered**:

-   Keep as-is with better documentation: Rejected because the naming would still be confusing
-   Use `/workflows/:id/executions/:executionId/status`: Rejected as overly verbose and the execution ID already contains the flow reference

### Decision 2: Standardize parameter naming

**Choice**: Use `:id` for workflow definitions, `:executionId` for Temporal executions

**Rationale**:

-   `:id` is already used consistently for definition CRUD (`GET/PUT/DELETE /workflows/:id`)
-   `:executionId` is explicit about what it represents
-   Avoids confusion with Temporal's `workflowId` terminology at the API layer

**Alternatives considered**:

-   Use `:workflowId` everywhere: Rejected because it's ambiguous between definition and execution
-   Use `:flowId` for definitions: Rejected because `:id` is already the convention in existing routes

### Decision 3: Keep service layer parameter names unchanged

**Choice**: Service functions continue to use `workflowId` parameter name

**Rationale**:

-   Temporal SDK uses `workflowId` terminology
-   Service is internal; controllers translate `executionId` → `workflowId`
-   Avoids cascading changes through the service layer
-   Makes the service layer portable/reusable with Temporal conventions

**Mapping**:

```
API Layer          → Controller        → Service Layer     → Temporal SDK
:executionId       → executionId       → workflowId        → workflowId
```

### Decision 4: Rename `getWorkflowStatus` to `getExecutionStatus`

**Choice**: Rename the controller function and UI API function

**Rationale**:

-   Reflects the actual purpose - getting execution status, not workflow definition status
-   Consistent with the new `/executions` path
-   No breaking changes since the function is not currently used in UI components

## Risks / Trade-offs

**[Risk] Documentation/examples in external systems may reference old routes**
→ Mitigation: This is a new feature not yet in production. Demo app is explicitly out of scope.

**[Risk] Future developers might be confused by different terminology between API and service layers**
→ Mitigation: Add code comments explaining the mapping. The service layer uses Temporal SDK conventions intentionally.

**[Trade-off] More changes than strictly necessary (renaming functions)**
→ Accepted because semantic clarity is worth the additional refactoring effort, especially while the code is new.
