# Git Sync — Architecture & Multi-Instance Sync

## Overview

Git Sync serialises every **chatflow / agentflow version** to a local Git repository and optionally pushes it to a remote (GitHub, GitLab, Bitbucket, self-hosted). This enables:

- **Audit trail** — every version save is a Git commit attributed to the logged-in user.
- **Multi-instance sync** — multiple Agent Console instances share the same remote repository.
- **Disaster recovery** — versions can be restored from Git even if the database is lost.

---

## File Layout

```
packages/server/src/services/git-sync/
├── GitSyncService.ts      # Core service — init, commit, push, pull, mutex
├── GitFileSerializer.ts   # Serialises entities to JSON files in the repo
├── index.ts               # Singleton management, syncDatabaseToLocalGit / syncRemoteGitToDatabase orchestration
└── GIT-SYNC.md            # This document

packages/server/src/controllers/git-sync/
└── index.ts               # Express handlers for all /api/v1/git-sync/* endpoints

packages/server/src/routes/git-sync/
└── index.ts               # Route definitions + RBAC middleware

packages/ui/src/api/
└── gitSync.js             # Axios API client

packages/ui/src/views/agentops/
├── GitSyncPanel.jsx       # Configuration + Activity tabs (commit log, push/pull, etc.)
└── index.jsx              # Status badge integration (green/orange/red/grey)
```

---

## Repository Structure (on disk)

```
~/.flowise/chatflow-versions/      (or GIT_SYNC_REPO_PATH env var)
├── .git/
├── .gitignore
├── chatflows/
│   └── <chatflowId>/
│       ├── _meta.json              # { id, name, type, updatedDate }
│       ├── version_1.json
│       ├── version_2.json
│       └── ...
└── agentflows/
    └── <agentflowId>/
        ├── _meta.json
        ├── version_1.json
        └── ...
```

Each `version_N.json` contains:
```json
{
  "id": "uuid",
  "chatFlowId": "uuid",
  "version": 1,
  "flowData": "{ ... JSON string of the flow graph ... }",
  "changeDescription": "Updated prompt template",
  "createdBy": "user@example.com",
  "createdDate": "2026-01-15T10:30:00.000Z",
  "updatedDate": "2026-01-15T10:30:00.000Z"
}
```

---

## Configuration

Git Sync is configured exclusively through the **Agent Ops UI** (Configuration tab). Settings are persisted to an encrypted config file on disk (`<storageDir>/git-sync-config.json`) — sensitive fields (`accessToken`, `sshKeyPath`) are AES-encrypted at rest.

> **No environment variables are used for git sync config.** This prevents credentials from leaking into process listings, container env dumps, or log output.

| Setting | Default | Description |
|---|---|---|
| Enabled | `false` | Enable/disable Git Sync |
| Remote URL | (empty) | Remote repository URL |
| Branch | `main` | Branch to use |
| Auth Method | `token` | `token` or `ssh` |
| Access Token | (empty) | Personal access token (GitHub/GitLab/Bitbucket) — encrypted at rest |
| SSH Key Path | (empty) | Absolute path to SSH private key — encrypted at rest |
| Auto Push | `false` | Push immediately after every commit |
| Push Max Retries | `3` | Max retry attempts with exponential backoff |

The only infrastructure-level env var that remains is `GIT_SYNC_REPO_PATH` (local repo directory path, no credentials), which defaults to `~/.flowise/chatflow-versions`.

---

## API Endpoints

| Method | Path | RBAC | Description |
|---|---|---|---|
| GET | `/api/v1/git-sync/status` | `agentops:view` | Repo status (enabled, initialized, hasRemote, lastError) |
| GET | `/api/v1/git-sync/config` | `agentops:view` | Current config (token masked) |
| POST | `/api/v1/git-sync/config` | `agentops:git-sync` | Update config at runtime |
| GET | `/api/v1/git-sync/log` | `agentops:view` | Paginated commit log |
| GET | `/api/v1/git-sync/diff/:hash` | `agentops:view` | Diff for a commit |
| POST | `/api/v1/git-sync/push` | `agentops:git-sync` | Serialize DB versions → commit → push to remote |
| POST | `/api/v1/git-sync/pull` | `agentops:git-sync` | Pull from remote → import versions into DB |
| POST | `/api/v1/git-sync/test-connection` | `agentops:git-sync` | Verify remote + auth |

---

## Multi-Instance Sync

### Architecture

```
┌────────────────────┐     ┌────────────────────┐
│  Instance A        │     │  Instance B        │
│  (Production)      │     │  (Staging)         │
│                    │     │                    │
│  DB ──► Serializer │     │  DB ──► Serializer │
│         ↓         │     │         ↓         │
│  Local Git Repo    │     │  Local Git Repo    │
│    ↕ push/pull     │     │    ↕ push/pull     │
└────────┬───────────┘     └────────┬───────────┘
         │                          │
         └──────┐     ┌─────────────┘
                ↓     ↓
         ┌──────────────────┐
         │  Remote Git Repo │
         │  (GitHub/GitLab) │
         └──────────────────┘
```

### How it works

1. **Each instance** has its own local Git repo (default `~/.flowise/chatflow-versions`, override with `GIT_SYNC_REPO_PATH`).
2. **All instances** point to the **same remote repository** configured via the UI.
3. **On version save** (create/update/delete), the instance:
   - Serialises the version to `<entityType>/<id>/version_N.json`
   - Commits with a structured message attributed to the user
   - If **Auto Push** is enabled, pushes to remote automatically
4. **On push failure** (non-fast-forward), the service:
   - Detects the rejection
   - Pulls remote changes (merge strategy, no rebase)
   - Retries the push (up to `pushMaxRetries` times)
5. **On pull**, the merge strategy (`--no-rebase`) is used, which:
   - Fast-forwards if possible (no divergence)
   - Creates a merge commit if branches have diverged
   - Fails with `CONFLICTS` only if the exact same file was modified differently

### Conflict avoidance

Conflicts are structurally rare because:

- **File paths are UUID-namespaced**: `chatflows/<chatflowId>/version_<N>.json`
- Two instances would only conflict if they modified the **exact same version of the exact same chatflow** between syncs
- Version numbers are auto-incremented per chatflow, so new versions get unique file names

### Syncing between instances

**Scenario: Promote staging → production**

```
On staging instance:
  1. Click "Push to Git" (syncs all DB versions → Git → remote)

On production instance:
  2. Click "Pull from Git" (pulls remote → local repo → imports to DB)
```

**Scenario: Initial setup of a new instance**

```
On new instance:
  1. Configure Git Sync with the same remote URL
  2. Click "Pull from Git" to import all versions from the shared repo
```

### What gets synced

| Synced | Not synced |
|---|---|
| Version flow data (nodes, edges) | Database IDs (auto-generated locally) |
| Version metadata (number, description) | API configs / secrets |
| Chatflow metadata (name, type) | Chatbot widget configs |
| Change descriptions | Credentials |
| User attribution | Execution logs |

---

## Concurrency & Safety

### Operation Mutex

All git operations (commit, push, pull) are serialised through a promise-based mutex (`runExclusive`). This prevents:

- **Index corruption** from concurrent `git add` / `git commit`
- **Race conditions** between auto-push and manual push
- **Deadlocks** from nested push (e.g., commit → auto-push → non-ff → pull)

The mutex is lightweight (no external dependency) and uses promise chaining:

```typescript
private opLock: Promise<void> = Promise.resolve()

private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.opLock
    let resolve!: () => void
    this.opLock = new Promise<void>((r) => { resolve = r })
    return prev.then(fn).finally(resolve)
}
```

### Internal vs External push

- `push()` (public) — acquires the mutex, then calls `_pushInternal()`
- `_pushInternal()` (private) — does the actual push with retry logic
- `commit()` calls `_pushInternal()` directly (already inside the mutex)
- This prevents a deadlock where commit → push → mutex wait → never resolves

### Pull reconciliation

Git 2.27+ requires an explicit reconciliation strategy. We use:

- `pull.rebase = false` in `.git/config` (set during `init()`)
- `--no-rebase` flag on every `pull()` call (belt-and-suspenders)

This means divergent branches are reconciled via **merge commits**, which is the safest strategy for automated sync — it never loses data.

---

## Authentication

### Token (HTTPS)

The token is injected into the remote URL:
```
https://x-access-token:<token>@github.com/org/repo.git
```

Works with:
- **GitHub** PATs (classic & fine-grained)
- **GitLab** personal/project access tokens
- **Bitbucket** app passwords

### SSH

The SSH key path (configured via the UI) is injected as `GIT_SSH_COMMAND` on the `simple-git` instance:
```
ssh -i "/path/to/key" -o StrictHostKeyChecking=accept-new
```

This is scoped to the `simple-git` process only — it does not affect the system-wide SSH config.

### Security notes

- Tokens are stored **in memory only** (process.env) — never persisted to the database
- The `/config` GET endpoint returns tokens as `••••••••`
- The `testConnection` endpoint strips tokens from error messages before returning
- Tokens in the authenticated URL are never logged

---

## Error Handling

### Error lifecycle

1. Any operation failure sets `this.lastError` on the service
2. The status API always returns `lastError`
3. The UI shows a red error Alert on the Activity tab
4. The header badge turns red when `lastError` is set
5. Successful operations clear `lastError`

### Specific error handling

| Error | Cause | Resolution |
|---|---|---|
| `Need to specify how to reconcile divergent branches` | Git 2.27+ without pull strategy | Fixed — `--no-rebase` flag |
| `non-fast-forward` on push | Remote has newer commits | Auto-pull before retry |
| `Authentication failed` | Bad token / expired | User fixes in Configuration tab |
| `Could not resolve host` | Network / DNS issue | Retry or check URL |
| `CONFLICTS` on pull | Same file modified differently | Manual resolution needed |

---

## Status Indicator (UI)

The header badge uses 4 states:

| Badge | Chip Label | Condition |
|---|---|---|
| 🟢 Green | Active | enabled + initialized + hasRemote + no error + local HEAD = remote HEAD |
| 🟠 Orange | Out of Sync | enabled + initialized + hasRemote + local HEAD ≠ remote HEAD (after fetch) |
| 🔴 Red | Error | any `lastError` is set |
| ⚪ Grey | Inactive | disabled or not initialized |

The `outOfSync` flag is computed by comparing `git rev-parse HEAD` against `git rev-parse origin/<branch>`. A **Fetch** updates the remote tracking ref so the comparison reflects the latest remote state.
