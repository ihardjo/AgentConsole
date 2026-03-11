import fs from 'node:fs'
import path from 'node:path'
import logger from '../../utils/logger'

/**
 * Serialises chatflow/agentflow versions to JSON files inside the Git
 * repository before committing.
 *
 * Repository structure:
 *   <repoPath>/
 *     chatflows/<chatflowId>/version_<N>.json
 *     agentflows/<chatflowId>/version_<N>.json
 */
export class GitFileSerializer {
    constructor(private readonly basePath: string) {}

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

        const nums = fs.readdirSync(dir)
            .map((f) => /^version_(\d+)\.json$/.exec(f)?.[1])
            .filter((n): n is string => n !== undefined)
            .map(Number)

        return nums.length > 0 ? Math.max(...nums) : 0
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
        return path.join(this.basePath, entityType, chatflowId)
    }

    private versionPath(entityType: string, chatflowId: string, version: number): string {
        return path.join(this.basePath, entityType, chatflowId, `version_${version}.json`)
    }

    private writeJson(filePath: string, data: Record<string, any>): void {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    }

    private isContentIdentical(filePath: string, incomingFlowData: string): boolean {
        try {
            const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            return existing.flowData === incomingFlowData
        } catch {
            return false // treat unparseable file as different
        }
    }
}

