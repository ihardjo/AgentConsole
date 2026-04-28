## MODIFIED Requirements

### Requirement: Canvas registers Loop node type

The system SHALL register Loop node type in the React Flow node types map.

#### Scenario: Loop node type registered

-   WHEN TemporalCanvas renders
-   THEN system includes `temporalLoop: LoopNode` in the nodeTypes object
-   AND Loop nodes can be rendered on the canvas

### Requirement: Canvas renders dashed edges for loops

The system SHALL render edges with dashed style when marked as loop edges.

#### Scenario: Dashed edge rendering

-   GIVEN an edge has data.isLoopEdge === true
-   WHEN edge renders
-   THEN edge uses strokeDasharray="5,5"
-   AND edge stroke color is brown (#795548)

#### Scenario: Normal edge rendering unchanged

-   GIVEN an edge does not have data.isLoopEdge set
-   WHEN edge renders
-   THEN edge uses default solid style

### Requirement: Canvas uses env var for Temporal URL

The system SHALL use the `VITE_TEMPORAL_WEB_UI_URL` environment variable for Temporal UI links.

#### Scenario: Open Temporal UI with env var URL

-   GIVEN `VITE_TEMPORAL_WEB_UI_URL` is set to "http://temporal:8080"
-   WHEN user clicks "Open in Temporal" button
-   THEN system opens "http://temporal:8080" in new tab

#### Scenario: Open Temporal UI with default URL

-   GIVEN `VITE_TEMPORAL_WEB_UI_URL` is not set
-   WHEN user clicks "Open in Temporal" button
-   THEN system opens "http://localhost:8080" in new tab

### Requirement: Canvas marks loop edges on connection

The system SHALL automatically mark edges as loop edges when appropriate.

#### Scenario: Edge connecting to Loop node marked as loop edge

-   GIVEN user connects an edge TO a Loop node
-   WHEN the edge is created
-   THEN edge data includes isLoopEdge: true
