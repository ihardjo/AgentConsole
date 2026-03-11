import client from './client'

// ── Configuration ─────────────────────────────────────────────────────────────
// Get current Git Sync configuration (access token masked)
const getConfig = () => client.get('/git-sync/config')

// Save / update Git Sync configuration at runtime
const updateConfig = (data) => client.post('/git-sync/config', data)

// ── Operations ────────────────────────────────────────────────────────────────
// Get Git sync status
const getStatus = () => client.get('/git-sync/status')

// Get Git commit log (paginated)
const getLog = (params) => client.get('/git-sync/log', { params })

// Get diff for a specific commit
const getDiff = (commitHash) => client.get(`/git-sync/diff/${commitHash}`)

// Push local commits to remote
const push = () => client.post('/git-sync/push')

// Pull latest changes from remote
const pull = () => client.post('/git-sync/pull')

// Fetch updates from remote (without merging)
const fetchRemote = () => client.post('/git-sync/fetch')

// Disable Git Sync and wipe all persistent config + local repo
const disable = () => client.post('/git-sync/disable')

// Test remote connection and auth credentials (pass current form data, not saved config)
const testConnection = (data) => client.post('/git-sync/test-connection', data)

export default {
    getConfig,
    updateConfig,
    getStatus,
    getLog,
    getDiff,
    push,
    pull,
    fetch: fetchRemote,
    disable,
    testConnection
}
