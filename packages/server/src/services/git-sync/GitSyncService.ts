import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import logger from '../../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Local directory where serialized version files are committed.
 * Fixed to `~/.flowise/chatflow-versions` — not configurable via environment variables.
 */
export const gitSyncRepoPath: string = path.join(os.homedir(), '.flowise', 'chatflow-versions')

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
    private initialized = false
    private lastError: string | null = null
    /** Timestamp of the last successful push, pull, or fetch. */
    private lastSyncAt: string | null = null
    /** Serialise all git operations to prevent concurrent corruption. */
    private opLock: Promise<void> = Promise.resolve()

    constructor(config: GitSyncConfig) {
        this.config = config
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
     * Returns the SimpleGit instance, creating it if needed.
     * Ensures the repo directory exists before constructing the instance
     * (simple-git validates the baseDir on construction).
     */
    private getGit(): SimpleGit {
        if (!this.git) {
            // Ensure directory exists — simple-git throws if it doesn't
            if (!fs.existsSync(gitSyncRepoPath)) {
                fs.mkdirSync(gitSyncRepoPath, { recursive: true })
            }

            // Build env vars — wire SSH key if configured
            const env: Record<string, string> = {}
            if (this.config.authMethod === 'ssh' && this.config.sshKeyPath) {
                env.GIT_SSH_COMMAND = `ssh -i "${this.config.sshKeyPath}" -o StrictHostKeyChecking=accept-new`
            }

            this.git = simpleGit({
                baseDir: gitSyncRepoPath,
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
            if (!fs.existsSync(gitSyncRepoPath)) {
                fs.mkdirSync(gitSyncRepoPath, { recursive: true })
                logger.info(`[GitSync] Created repo directory: ${gitSyncRepoPath}`)
            }

            // Force re-creation of the SimpleGit instance so getGit() picks
            // up the (now-existent) directory AND wires SSH env vars correctly.
            this.git = null
            const git = this.getGit()

            // Check if already a git repo
            const gitDir = path.join(gitSyncRepoPath, '.git')
            if (!fs.existsSync(gitDir)) {
                await git.init()
                logger.info(`[GitSync] Initialized new Git repository at ${gitSyncRepoPath}`)

                // Pin the repo-local committer identity so the initial commit
                // is fully attributed to the system bot regardless of the
                // global ~/.gitconfig on the host machine.
                await git.addConfig('user.name', 'Agent Console Bot')
                await git.addConfig('user.email', 'agentconsole@system')

                // Create initial .gitignore — the actual commit happens later
                // in syncDatabaseToLocalGit() so the initial commit contains ALL data
                // (versions + metadata + .gitignore) in a single commit.
                const gitignorePath = path.join(gitSyncRepoPath, '.gitignore')
                fs.writeFileSync(gitignorePath, '# Agent Ops Git Sync\n.DS_Store\nnode_modules/\n', 'utf-8')
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
                commitResult = {
                    commitHash: result.commit || '',
                    message,
                    timestamp: new Date().toISOString(),
                    author
                }
                logger.info(`[GitSync] Initial commit: ${commitResult.commitHash} by ${authorStr}`)
            } catch (error) {
                this.lastError = `Initial commit failed: ${error}`
                logger.error(`[GitSync] Initial commit failed: ${error}`)
                throw error
            }

            // ── Pull / merge remote ─────────────────────────────────
            if (this.config.remoteUrl) {
                try {
                    await this.getGit().pull('origin', this.config.branch, {
                        '--no-rebase': null,
                        '--tags': null,
                        '--allow-unrelated-histories': null
                    })

                    const pullStatus = await this.getGit().status()
                    if (pullStatus.conflicted.length > 0) {
                        const conflictList = pullStatus.conflicted.join(', ')
                        this.lastError = `CONFLICTS: ${conflictList}`
                        logger.error(`[GitSync] Initial merge conflicts: ${conflictList}`)
                        throw new Error(this.lastError)
                    }
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
            // ── Pull ────────────────────────────────────────────────
            if (this.config.remoteUrl) {
                try {
                    await this.getGit().pull('origin', this.config.branch, {
                        '--no-rebase': null,
                        '--tags': null,
                        '--allow-unrelated-histories': null
                    })

                    const pullStatus = await this.getGit().status()
                    if (pullStatus.conflicted.length > 0) {
                        const conflictList = pullStatus.conflicted.join(', ')
                        this.lastError = `CONFLICTS: ${conflictList}`
                        logger.error(`[GitSync] Pre-commit pull conflicts: ${conflictList}`)
                        throw new Error(this.lastError)
                    }
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
                const status = await this.getGit().status()
                if (status.isClean()) {
                    logger.debug('[GitSync] No changes to commit')
                    return null
                }

                await this.getGit().add('.')

                const authorStr = `${author.name} <${author.email}>`

                const result = await this.getGit().commit(message, { '--author': authorStr })

                const commitResult: GitCommitResult = {
                    commitHash: result.commit || '',
                    message,
                    timestamp: new Date().toISOString(),
                    author
                }

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
                // For scoped paths, check only those paths; for a full stage
                // we can rely on overall working-tree status.
                // Avoids a no-op `git add` + commit when nothing has changed.
                if (paths && paths.length > 0) {
                    const preStatus = await this.getGit().status()
                    const relevantChange = preStatus.files.some((f) =>
                        paths.some((p) => f.path.startsWith(p) || p.startsWith(f.path))
                    )
                    if (!relevantChange) {
                        logger.debug(`[GitSync] No changes for scoped paths — skipping commit (${action} ${entityId})`)
                        return null
                    }
                } else {
                    const preStatus = await this.getGit().status()
                    if (preStatus.isClean()) {
                        logger.debug(`[GitSync] Working tree is clean — skipping commit (${action} ${entityId})`)
                        return null
                    }
                }

                // ── Stage ───────────────────────────────────────────────
                // Stage only the specified paths, or everything if none given
                if (paths && paths.length > 0) {
                    // For deletions we need --all so removed files are staged
                    await this.getGit().add(paths)
                    // Also stage deletions that `add` alone won't pick up
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

                const commitResult: GitCommitResult = {
                    commitHash: result.commit || '',
                    message,
                    timestamp: new Date().toISOString(),
                    author
                }

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
                    await this.getGit().pull('origin', this.config.branch, {
                        '--no-rebase': null,
                        '--tags': null,
                        '--allow-unrelated-histories': null
                    })

                    // After merge, check for unresolved conflicts (same as pull())
                    const postPullStatus = await this.getGit().status()
                    if (postPullStatus.conflicted.length > 0) {
                        const conflictList = postPullStatus.conflicted.join(', ')
                        this.lastError = `CONFLICTS: ${conflictList}`
                        logger.error(`[GitSync] Push-pull resulted in conflicts: ${conflictList}`)
                        throw new Error(this.lastError)
                    }
                }

                await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
            }
        }
        return false
    }

    /**
     * Pull latest changes from remote.
     */
    async pull(): Promise<void> {
        if (!this.ensureEnabled()) return
        if (!this.config.remoteUrl) {
            throw new Error('Remote URL is required — local-only mode is not supported')
        }

        return this.runExclusive(async () => {
            try {
                // --no-rebase forces merge strategy; required for git 2.27+ which errors
                // on bare `git pull` when branches have diverged (no pull.rebase config).
                // --allow-unrelated-histories handles the case where the local repo was
                // freshly initialised (wiped / new instance) but the remote already has commits.
                await this.getGit().pull('origin', this.config.branch, {
                    '--no-rebase': null,
                    '--tags': null,
                    '--allow-unrelated-histories': null
                })

                // After merge, check for unresolved conflicts
                const status = await this.getGit().status()
                if (status.conflicted.length > 0) {
                    const conflictList = status.conflicted.join(', ')
                    this.lastError = `CONFLICTS: ${conflictList}`
                    logger.error(`[GitSync] Pull completed with conflicts: ${conflictList}`)
                    throw new Error(this.lastError)
                }

                this.lastError = null
                this.lastSyncAt = new Date().toISOString()
                logger.info(`[GitSync] Pulled from origin/${this.config.branch}`)
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
                    const dirPath = path.join(gitSyncRepoPath, path.dirname(conflictedFile))
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
                        if (fs.existsSync(path.join(gitSyncRepoPath, conflictedFile))) {
                            fs.unlinkSync(path.join(gitSyncRepoPath, conflictedFile))
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
     * Useful for checking if there are new changes available.
     */
    async fetch(): Promise<void> {
        if (!this.ensureEnabled()) return
        if (!this.config.remoteUrl) {
            throw new Error('Remote URL is required — local-only mode is not supported')
        }

        return this.runExclusive(async () => {
            try {
                await this.getGit().fetch('origin', this.config.branch, ['--tags'])
                this.lastError = null
                this.lastSyncAt = new Date().toISOString()
                logger.info(`[GitSync] Fetched from origin/${this.config.branch}`)
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
     */
    async getLog(page = 1, pageSize = 20): Promise<{ entries: GitLogEntry[]; totalCount: number }> {
        if (!this.ensureEnabled()) return { entries: [], totalCount: 0 }

        const skip = (page - 1) * pageSize
        const log: LogResult = await this.getGit().log({
            maxCount: pageSize,
            '--skip': skip
        } as any)

        // Get total commit count for pagination
        let totalCount = 0
        try {
            const result = await this.getGit().raw(['rev-list', '--count', 'HEAD'])
            totalCount = parseInt(result.trim(), 10) || 0
        } catch {
            // If rev-list fails (e.g. empty repo), fall back to the entries we have
            totalCount = log.all.length
        }

        // Build a hash → refs map using --pretty=format:"%H %D" which emits
        // decorator refs like "HEAD -> main, origin/main, tag: v1.0"
        const refsMap: Record<string, string[]> = {}
        try {
            const decorateRaw = await this.getGit().raw([
                'log',
                `--skip=${skip}`,
                `--max-count=${pageSize}`,
                '--pretty=format:%H %D'
            ])
            for (const line of decorateRaw.split('\n')) {
                const spaceIdx = line.indexOf(' ')
                if (spaceIdx === -1) continue
                const hash = line.substring(0, spaceIdx).trim()
                const decorator = line.substring(spaceIdx + 1).trim()
                if (!hash) continue
                // Parse "HEAD -> main, origin/main, tag: v1.0" into individual tokens
                refsMap[hash] = decorator
                    ? decorator.split(',').map((r) => r.trim()).filter(Boolean)
                    : []
            }
        } catch {
            // Non-fatal — refs will be empty
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
     * A freshly `git init`-ed repo has an "unborn" HEAD and no commits.
     */
    async hasLocalCommits(): Promise<boolean> {
        try {
            await this.getGit().log({ maxCount: 1 })
            return true
        } catch {
            // simple-git throws when the branch is unborn (no commits)
            return false
        }
    }

    hasRemote(): boolean {
        return !!this.config.remoteUrl
    }

    getRepoPath(): string {
        return gitSyncRepoPath
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
     * Returns an object indicating whether they are in sync, and the respective SHAs.
     * Requires a prior `fetch` so that `origin/<branch>` is up to date.
     */
    async getLocalAndRemoteHeads(): Promise<{ localHead: string | null; remoteHead: string | null; outOfSync: boolean }> {
        if (!this.ensureEnabled() || !this.initialized || !this.config.remoteUrl) {
            return { localHead: null, remoteHead: null, outOfSync: false }
        }

        try {
            const git = this.getGit()
            const localHead = (await git.revparse(['HEAD'])).trim()
            let remoteHead: string | null = null
            try {
                remoteHead = (await git.revparse([`origin/${this.config.branch}`])).trim()
            } catch {
                // Remote ref may not exist yet (never fetched / no remote commits)
                remoteHead = null
            }
            const outOfSync = remoteHead !== null && localHead !== remoteHead
            return { localHead, remoteHead, outOfSync }
        } catch {
            // If HEAD doesn't exist (empty repo), not out of sync
            return { localHead: null, remoteHead: null, outOfSync: false }
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
        if (fs.existsSync(gitSyncRepoPath)) {
            fs.rmSync(gitSyncRepoPath, { recursive: true, force: true })
            logger.info(`[GitSync] Removed local repo directory: ${gitSyncRepoPath}`)
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
        if (this.config.authMethod === 'token' && this.config.accessToken) {
            try {
                const url = new URL(this.config.remoteUrl)
                // Standard HTTPS token auth — works for GitHub, GitLab, Bitbucket.
                // Format: https://<token>@host/path  (GitHub PATs support this)
                // Also works: https://x-access-token:<token>@host/path
                url.username = 'x-access-token'
                url.password = this.config.accessToken
                return url.toString()
            } catch {
                // If URL parsing fails, return as-is
                return this.config.remoteUrl
            }
        }
        return this.config.remoteUrl
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
            // Build authenticated URL
            let url = cfg.remoteUrl
            if (cfg.authMethod === 'token' && cfg.accessToken) {
                try {
                    const parsed = new URL(cfg.remoteUrl)
                    parsed.username = 'x-access-token'
                    parsed.password = cfg.accessToken
                    url = parsed.toString()
                } catch {
                    // Use as-is if URL parsing fails
                }
            }

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
