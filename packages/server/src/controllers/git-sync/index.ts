import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { getGitSyncService, getGitSyncConfig, resetGitSync, clearGitSync, getAuthorFromUser, syncDatabaseToLocalGit, syncRemoteGitToDatabase } from '../../services/git-sync'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'

/**
 * GET /api/v1/git-sync/status
 * Returns the current Git working tree status.
 */
const getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const gitService = await getGitSyncService()

        if (!gitService.isEnabled()) {
            return res.json({ success: true, enabled: false, initialized: false, hasRemote: false, lastError: null, lastSyncAt: null, message: 'Git sync is disabled' })
        }

        const status = await gitService.getStatus()

        if (!status) {
            // Enabled but not yet initialised (repo path may not exist / init() hasn't run)
            return res.json({
                success: true,
                enabled: true,
                initialized: false,
                hasRemote: gitService.hasRemote(),
                lastError: gitService.getLastError(),
                lastSyncAt: gitService.getLastSyncAt(),
                message: 'Git sync is enabled but not yet initialized. Check the repo path in Configuration.'
            })
        }

        // Compare local HEAD vs remote tracking branch to detect divergence.
        // Uses the last-known remote ref (from the most recent fetch/pull/push).
        // The user can click Fetch to refresh the remote ref.
        const { localHead, remoteHead, outOfSync } = await gitService.getLocalAndRemoteHeads()

        return res.json({
            success: true,
            enabled: true,
            initialized: true,
            hasRemote: gitService.hasRemote(),
            remoteUrl: gitService.getConfig().remoteUrl || null,
            lastError: gitService.getLastError(),
            lastSyncAt: gitService.getLastSyncAt(),
            hasUncommittedChanges: !status.isClean(),
            conflicted: status.conflicted,
            outOfSync,
            localHead,
            remoteHead,
            data: status
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/v1/git-sync/log?page=1&pageSize=20
 * Returns paginated commit history.
 */
const getLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const gitService = await getGitSyncService()

        if (!gitService.isEnabled()) {
            return res.json({ success: true, enabled: false, data: [] })
        }

        const page = parseInt(req.query.page as string, 10) || 1
        const pageSize = parseInt(req.query.pageSize as string, 10) || 20

        const { entries, totalCount } = await gitService.getLog(page, pageSize)
        return res.json({ success: true, data: entries, total: totalCount })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/v1/git-sync/diff/:commitHash
 * Returns the diff for a specific commit.
 */
const getDiff = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.params.commitHash) {
            throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, 'commitHash is required')
        }

        const gitService = await getGitSyncService()

        if (!gitService.isEnabled()) {
            return res.json({ success: true, enabled: false, data: '' })
        }

        const diff = await gitService.getDiff(req.params.commitHash)
        return res.json({ success: true, data: diff })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/git-sync/push
 * Serialize all local DB versions to files, commit, and push to remote.
 */
const push = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const gitService = await getGitSyncService()

        if (!gitService.isEnabled()) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Git sync is disabled' })
        }

        if (!gitService.isInitialized()) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Git sync is not initialized' })
        }

        const author = getAuthorFromUser(req.user)

        // 1. Serialize all DB versions and commit (does NOT push)
        const result = await syncDatabaseToLocalGit(author)

        // 2. Push to remote
        let pushed = false
        try {
            pushed = await gitService.push()
        } catch (error) {
            // Return a partial-success response: committed but push failed
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: `Committed locally but push failed: ${(error as Error).message}`,
                data: { ...result, pushed: false }
            })
        }

        return res.json({ success: true, data: { ...result, pushed } })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/git-sync/pull
 * Pull latest changes from remote and import them into the local database.
 */
const pull = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const gitService = await getGitSyncService()

        if (!gitService.isEnabled()) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Git sync is disabled' })
        }

        if (!gitService.isInitialized()) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Git sync is not initialized' })
        }

        // Pass the caller's active workspace so newly-created chatflows
        // are assigned to the correct workspace.
        const workspaceId = (req as any).user?.activeWorkspaceId as string | undefined
        const result = await syncRemoteGitToDatabase(workspaceId)
        return res.json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/git-sync/fetch
 * Fetch updates from remote without merging. Updates lastSyncAt timestamp.
 */
const fetchRemote = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const gitService = await getGitSyncService()

        if (!gitService.isEnabled()) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Git sync is disabled' })
        }

        if (!gitService.isInitialized()) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Git sync is not initialized' })
        }

        await gitService.fetch()
        return res.json({ success: true, message: 'Fetched successfully', lastSyncAt: gitService.getLastSyncAt() })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/v1/git-sync/config
 * Returns the current Git Sync configuration (access token masked).
 */
const getConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await getGitSyncConfig()
        return res.json({ success: true, data: config })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/git-sync/config
 * Update Git Sync configuration at runtime and reinitialise the service.
 *
 * Body shape (all fields optional):
 * {
 *   enabled: boolean,
 *   remoteUrl: string,   // required when enabled=true
 *   branch: string,
 *   authMethod: 'token' | 'ssh',
 *   accessToken: string, // send '••••••••' to keep existing value
 *   sshKeyPath: string
 * }
 */
const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body || {}

        // Coerce string booleans from form submissions
        const partial: Record<string, unknown> = {}
        if (body.enabled !== undefined) partial.enabled = body.enabled === true || body.enabled === 'true'
        if (body.remoteUrl !== undefined) partial.remoteUrl = body.remoteUrl
        if (body.branch !== undefined) partial.branch = body.branch
        if (body.authMethod !== undefined) partial.authMethod = body.authMethod
        if (body.accessToken !== undefined) partial.accessToken = body.accessToken
        if (body.sshKeyPath !== undefined) partial.sshKeyPath = body.sshKeyPath

        // Enforce: remote URL is required when enabling
        if (partial.enabled === true && !partial.remoteUrl) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Remote URL is required — local-only mode is not supported'
            })
        }

        await resetGitSync(partial as any)

        const updatedConfig = await getGitSyncConfig()
        const gitService = await getGitSyncService()

        return res.json({
            success: true,
            data: updatedConfig,
            initialized: gitService.isInitialized(),
            hasRemote: gitService.hasRemote(),
            lastError: gitService.getLastError(),
            message: gitService.isInitialized()
                ? 'Git Sync configuration updated'
                : 'Git Sync configuration saved but initialisation failed. Check the server logs for details.'
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/git-sync/disable
 * Disable Git Sync and wipe all persistent config + local git repo.
 */
const disableGitSync = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await clearGitSync()
        return res.json({ success: true, message: 'Git Sync disabled and all configuration cleared' })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/git-sync/test-connection
 * Verify remote connectivity and auth credentials without modifying anything.
 * Accepts the current form config in the request body so the test works
 * against unsaved credentials (before the user hits Save).
 */
const testConnection = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body || {}
        const gitService = await getGitSyncService()

        // If credentials were supplied in the body, test those directly
        // without persisting them. This covers the "test before save" flow.
        if (body.remoteUrl) {
            // Preserve the existing saved access token if the UI sends the
            // masked placeholder ('••••••••') — i.e. it hasn't changed.
            const savedConfig = gitService.getConfig()
            const accessToken =
                body.accessToken && !body.accessToken.includes('•')
                    ? body.accessToken
                    : savedConfig.accessToken

            const result = await gitService.testConnectionWithConfig({
                remoteUrl: body.remoteUrl,
                branch: body.branch || savedConfig.branch,
                authMethod: body.authMethod || savedConfig.authMethod,
                accessToken,
                sshKeyPath: body.sshKeyPath || savedConfig.sshKeyPath
            })
            return res.json({ success: result.ok, error: result.error || null })
        }

        // Fallback: test with whatever is already saved in the service
        const result = await gitService.testConnection()
        return res.json({ success: result.ok, error: result.error || null })
    } catch (error) {
        next(error)
    }
}

export default {
    getConfig,
    updateConfig,
    getStatus,
    getLog,
    getDiff,
    push,
    pull,
    fetch: fetchRemote,
    disable: disableGitSync,
    testConnection
}
