## Requirements

### Requirement: Application display name is AI Reinvention Engine
The application SHALL display the name **AI Reinvention Engine** on every user-facing surface, including the browser tab title, Open Graph metadata, PWA manifest, logo alt text, embed widget copy, and all server-side configuration defaults.

#### Scenario: Browser tab shows correct title
- **WHEN** a user loads the application in a browser
- **THEN** the browser tab title SHALL read `AI Reinvention Engine`

#### Scenario: PWA install prompt uses correct name
- **WHEN** a user installs the application as a PWA
- **THEN** the installed app name SHALL be `AI Reinvention Engine`

#### Scenario: Logo image has correct alt text
- **WHEN** the application logo is rendered
- **THEN** the `<img>` alt attribute SHALL be `AI Reinvention Engine`

#### Scenario: Embed widget shows correct branding
- **WHEN** a chatflow embed widget is displayed
- **THEN** the widget title SHALL be `AI Reinvention Engine Bot` and company SHALL be `AI Reinvention Engine`

#### Scenario: Fresh server install defaults to correct name
- **WHEN** the server starts for the first time with no existing `platform-config.json`
- **THEN** the application name stored in config SHALL default to `AI Reinvention Engine`

#### Scenario: Client context default is correct
- **WHEN** the UI initialises before receiving a server config response
- **THEN** the `appName` state in `ConfigContext` SHALL default to `AI Reinvention Engine`
