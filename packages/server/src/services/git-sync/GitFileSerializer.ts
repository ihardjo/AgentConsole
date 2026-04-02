import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import logger from '../../utils/logger'

/**
 * Serialises chatflow/agentflow versions to JSON files inside the Git
 * repository before committing.
 *
 * Repository structure (workspace-namespaced so multiple workspaces can
 * safely share the same remote repository):
 *
 *   <repoPath>/
 *     workspaces/<workspaceId>/
 *       chatflows/<chatflowId>/version_<N>.json
 *       agentflows/<chatflowId>/version_<N>.json
 */
export class GitFileSerializer {
    /** Absolute path to the workspace subtree inside the repo. */
    readonly workspaceDir: string

    constructor(
        private readonly basePath: string,
        private readonly workspaceId: string
    ) {
        this.workspaceDir = path.join(basePath, 'workspaces', workspaceId)
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Delete a specific version file if it exists.
     */
    deleteVersion(entityType: string, chatflowId: string, version: number): void {
        const filePath = this.versionPath(entityType, chatflowId, version)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            logger.info(`[GitFileSerializer] Deleted ${entityType}/${chatflowId}/version_${version}.json`)
        }
    }

    /**
     * Return the highest version number that exists on disk for a chatflow, or 0 if none.
     */
    getMaxVersionOnDisk(entityType: string, chatflowId: string): number {
        const dir = this.flowDir(entityType, chatflowId)
        if (!fs.existsSync(dir)) return 0

        return fs.readdirSync(dir).reduce((max, f) => {
            const m = /^version_(\d+)\.json$/.exec(f)
            return m ? Math.max(max, Number(m[1])) : max
        }, 0)
    }

    /**
     * Write a version to disk with idempotency and collision safety:
     *
     * - Slot free                  → write normally.
     * - Slot occupied, same data   → skip (idempotent).
     * - Slot occupied, different   → find next free slot, patch `version` field.
     *
     * @returns The version number actually written (may differ from `requestedVersion`).
     */
    safeWriteVersion(
        entityType: string,
        chatflowId: string,
        requestedVersion: number,
        data: Record<string, any>
    ): number {
        const dir = this.flowDir(entityType, chatflowId)
        fs.mkdirSync(dir, { recursive: true })

        const targetPath = this.versionPath(entityType, chatflowId, requestedVersion)

        if (!fs.existsSync(targetPath)) {
            this.writeJson(targetPath, data)
            logger.debug(`[GitFileSerializer] Wrote ${entityType}/${chatflowId}/version_${requestedVersion}.json`)
            return requestedVersion
        }

        if (this.isContentIdentical(targetPath, data.flowData)) {
            logger.debug(`[GitFileSerializer] Skip (identical) ${entityType}/${chatflowId}/version_${requestedVersion}.json`)
            return requestedVersion
        }

        // Collision — bump to next free slot
        const nextVersion = this.getMaxVersionOnDisk(entityType, chatflowId) + 1
        this.writeJson(this.versionPath(entityType, chatflowId, nextVersion), { ...data, version: nextVersion })
        logger.info(`[GitFileSerializer] Collision at v${requestedVersion} → wrote v${nextVersion} for ${entityType}/${chatflowId}`)
        return nextVersion
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    private flowDir(entityType: string, chatflowId: string): string {
        return path.join(this.workspaceDir, entityType, chatflowId)
    }

    private versionPath(entityType: string, chatflowId: string, version: number): string {
        return path.join(this.workspaceDir, entityType, chatflowId, `version_${version}.json`)
    }

    private writeJson(filePath: string, data: Record<string, any>): void {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    }

    /**
     * Checks whether the `flowData` field in the on-disk JSON file matches
     * `incomingFlowData` without performing a full `JSON.parse()`.
     *
     * Strategy:
     *  1. Hash the incoming string with SHA-256 (fast, in-memory).
     *  2. Read the raw file bytes and extract only the `flowData` value via a
     *     targeted regex so we never deserialise the entire object.
     *  3. Hash the extracted raw value and compare — both hashes are computed
     *     on the *string* representation, so the comparison is byte-exact.
     *
     * Falls back to `false` (treat as different) on any I/O or parse error so
     * the caller will always re-write in the error case.
     */
    private isContentIdentical(filePath: string, incomingFlowData: string): boolean {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8')

            // Extract the raw JSON string literal assigned to "flowData".
            // The value is a JSON-stringified string inside the outer JSON, so
            // it appears as:  "flowData": "<escaped-content>"
            // We capture everything between the outer quotes, then unescape it.
            const match = /"flowData"\s*:\s*("(?:[^"\\]|\\.)*")/s.exec(raw)
            if (!match) return false

            // JSON.parse a *single string token* — dramatically cheaper than
            // parsing the whole object.
            const existingFlowData: string = JSON.parse(match[1])

            const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
            return hash(existingFlowData) === hash(incomingFlowData)
        } catch {
            return false // treat unparseable / missing file as different
        }
    }
}

