## MODIFIED Requirements

### Requirement: API provides CRUD operations for Temporal workflows

The system SHALL provide REST endpoints for creating, reading, updating, and deleting Temporal workflow definitions.

#### Scenario: Create workflow

-   **WHEN** client sends `POST /api/v1/temporal/workflows` with name and flowData
-   **THEN** system creates a new workflow record with `type: 'TEMPORAL'` and returns the workflow ID

#### Scenario: Get workflow by ID

-   **WHEN** client sends `GET /api/v1/temporal/workflows/:id`
-   **THEN** system returns the workflow definition including flowData

#### Scenario: Update workflow

-   **WHEN** client sends `PUT /api/v1/temporal/workflows/:id` with updated flowData
-   **THEN** system updates the workflow record and returns success

#### Scenario: Delete workflow

-   **WHEN** client sends `DELETE /api/v1/temporal/workflows/:id`
-   **THEN** system deletes the workflow record and returns success

#### Scenario: List workflows (paginated)

-   **WHEN** client sends `GET /api/v1/temporal/workflows` with optional `page`, `limit`, and `search` query parameters
-   **THEN** system returns `{ data: ChatFlow[], total: number }` with workflows filtered by workspace, ordered by `updatedDate DESC`, and optionally filtered by name search

#### Scenario: List workflows without pagination

-   **WHEN** client sends `GET /api/v1/temporal/workflows` without `page` and `limit` query parameters
-   **THEN** system returns all Temporal workflows in the current workspace as a flat array
