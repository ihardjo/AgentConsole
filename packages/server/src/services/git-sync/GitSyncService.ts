import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import logger from '../../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base directory under which each workspace gets its own git repository.
 * Layout:  ~/.flowise/git-sync/<workspaceId>/
 */
const gitSyncBaseDir: string = path.join(os.homedir(), '.flowise', 'git-sync')

/**
 * Return the git repo path for a specific workspace.
 */
export function getWorkspaceRepoPath(workspaceId: string): string {
    return path.join(gitSyncBaseDir, workspaceId)
}

/**
 * Standard pull flags used in every pull / merge operation.
 * Centralised so changes propagate to all callers automatically.
 */
const PULL_OPTIONS = {
    '--no-rebase': null,
    '--tags': null,
    '--allow-unrelated-histories': null
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GitSyncConfig {
    enabled: boolean
    remoteUrl: string
    branch: string
    authMethod: 'token' | 'ssh'
    accessToken: string
    sshKeyPath: string
}

export interface GitAuthor {
    name: string
    email: string
}

export interface GitCommitResult {
    commitHash: string
    message: string
    timestamp: string
    author: GitAuthor
}

export interface GitLogEntry {
    hash: string
    date: string
    message: string
    author_name: string
    author_email: string
    refs: string[]   // e.g. ['HEAD', 'main', 'origin/main', 'tag: v1.0']
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export class GitSyncService {
    private git: SimpleGit | null = null
    private config: GitSyncConfig
    private readonly repoPath: string
    private initialized = false
    private lastError: string | null = null
    /** Timestamp of the last successful push, pull, or fetch. */
    private lastSyncAt: string | null = null
    /** Serialise all git operations to prevent concurrent corruption. */
    private opLock: Promise<void> = Promise.resolve()

    constructor(config: GitSyncConfig, repoPath: string) {
        this.config = config
        this.repoPath = repoPath
        // NOTE: simpleGit is NOT created here — the repo directory may not exist yet.
        // It is created lazily in getGit() after the directory is guaranteed to exist.
    }

    /**
     * Serialise a callback so only one git operation runs at a time.
     * Prevents concurrent push/pull/commit from corrupting the index.
     */
    private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
        const prev = this.opLock
        let resolve!: () => void
        this.opLock = new Promise<void>((r) => { resolve = r })
        return prev.then(fn).finally(resolve)
    }

    /**
     * Check the working tree for unresolved conflicts after a merge/pull.
     * Throws with a `CONFLICTS: <files>` prefix when conflicts are found so
     * callers can distinguish conflict errors from general failures.
     */
    private async assertNoConflicts(git: SimpleGit): Promise<void> {
        const status = await git.status()
        if (status.conflicted.length > 0) {
            const conflictList = status.conflicted.join(', ')
            this.lastError = `CONFLICTS: ${conflictList}`
            logger.error(`[GitSync] Conflicts detected: ${conflictList}`)
            throw new Error(this.lastError)
        }
    }

    /**
     * Build a GitCommitResult from a simple-git commit response.
     */
    private buildCommitResult(
        raw: { commit?: string },
        message: string,
        author: GitAuthor
    ): GitCommitResult {
        return {
            commitHash: raw.commit || '',
            message,
            timestamp: new Date().toISOString(),
            author
        }
    }

    /**
     * Returns the SimpleGit instance, creating it if needed.
     * Ensures the repo directory exists before constructing the instance
     * (simple-git validates the baseDir on construction).
     */
    private getGit(): SimpleGit {
        if (!this.git) {
            // Ensure directory exists — simple-git throws if it doesn't
            if (!fs.existsSync(this.repoPath)) {
                fs.mkdirSync(this.repoPath, { recursive: true })
            }

            // Build env vars — wire SSH key if configured
            const env: Record<string, string> = {}
            if (this.config.authMethod === 'ssh' && this.config.sshKeyPath) {
                env.GIT_SSH_COMMAND = `ssh -i "${this.config.sshKeyPath}" -o StrictHostKeyChecking=accept-new`
            }

            this.git = simpleGit({
                baseDir: this.repoPath,
                binary: 'git',
                maxConcurrentProcesses: 1,
                ...(Object.keys(env).length > 0 ? { env } : {})
            } as any)
        }
        return this.git
    }

    // ─── Initialization ────────────────────────────────────────────────

    /**
     * Initialize the Git repository.
     * - Creates the repo directory if it doesn't exist.
     * - Runs `git init` if no .git folder is found.
     * - Configures remote if GIT_REMOTE_URL is set.
     * - Checks out the configured branch.
     */
    async init(): Promise<void> {
        if (!this.config.enabled) {
            logger.debug('[GitSync] Git sync is disabled')
            return
        }

        if (!this.config.remoteUrl) {
            this.lastError = 'Remote URL is required — local-only mode is not supported'
            logger.error('[GitSync] Init failed: no remote URL configured')
            throw new Error(this.lastError)
        }

        try {
            // Ensure repo directory exists BEFORE creating the SimpleGit instance.
            // simple-git validates the baseDir on construction, so this must come first.
            if (!fs.existsSync(this.repoPath)) {
                fs.mkdirSync(this.repoPath, { recursive: true })
                logger.info(`[GitSync] Created repo directory: ${this.repoPath}`)
            }

            // Force re-creation of the SimpleGit instance so getGit() picks
            // up the (now-existent) directory AND wires SSH env vars correctly.
            this.git = null
            const git = this.getGit()

            // Check if already a git repo
            const gitDir = path.join(this.repoPath, '.git')
            if (!fs.existsSync(gitDir)) {
                await git.init()
                logger.info(`[GitSync] Initialized new Git repository at ${this.repoPath}`)

                // Pin the repo-local committer identity so commits are fully
                // attributed to the system bot regardless of the global
                // ~/.gitconfig on the host machine.
                await git.addConfig('user.name', 'Agent Console Bot')
                await git.addConfig('user.email', 'agentconsole@system')

                // ── Bootstrap from remote ───────────────────────────────────
                // Before making any local commit, try to pull existing remote
                // history.  If the remote already has content the local branch
                // is bootstrapped from it (avoids an unrelated-histories merge
                // later and, crucially, avoids an empty placeholder commit when
                // the DB is also empty).
                //
                // We intentionally do NOT create the empty "[AgentOps] Initial
                // repo setup" commit here.  That commit was the source of merge
                // conflicts when the remote already had data.  Instead:
                //   • If the remote has commits → we pull them; branch is born.
                //   • If the remote is empty / branch doesn't exist yet →
                //     the pull will fail (quietly); the branch stays "unborn"
                //     and the first real data commit in commitThenMergeRemote
                //     will create it.
                const remoteUrl = this.getAuthenticatedUrl()
                try {
                    await git.remote(['add', 'origin', remoteUrl])
                    await git.addConfig('pull.rebase', 'false')
                    // Fetch ALL branches+tags and prune stale refs — consistent with
                    // the standalone fetch() method so tracking refs are complete.
                    await git.fetch(['origin', '--tags', '--prune'])
                    // Check whether the remote branch actually exists
                    const remoteRefs = await git.listRemote(['--heads', remoteUrl])
                    const remoteBranchExists = remoteRefs.includes(`refs/heads/${this.config.branch}`)
                    if (remoteBranchExists) {
                        await git.checkout(['-b', this.config.branch, `origin/${this.config.branch}`])
                        this.lastSyncAt = new Date().toISOString()
                        logger.info(`[GitSync] Bootstrapped local repo from remote branch '${this.config.branch}'`)
                    } else {
                        // Remote exists but branch doesn't yet — create the local branch
                        await git.checkoutLocalBranch(this.config.branch)
                        logger.info(`[GitSync] Remote branch '${this.config.branch}' not found — will push on first commit`)
                    }
                    // Remote is already configured — skip the configure-remote block below
                    this.initialized = true
                    this.lastError = null
                    logger.info(`[GitSync] Ready on branch '${this.config.branch}'`)
                    return
                } catch (bootstrapError) {
                    // Network / auth failure during bootstrap — fall through to
                    // the standard configure-remote path below and let the caller
                    // surface the error through the normal push/pull cycle.
                    logger.warn(`[GitSync] Remote bootstrap failed (continuing): ${bootstrapError}`)
                    // Ensure we still have a local branch to work on
                    try {
                        await git.checkoutLocalBranch(this.config.branch)
                    } catch {
                        // Branch may already exist if fetch partially succeeded
                    }
                }
            }

            // Configure remote (required — local-only mode is not supported)
            const remotes = await git.getRemotes()
            const originExists = remotes.some((r: { name: string }) => r.name === 'origin')

            if (originExists) {
                await git.remote(['set-url', 'origin', this.getAuthenticatedUrl()])
            } else {
                await git.addRemote('origin', this.getAuthenticatedUrl())
            }

            // Ensure pull always uses merge strategy (git 2.27+ requires explicit reconciliation)
            await git.addConfig('pull.rebase', 'false')

            // Ensure we are on the correct branch
            const branches = await git.branchLocal()
            if (!branches.all.includes(this.config.branch)) {
                await git.checkoutLocalBranch(this.config.branch)
            } else {
                await git.checkout(this.config.branch)
            }

            this.initialized = true
            this.lastError = null
            logger.info(`[GitSync] Ready on branch '${this.config.branch}'`)
        } catch (error) {
            this.lastError = `Initialization failed: ${error}`
            logger.error(`[GitSync] Initialization failed: ${error}`)
            throw error
        }
    }

    // ─── Core Operations ───────────────────────────────────────────────

    /**
     * Commit first, then pull (merge) from remote.
     *
     * Used for the **initial sync** when the local repo has an unborn
     * branch (no commits yet). `git pull` fails on an unborn branch,
     * so we commit all serialised data first and THEN pull with
     * `--allow-unrelated-histories` to merge any existing remote history.
     *
     * @param message   Pre-built commit message string.
     * @param author    { name, email } from the logged-in user.
     * @returns The commit result, or `null` if there was nothing to commit.
     */
    async commitThenMergeRemote(
        message: string,
        author: GitAuthor
    ): Promise<GitCommitResult | null> {
        if (!this.ensureEnabled()) return null

        return this.runExclusive(async () => {
            // ── Commit (local) ──────────────────────────────────────
            let commitResult: GitCommitResult | null = null
            try {
                const status = await this.getGit().status()
                if (status.isClean()) {
                    logger.debug('[GitSync] No changes to commit (initial)')
                    return null
                }

                await this.getGit().add('.')
                const authorStr = `${author.name} <${author.email}>`
                const result = await this.getGit().commit(message, { '--author': authorStr })
                commitResult = this.buildCommitResult(result, message, author)
                logger.info(`[GitSync] Initial commit: ${commitResult.commitHash} by ${authorStr}`)
            } catch (error) {
                this.lastError = `Initial commit failed: ${error}`
                logger.error(`[GitSync] Initial commit failed: ${error}`)
                throw error
            }

            // ── Pull / merge remote ─────────────────────────────────
            if (this.config.remoteUrl) {
                try {
                    // Refresh the remote URL before pulling — credentials may
                    // have changed since init() ran.
                    await this.getGit().remote(['set-url', 'origin', this.getAuthenticatedUrl()])
                    await this.getGit().pull('origin', this.config.branch, PULL_OPTIONS)
                    await this.assertNoConflicts(this.getGit())
                    this.lastSyncAt = new Date().toISOString()
                    logger.info('[GitSync] Merged remote into initial commit')
                } catch (error) {
                    const errMsg = (error as Error).message || String(error)
                    if (!errMsg.startsWith('CONFLICTS:')) {
                        // Remote may not have the branch yet — that's fine
                        logger.warn(`[GitSync] Initial pull/merge skipped (continuing): ${error}`)
                    } else {
                        throw error
                    }
                }
            }

            this.lastError = null
            return commitResult
        })
    }

    /**
     * Pull then commit in a single lock, ensuring no other operation can
     * sneak between the two steps.  Used by `syncDatabaseToLocalGit` to guarantee
     * atomic pull → commit sequences.
     *
     * @param message   Pre-built commit message string.
     * @param author    { name, email } from the logged-in user.
     * @returns The commit result, or `null` if there was nothing to commit.
     */
    async pullAndCommit(
        message: string,
        author: GitAuthor
    ): Promise<GitCommitResult | null> {
        if (!this.ensureEnabled()) return null

        return this.runExclusive(async () => {
            const git = this.getGit()

            // ── Pull (pre-commit) ───────────────────────────────────
            // Always refresh the remote URL so stale tokens never block the pull,
            // then integrate any remote changes before writing the new commit.
            if (this.config.remoteUrl) {
                try {
                    await git.remote(['set-url', 'origin', this.getAuthenticatedUrl()])
                    await git.pull('origin', this.config.branch, PULL_OPTIONS)
                    await this.assertNoConflicts(git)
                    this.lastSyncAt = new Date().toISOString()
                } catch (error) {
                    const errMsg = (error as Error).message || String(error)
                    if (!errMsg.startsWith('CONFLICTS:')) {
                        logger.warn(`[GitSync] Pre-commit pull failed (continuing): ${error}`)
                    } else {
                        throw error
                    }
                }
            }

            // ── Commit ──────────────────────────────────────────────
            try {
                const status = await git.status()
                if (status.isClean()) {
                    logger.debug('[GitSync] No changes to commit')
                    return null
                }

                await git.add('.')

                const authorStr = `${author.name} <${author.email}>`
                const result = await git.commit(message, { '--author': authorStr })
                const commitResult = this.buildCommitResult(result, message, author)

                logger.info(`[GitSync] pullAndCommit: ${commitResult.commitHash} by ${authorStr}`)
                this.lastError = null
                return commitResult
            } catch (error) {
                this.lastError = `Commit failed: ${error}`
                logger.error(`[GitSync] Commit failed: ${error}`)
                throw error
            }
        })
    }

    /**
     * Commit changes with a structured message.
     *
     * The commit author is derived from the **logged-in user** (`req.user`),
     * ensuring every commit is attributed to the person who triggered the action.
     *
     * @param entityType  e.g. 'chatflows', 'agentflows'
     * @param entityId    UUID of the entity
     * @param entityName  Human-readable name
     * @param action      'create' | 'update' | 'delete' | 'restore'
     * @param author      { name, email } from the logged-in user
     * @param paths       Optional list of relative paths to stage. If omitted
     *                    falls back to `git add .` (stage everything).
     */
    async commit(
        entityType: string,
        entityId: string,
        entityName: string,
        action: 'create' | 'update' | 'delete' | 'restore',
        author: GitAuthor,
        paths?: string[]
    ): Promise<GitCommitResult | null> {
        if (!this.ensureEnabled()) return null

        return this.runExclusive(async () => {
            try {
                // ── Dirty check (pre-stage) ─────────────────────────────
                // For scoped paths only: check whether the relevant files are
                // actually dirty before staging.  For a full `git add .` we
                // skip this check and rely on the post-stage isClean() guard
                // below — one status() call instead of two.
                if (paths && paths.length > 0) {
                    const preStatus = await this.getGit().status()
                    const relevantChange = preStatus.files.some((f) =>
                        paths.some((p) => f.path.startsWith(p) || p.startsWith(f.path))
                    )
                    if (!relevantChange) {
                        logger.debug(`[GitSync] No changes for scoped paths — skipping commit (${action} ${entityId})`)
                        return null
                    }
                }

                // ── Stage ───────────────────────────────────────────────
                if (paths && paths.length > 0) {
                    await this.getGit().add(paths)
                    if (action === 'delete') {
                        await this.getGit().raw(['add', '--all', ...paths])
                    }
                } else {
                    await this.getGit().add('.')
                }

                // ── Post-stage clean check ──────────────────────────────
                // The pre-stage check covers most cases; this catches edge
                // cases where `git add` normalises content (e.g. line endings)
                // back to an identical state.
                const status = await this.getGit().status()
                if (status.isClean()) {
                    logger.debug('[GitSync] No staged changes after add — skipping commit')
                    return null
                }

                const message = this.buildCommitMessage(entityType, entityId, entityName, author, action)
                const authorStr = `${author.name} <${author.email}>`

                const result = await this.getGit().commit(message, { '--author': authorStr })
                const commitResult = this.buildCommitResult(result, message, author)

                logger.info(`[GitSync] Committed: ${commitResult.commitHash} by ${authorStr}`)

                this.lastError = null
                return commitResult
            } catch (error) {
                this.lastError = `Commit failed: ${error}`
                logger.error(`[GitSync] Commit failed: ${error}`)
                throw error
            }
        })
    }

    /**
     * Push to remote with exponential-backoff retry logic.
     * Public entry — acquires the operation lock.
     * Always attempts to push to the remote regardless of the cached ahead/behind count.
     * Returns true if commits were actually sent to remote, false if already in sync.
     */
    async push(): Promise<boolean> {
        if (!this.ensureEnabled()) return false
        if (!this.config.remoteUrl) {
            throw new Error('Remote URL is required — local-only mode is not supported')
        }
        return this.runExclusive(() => this._pushInternal({ force: true }))
    }

    /**
     * Inner push — MUST be called inside runExclusive.
     * On non-fast-forward rejection, pulls first then retries.
     * @param opts.force  When true, skips the ahead===0 short-circuit and always
     *                    attempts a network push. Used for user-initiated pushes.
     *                    When false (default), skips the network round-trip if the
     *                    local branch is not ahead — used by background sync paths.
     * Returns true if a network push was made, false if nothing to push.
     */
    private async _pushInternal({ force = false }: { force?: boolean } = {}): Promise<boolean> {
        // ── Nothing-to-push guard ───────────────────────────────────────
        // For background/automatic syncs (force=false): skip the network
        // round-trip when the local branch is not ahead of the cached tracking
        // ref.  For user-initiated pushes (force=true): always attempt so the
        // user gets accurate feedback about the remote state.
        if (!force) {
            try {
                const preStatus = await this.getGit().status()
                if (preStatus.ahead === 0) {
                    logger.debug(`[GitSync] Local branch is not ahead of origin/${this.config.branch} — nothing to push`)
                    this.lastError = null
                    return false
                }
            } catch {
                // If status() fails (e.g. unborn branch) fall through and let
                // the actual push attempt surface a meaningful error.
            }
        }

        const maxRetries = 3
        let attempt = 0
        while (attempt < maxRetries) {
            try {
                const pushResult = await this.getGit().push('origin', this.config.branch, ['--tags'])
                // pushResult.update is populated only when commits were actually
                // transferred to the remote; it is undefined when already up-to-date.
                const actuallySent = !!pushResult.update
                if (actuallySent) {
                    logger.info(`[GitSync] Pushed to origin/${this.config.branch}`)
                    this.lastSyncAt = new Date().toISOString()
                } else {
                    logger.debug(`[GitSync] Remote origin/${this.config.branch} already up to date`)
                }
                this.lastError = null
                return actuallySent
            } catch (error) {
                attempt++
                const errMsg = String(error)
                logger.warn(`[GitSync] Push attempt ${attempt}/${maxRetries} failed: ${errMsg}`)

                if (attempt >= maxRetries) {
                    this.lastError = `Push failed after ${maxRetries} attempts: ${errMsg}`
                    logger.error(`[GitSync] Push failed after ${maxRetries} attempts`)
                    throw error
                }

                // If rejected due to non-fast-forward (remote has commits we don't),
                // pull first to integrate remote changes before retrying the push.
                const isNonFastForward = errMsg.includes('non-fast-forward') || errMsg.includes('fetch first') || errMsg.includes('rejected')
                if (isNonFastForward) {
                    logger.info('[GitSync] Push rejected (non-fast-forward) — pulling remote changes before retry')
                    // Refresh remote URL before pulling — credentials may have changed
                    await this.getGit().remote(['set-url', 'origin', this.getAuthenticatedUrl()])
                    await this.getGit().pull('origin', this.config.branch, PULL_OPTIONS)
                    await this.assertNoConflicts(this.getGit())
                }

                await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
            }
        }
        return false
    }

    /**
     * Pull latest changes from remote.
     *
     * Always refreshes the authenticated remote URL first (token rotation
     * safety) before issuing the pull so that credentials are never stale.
     *
     * When the local branch is unborn (no local commits yet — e.g. fresh
     * workspace that hasn't pushed anything), a plain `git pull` would fail.
     * In that case we fall back to `git fetch` + `git checkout -b <branch>
     * origin/<branch>` to bootstrap from the remote directly, then verify the
     * working tree has no conflicts.
     */
    async pull(): Promise<void> {
        if (!this.ensureEnabled()) return
        if (!this.config.remoteUrl) {
            throw new Error('Remote URL is required — local-only mode is not supported')
        }

        return this.runExclusive(async () => {
            const git = this.getGit()
            try {
                // Refresh remote URL so that any token/config change is picked up
                // before the network call — never use a cached stale URL.
                await git.remote(['set-url', 'origin', this.getAuthenticatedUrl()])

                const hasCommits = await this.hasLocalCommits()

                if (!hasCommits) {
                    // ── Unborn branch: bootstrap from remote ──────────────────
                    // git pull fails on an unborn branch; instead fetch all refs
                    // and check out the remote branch directly.
                    await git.fetch(['origin', '--tags', '--prune'])

                    // Check whether the target branch actually exists on the remote
                    const remoteRefs = await git.listRemote(['--heads', this.getAuthenticatedUrl()])
                    const remoteBranchExists = remoteRefs.includes(`refs/heads/${this.config.branch}`)

                    if (remoteBranchExists) {
                        try {
                            // Branch may already have been created by a partial bootstrap
                            await git.checkout(['-b', this.config.branch, `origin/${this.config.branch}`])
                        } catch {
                            // Branch exists locally — just reset it to the remote state
                            await git.checkout(this.config.branch)
                            await git.raw(['reset', '--hard', `origin/${this.config.branch}`])
                        }
                        this.lastSyncAt = new Date().toISOString()
                        logger.info(`[GitSync] Bootstrapped unborn branch from origin/${this.config.branch}`)
                    } else {
                        logger.info(`[GitSync] Remote branch '${this.config.branch}' does not exist yet — nothing to pull`)
                    }
                } else {
                    // ── Normal pull ────────────────────────────────────────────
                    await git.pull('origin', this.config.branch, PULL_OPTIONS)
                    await this.assertNoConflicts(git)
                    this.lastSyncAt = new Date().toISOString()
                    logger.info(`[GitSync] Pulled from origin/${this.config.branch}`)
                }

                this.lastError = null
            } catch (error) {
                // Preserve CONFLICTS: prefix so callers can distinguish conflict errors
                // from general network/auth failures
                if (!(error as Error).message?.startsWith('CONFLICTS:')) {
                    this.lastError = `Pull failed: ${error}`
                }
                logger.error(`[GitSync] Pull failed: ${error}`)
                throw error
            }
        })
    }

    /**
     * Automatically resolve merge conflicts in the working tree.
     *
     * Strategy:
     *  - `version_N.json`  → "keep both" — checkout remote copy as-is; save our
     *                        conflicting local version under the next free version
     *                        number so no data is ever lost.
     *
     * After resolution, all files are staged and committed with an attribution
     * message so the conflict history is fully auditable.
     *
     * @returns Summary of what was resolved.
     */
    async resolveConflicts(): Promise<{ resolved: string[]; renamedVersions: Array<{ from: number; to: number; chatflowId: string }> }> {
        return this.runExclusive(async () => {
            const git = this.getGit()
            const status = await git.status()

            if (status.conflicted.length === 0) {
                return { resolved: [], renamedVersions: [] }
            }

            const resolved: string[] = []
            const renamedVersions: Array<{ from: number; to: number; chatflowId: string }> = []

            for (const conflictedFile of status.conflicted) {
                const fileName = path.basename(conflictedFile)
                const isVersionFile = /^version_\d+\.json$/.test(fileName)

                if (isVersionFile) {
                    // Keep both: save our local version under a new version number,
                    // then take the remote version for the original filename.
                    const dirPath = path.join(this.repoPath, path.dirname(conflictedFile))
                    const chatflowId = path.basename(path.dirname(conflictedFile))

                    // Extract our conflicting content before checking out theirs
                    let ourContent: string | null = null
                    try {
                        ourContent = (await git.raw(['show', `:2:${conflictedFile}`])).trim()
                    } catch {
                        // :2 = ours stage; may be absent if file was only added on remote
                    }

                    // Accept remote version for the original file path
                    try {
                        await git.checkout(['--theirs', conflictedFile])
                    } catch {
                        // If theirs doesn't exist (remote deleted), remove the file
                        if (fs.existsSync(path.join(this.repoPath, conflictedFile))) {
                            fs.unlinkSync(path.join(this.repoPath, conflictedFile))
                        }
                    }
                    await git.add(conflictedFile)

                    // Save our version under the next available version slot
                    if (ourContent) {
                        const existingVersions = fs.existsSync(dirPath)
                            ? fs.readdirSync(dirPath)
                                .filter((f) => /^version_\d+\.json$/.test(f))
                                .map((f) => parseInt(f.replace('version_', '').replace('.json', ''), 10))
                                .filter((n) => !isNaN(n))
                            : []

                        const currentVersionNum = parseInt(
                            fileName.replace('version_', '').replace('.json', ''),
                            10
                        )
                        const maxVersion = existingVersions.length > 0 ? Math.max(...existingVersions) : currentVersionNum
                        const nextVersion = maxVersion + 1
                        const newFileName = `version_${nextVersion}.json`
                        const newFilePath = path.join(dirPath, newFileName)

                        // Patch the version number inside the JSON content
                        try {
                            const parsed = JSON.parse(ourContent)
                            parsed.version = nextVersion
                            parsed.changeDescription = `[Conflict resolved] ${parsed.changeDescription || ''} (originally version ${currentVersionNum}, renamed to avoid conflict)`
                            fs.writeFileSync(newFilePath, JSON.stringify(parsed, null, 2), 'utf-8')
                        } catch {
                            // Write raw content if JSON parse fails
                            fs.writeFileSync(newFilePath, ourContent, 'utf-8')
                        }

                        await git.add(path.join(path.dirname(conflictedFile), newFileName))
                        renamedVersions.push({ from: currentVersionNum, to: nextVersion, chatflowId })
                        resolved.push(`${conflictedFile} (kept both — ours renamed to ${newFileName})`)
                        logger.info(`[GitSync] Conflict resolved (keep-both): ${conflictedFile} → ours saved as ${newFileName}`)
                    } else {
                        resolved.push(`${conflictedFile} (remote wins — no local content to preserve)`)
                    }
                } else {
                    // Unknown file type — remote wins as a safe default
                    await git.checkout(['--theirs', conflictedFile])
                    await git.add(conflictedFile)
                    resolved.push(`${conflictedFile} (remote wins — unknown file type)`)
                    logger.warn(`[GitSync] Conflict auto-resolved (remote wins, unknown type): ${conflictedFile}`)
                }
            }

            // Commit the resolution
            const resolutionMsg = [
                '[AgentOps] CONFLICT RESOLUTION: Auto-merged divergent versions',
                '',
                `Resolved ${resolved.length} conflict(s):`,
                ...resolved.map((r) => `  - ${r}`),
                ...(renamedVersions.length > 0 ? [
                    '',
                    'Renamed versions (local copies preserved):',
                    ...renamedVersions.map((r) => `  - ${r.chatflowId}: version_${r.from} → version_${r.to}`)
                ] : []),
                '',
                `Timestamp: ${new Date().toISOString()}`
            ].join('\n')

            // Guard: only commit if resolving the conflicts actually staged changes.
            // In rare cases (e.g. all conflicting files were already identical)
            // the working tree may be clean after resolution, and `git commit`
            // would fail with "nothing to commit".
            const postResolutionStatus = await git.status()
            if (postResolutionStatus.isClean()) {
                logger.info('[GitSync] Conflict resolution left working tree clean — no commit needed')
                this.lastError = null
                return { resolved, renamedVersions }
            }

            await git.commit(resolutionMsg, { '--author': 'Agent Console Bot <agentconsole@system>' })
            this.lastError = null
            logger.info(`[GitSync] Conflict resolution committed: ${resolved.length} file(s) resolved`)

            return { resolved, renamedVersions }
        })
    }

    /**
     * Fetch updates from remote without merging.
     *
     * Always refreshes the authenticated remote URL first so that token
     * rotations or config changes take effect immediately.  Fetches ALL
     * remote branches and tags (not just the configured branch) so that
     * `origin/<branch>` tracking refs and `getLocalAndRemoteHeads()` always
     * reflect the true state of the remote — regardless of whether this
     * workspace has ever committed anything locally.
     */
    async fetch(): Promise<void> {
        if (!this.ensureEnabled()) return
        if (!this.config.remoteUrl) {
            throw new Error('Remote URL is required — local-only mode is not supported')
        }

        return this.runExclusive(async () => {
            const git = this.getGit()
            try {
                // Refresh the authenticated URL so stale tokens don't cause auth
                // failures on subsequent fetches.
                await git.remote(['set-url', 'origin', this.getAuthenticatedUrl()])

                // Fetch everything from the remote — all branches, all tags,
                // and prune stale remote-tracking refs that no longer exist.
                // This ensures tracking refs are always aligned with the actual
                // remote regardless of what's in the local DB.
                await git.fetch(['origin', '--tags', '--prune'])

                this.lastError = null
                this.lastSyncAt = new Date().toISOString()
                logger.info(`[GitSync] Fetched all refs from origin (branch: ${this.config.branch})`)
            } catch (error) {
                this.lastError = `Fetch failed: ${error}`
                logger.error(`[GitSync] Fetch failed: ${error}`)
                throw error
            }
        })
    }

    // ─── Query Operations ──────────────────────────────────────────────

    /**
     * Get current repository status.
     */
    async getStatus(): Promise<StatusResult | null> {
        if (!this.ensureEnabled()) return null
        return await this.getGit().status()
    }

    /**
     * Get commit history with pagination.
     * Returns the page of entries plus the total commit count for pagination.
     *
     * Handles all three possible relationships between local HEAD and
     * `origin/<branch>` after a `git fetch`:
     *
     *   • Local ahead only (unpushed commits)  → log HEAD
     *   • Remote ahead only (fetched commits)  → log origin/<branch>
     *   • Diverged (both have unique commits)  → log origin/<branch> so the full
     *     remote history is visible; local-only commits appear once pulled/merged.
     *     The `--all` flag ensures all reachable commits from any ref are included.
     *
     * Ref decorators (`HEAD -> main`, `origin/main`, `tag: v1.0`) are added via a
     * single `--pretty=format:%H %D` pass so every row shows which refs point to it.
     */
    async getLog(page = 1, pageSize = 20): Promise<{ entries: GitLogEntry[]; totalCount: number }> {
        if (!this.ensureEnabled()) return { entries: [], totalCount: 0 }

        const git = this.getGit()
        const skip = (page - 1) * pageSize
        const remoteRef = `origin/${this.config.branch}`

        // ── Determine the best ref to log from ───────────────────────────
        // We want the ref whose tip contains the most commits so the table
        // shows the complete remote history immediately after a fetch,
        // without requiring a pull first.
        //
        // Three counters fully characterise the local↔remote relationship:
        //   localOnly  = commits reachable from HEAD   but NOT from remoteRef
        //   remoteOnly = commits reachable from remoteRef but NOT from HEAD
        //
        // Decision matrix:
        //   localOnly > 0, remoteOnly = 0  → log HEAD         (local ahead)
        //   localOnly = 0, remoteOnly > 0  → log remoteRef    (remote ahead)
        //   localOnly > 0, remoteOnly > 0  → log remoteRef    (diverged; show remote side)
        //   equal SHAs                     → log HEAD         (in sync)
        let logRef = 'HEAD'
        let remoteExists = false
        try {
            const localSha = (await git.revparse(['HEAD'])).trim()
            let remoteSha: string | null = null
            try {
                remoteSha = (await git.revparse([remoteRef])).trim()
                remoteExists = true
            } catch {
                // origin/<branch> doesn't exist yet (never fetched / empty remote)
            }

            if (remoteSha && remoteSha !== localSha) {
                const remoteOnly = parseInt(
                    (await git.raw(['rev-list', '--count', `HEAD..${remoteRef}`])).trim(), 10
                ) || 0

                if (remoteOnly > 0) {
                    // Remote has commits not yet in local HEAD — log from remote ref
                    // so that fetched-but-not-yet-pulled commits are immediately visible.
                    logRef = remoteRef
                }
            }
        } catch {
            // Unborn branch or resolution failure — fall back to HEAD
            logRef = 'HEAD'
        }

        // ── Paginated structured log ──────────────────────────────────────
        let log: LogResult
        try {
            log = await git.log({ [logRef]: null, maxCount: pageSize, '--skip': skip } as any)
        } catch {
            // Unborn branch: no commits at all
            return { entries: [], totalCount: 0 }
        }

        // ── Total count + ref decorators in one combined raw pass ─────────
        // Combine --pretty=format:"%H %D" with rev-list --count in a single
        // git log invocation to avoid an extra round-trip.
        let totalCount = log.all.length  // fallback
        const refsMap: Record<string, string[]> = {}
        try {
            // Count ALL commits reachable from logRef (including --all when diverged)
            const countResult = await git.raw(['rev-list', '--count', logRef])
            totalCount = parseInt(countResult.trim(), 10) || log.all.length

            // Decorators for the current page
            const decorateRaw = await git.raw([
                'log', logRef,
                `--skip=${skip}`,
                `--max-count=${pageSize}`,
                '--pretty=format:%H %D'
            ])
            for (const line of decorateRaw.split('\n')) {
                const spaceIdx = line.indexOf(' ')
                if (spaceIdx === -1) continue
                const hash      = line.substring(0, spaceIdx).trim()
                const decorator = line.substring(spaceIdx + 1).trim()
                if (!hash) continue
                refsMap[hash] = decorator
                    ? decorator.split(',').map((r) => r.trim()).filter(Boolean)
                    : []
            }
        } catch {
            // Non-fatal — refs will be empty; totalCount stays as fallback
        }

        const entries: GitLogEntry[] = log.all.map((entry) => ({
            hash: entry.hash,
            date: entry.date,
            message: entry.message,
            author_name: entry.author_name,
            author_email: entry.author_email,
            refs: refsMap[entry.hash] ?? []
        }))

        return { entries, totalCount }
    }

    /**
     * Get diff for a specific commit.
     */
    async getDiff(commitHash: string): Promise<string> {
        if (!this.ensureEnabled()) return ''

        try {
            return await this.getGit().diff([`${commitHash}~1`, commitHash])
        } catch {
            // First commit has no parent
            return await this.getGit().diff([commitHash])
        }
    }

    // ─── Accessors ─────────────────────────────────────────────────────

    isEnabled(): boolean {
        return this.config.enabled
    }

    isInitialized(): boolean {
        return this.initialized
    }

    /**
     * Returns `true` if the local branch has at least one commit.
     * Uses `git rev-parse --verify HEAD` — a single hash lookup that is
     * faster than parsing full log output.
     */
    async hasLocalCommits(): Promise<boolean> {
        try {
            await this.getGit().revparse(['--verify', 'HEAD'])
            return true
        } catch {
            // Throws when HEAD is unborn (no commits on the branch)
            return false
        }
    }

    hasRemote(): boolean {
        return !!this.config.remoteUrl
    }

    getRepoPath(): string {
        return this.repoPath
    }

    getLastError(): string | null {
        return this.lastError
    }

    getLastSyncAt(): string | null {
        return this.lastSyncAt
    }

    clearError(): void {
        this.lastError = null
    }

    getBranch(): string {
        return this.config.branch
    }

    /**
     * Compare the local HEAD commit with the remote tracking branch commit.
     *
     * Returns:
     *   localHead    — SHA of local HEAD (null when unborn)
     *   remoteHead   — SHA of origin/<branch> (null when never fetched)
     *   outOfSync    — true when either side has commits the other doesn't
     *   localAhead   — number of local commits NOT yet pushed to remote
     *   remoteAhead  — number of remote commits NOT yet pulled locally
     *
     * Requires a prior `fetch()` so that `origin/<branch>` is up to date.
     */
    async getLocalAndRemoteHeads(): Promise<{
        localHead: string | null
        remoteHead: string | null
        outOfSync: boolean
        localAhead: number
        remoteAhead: number
    }> {
        if (!this.ensureEnabled() || !this.initialized || !this.config.remoteUrl) {
            return { localHead: null, remoteHead: null, outOfSync: false, localAhead: 0, remoteAhead: 0 }
        }

        try {
            const git = this.getGit()

            let localHead: string | null = null
            try {
                localHead = (await git.revparse(['HEAD'])).trim()
            } catch {
                // Unborn branch — no local commits yet
                return { localHead: null, remoteHead: null, outOfSync: false, localAhead: 0, remoteAhead: 0 }
            }

            let remoteHead: string | null = null
            try {
                remoteHead = (await git.revparse([`origin/${this.config.branch}`])).trim()
            } catch {
                // Remote tracking ref doesn't exist (never fetched / empty remote)
                return { localHead, remoteHead: null, outOfSync: false, localAhead: 0, remoteAhead: 0 }
            }

            if (localHead === remoteHead) {
                return { localHead, remoteHead, outOfSync: false, localAhead: 0, remoteAhead: 0 }
            }

            // Count commits exclusive to each side in one pass each
            const remoteRef = `origin/${this.config.branch}`
            const [localAhead, remoteAhead] = await Promise.all([
                git.raw(['rev-list', '--count', `${remoteRef}..HEAD`]).then((r) => parseInt(r.trim(), 10) || 0),
                git.raw(['rev-list', '--count', `HEAD..${remoteRef}`]).then((r) => parseInt(r.trim(), 10) || 0)
            ])

            return {
                localHead,
                remoteHead,
                outOfSync: localAhead > 0 || remoteAhead > 0,
                localAhead,
                remoteAhead
            }
        } catch {
            return { localHead: null, remoteHead: null, outOfSync: false, localAhead: 0, remoteAhead: 0 }
        }
    }

    /**
     * Reset the service to a fully-disabled, unconfigured state and wipe the local
     * git repo from disk.  Called when the user disables Git Sync so that no
     * credentials or repository data remain on the server.
     */
    async clearConfig(): Promise<void> {
        // Mark as disabled / uninitialised first so no operations can run
        this.config = {
            enabled: false,
            remoteUrl: '',
            branch: 'main',
            authMethod: 'token',
            accessToken: '',
            sshKeyPath: ''
        }
        this.git = null
        this.initialized = false
        this.lastError = null
        this.lastSyncAt = null

        // Remove the local git repo directory from disk
        if (fs.existsSync(this.repoPath)) {
            fs.rmSync(this.repoPath, { recursive: true, force: true })
            logger.info(`[GitSync] Removed local repo directory: ${this.repoPath}`)
        }
    }

    /**
     * Return current config with access token masked.
     */
    getConfig(): Omit<GitSyncConfig, 'accessToken'> & { accessToken: string } {
        return {
            ...this.config,
            accessToken: this.config.accessToken ? '••••••••' : ''
        }
    }

    /**
     * Return the full unmasked config (for persistence only — never expose to API).
     */
    getFullConfig(): GitSyncConfig {
        return { ...this.config }
    }

    /**
     * Apply a new partial config at runtime and re-initialise the Git service.
     * Any field not provided is kept from the previous config.
     * If the caller passes `accessToken === '••••••••'` it means "unchanged" — keep the old value.
     */
    async updateConfig(partial: Partial<GitSyncConfig>): Promise<void> {
        const previousToken = this.config.accessToken

        this.config = {
            ...this.config,
            ...partial,
            // Preserve the original token when the masked placeholder is submitted
            accessToken: partial.accessToken === '••••••••' ? previousToken : (partial.accessToken ?? previousToken)
        }

        // Reset the SimpleGit instance so it is re-created by getGit() / init().
        this.git = null

        this.initialized = false

        if (this.config.enabled) {
            try {
                await this.init()
            } catch (error) {
                // Config is saved but initialisation failed (e.g. bad remote, git error).
                // Don't throw — let the caller know the config was persisted.
                // lastError is already set by init()
                logger.error(`[GitSync] Config saved but initialisation failed: ${error}`)
            }
        } else {
            this.lastError = null
        }

        logger.info('[GitSync] Configuration updated at runtime')
    }

    // ─── Private Helpers ───────────────────────────────────────────────

    private ensureEnabled(): boolean {
        if (!this.config.enabled) {
            logger.debug('[GitSync] Git sync is disabled, skipping operation')
            return false
        }
        if (!this.initialized) {
            logger.warn('[GitSync] Git sync not initialized, skipping operation')
            return false
        }
        return true
    }

    private buildCommitMessage(
        entityType: string,
        entityId: string,
        entityName: string,
        author: GitAuthor,
        action: string
    ): string {
        return [
            `[AgentOps] ${action.toUpperCase()}: ${entityType} "${entityName}"`,
            '',
            `Entity ID: ${entityId}`,
            `Entity Type: ${entityType}`,
            `Action: ${action}`,
            `Author: ${author.name} <${author.email}>`,
            `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
    }

    private getAuthenticatedUrl(): string {
        return GitSyncService.buildAuthenticatedUrl(
            this.config.remoteUrl,
            this.config.authMethod,
            this.config.accessToken
        )
    }

    /**
     * Build an authenticated remote URL from parts.
     * Static so it can be shared with testConnectionWithConfig without an instance.
     */
    private static buildAuthenticatedUrl(remoteUrl: string, authMethod: string, accessToken: string): string {
        if (authMethod === 'token' && accessToken) {
            try {
                const url = new URL(remoteUrl)
                // Standard HTTPS token auth — works for GitHub, GitLab, Bitbucket.
                // Format: https://<token>@host/path  (GitHub PATs support this)
                // Also works: https://x-access-token:<token>@host/path
                url.username = 'x-access-token'
                url.password = accessToken
                return url.toString()
            } catch {
                // If URL parsing fails, return as-is
            }
        }
        return remoteUrl
    }

    /**
     * Test connectivity using an explicit config snapshot.
     * Used for "test before save" flows where credentials haven't been persisted yet.
     */
    async testConnectionWithConfig(
        cfg: Pick<GitSyncConfig, 'remoteUrl' | 'branch' | 'authMethod' | 'accessToken' | 'sshKeyPath'>
    ): Promise<{ ok: boolean; error?: string }> {
        if (!cfg.remoteUrl) {
            return { ok: false, error: 'No remote URL configured' }
        }

        try {
            // Reuse the same URL-builder logic as getAuthenticatedUrl()
            const url = GitSyncService.buildAuthenticatedUrl(cfg.remoteUrl, cfg.authMethod, cfg.accessToken)

            const env: Record<string, string> = {}
            if (cfg.authMethod === 'ssh' && cfg.sshKeyPath) {
                env.GIT_SSH_COMMAND = `ssh -i "${cfg.sshKeyPath}" -o StrictHostKeyChecking=accept-new`
            }

            // Use os.tmpdir() as the working directory — it always exists.
            // git ls-remote only needs a valid baseDir, not an actual git repo.
            const git = simpleGit({
                baseDir: os.tmpdir(),
                binary: 'git',
                maxConcurrentProcesses: 1,
                ...(Object.keys(env).length > 0 ? { env } : {})
            } as any)

            await git.listRemote(['--heads', url])
            return { ok: true }
        } catch (error) {
            const msg = String(error)
            const safeMsg = msg.replace(/https?:\/\/[^@]+@/g, 'https://***@')
            return { ok: false, error: safeMsg }
        }
    }

    /**
     * Test connectivity to the remote using the current saved config.
     * Uses `git ls-remote --heads` which verifies auth + network without modifying anything.
     * Returns { ok: true } or { ok: false, error: string }.
     */
    async testConnection(): Promise<{ ok: boolean; error?: string }> {
        return this.testConnectionWithConfig(this.config)
    }
}
