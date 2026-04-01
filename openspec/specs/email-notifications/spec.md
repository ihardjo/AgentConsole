## ADDED Requirements

### Requirement: Send Email activity sends SMTP emails

The system SHALL provide a `sendEmail` activity for sending email notifications from workflows.

#### Scenario: Send email with basic fields

-   **WHEN** workflow executes sendEmail activity with `to`, `subject`, and `body` parameters
-   **THEN** system sends email via configured SMTP server
-   **AND** system returns `{ success: true, messageId }` on success

#### Scenario: Send email to multiple recipients

-   **WHEN** workflow executes sendEmail activity with an array of email addresses in `to` field
-   **THEN** system sends email to all recipients

#### Scenario: Send email with custom sender

-   **WHEN** workflow executes sendEmail activity with optional `from` parameter
-   **THEN** system uses the provided sender address instead of the default SMTP_FROM

#### Scenario: Send email fails on invalid SMTP credentials

-   **WHEN** SMTP credentials are invalid (authentication failure)
-   **THEN** system throws non-retryable ApplicationFailure with authentication error message

#### Scenario: Send email retries on connection error

-   **WHEN** SMTP server is temporarily unavailable (connection refused, timeout)
-   **THEN** system throws retryable ApplicationFailure
-   **AND** Temporal retries the activity according to retry policy

#### Scenario: Send email with HTML body

-   **WHEN** workflow executes sendEmail with HTML content in `body` field
-   **THEN** system sends email with HTML content type
