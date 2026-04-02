/**
 * Git Sync Configuration Manager
 *
 * Persists Git Sync settings to a JSON file on disk (similar to Platform ConfigManager).
 * Sensitive fields (accessToken, sshKeyPath) are AES-encrypted using the same
 * encryption key as the rest of the Flowise credential store.
 *
 * File location: <storagePath>/git-sync-<workspaceId>.json
 *
 * Each workspace gets its own config file so that different workspaces can
 * have independent remote URLs, branches, and credentials.
 */

import fs from 'node:fs'
import path from 'node:path'
import { AES, enc } from 'crypto-js'
import { getStoragePath } from 'flowise-components'
import { getEncryptionKey } from '../../utils'
import logger from '../../utils/logger'

import type { GitSyncConfig } from './GitSyncService'

/** Fields that must be encrypted at rest. */
const SENSITIVE_FIELDS: (keyof GitSyncConfig)[] = ['accessToken', 'sshKeyPath']

/**
 * On-disk shape — identical to GitSyncConfig but with sensitive values
 * replaced by their AES cipher-text.
 */
interface PersistedConfig {
    [key: string]: unknown
}

class GitSyncConfigManager {
    private configFilePath: string
    private readonly workspaceId: string

    constructor(workspaceId: string) {
        this.workspaceId = workspaceId
        const storagePath = getStoragePath()
        this.configFilePath = path.join(storagePath, `git-sync-${workspaceId}.json`)
    }

    // ── Read ───────────────────────────────────────────────────────────

    /**
     * Load persisted config and decrypt secrets.
     * Returns `null` when no file exists (first-run).
     */
    async load(): Promise<GitSyncConfig | null> {
        try {
            if (!fs.existsSync(this.configFilePath)) {
                return null
            }

            const raw: PersistedConfig = JSON.parse(
                fs.readFileSync(this.configFilePath, 'utf-8')
            )

            const encryptKey = await getEncryptionKey()

            // Decrypt sensitive fields
            for (const field of SENSITIVE_FIELDS) {
                const val = raw[field]
                if (typeof val === 'string' && val.length > 0) {
                    try {
                        const decrypted = AES.decrypt(val, encryptKey).toString(enc.Utf8)
                        raw[field] = decrypted
                    } catch {
                        // If decryption fails (e.g. key changed), clear the field
                        logger.warn(`[GitSyncConfig:${this.workspaceId}] Failed to decrypt field '${field}', clearing it`)
                        raw[field] = ''
                    }
                }
            }

            return raw as unknown as GitSyncConfig
        } catch (error) {
            logger.error(`[GitSyncConfig:${this.workspaceId}] Failed to load config: ${error}`)
            return null
        }
    }

    // ── Write ──────────────────────────────────────────────────────────

    /**
     * Persist the full config to disk, encrypting sensitive fields.
     */
    async save(config: GitSyncConfig): Promise<void> {
        try {
            const encryptKey = await getEncryptionKey()

            // Build a plain object with sensitive fields encrypted
            const persisted: PersistedConfig = { ...config }

            for (const field of SENSITIVE_FIELDS) {
                const val = (config as any)[field]
                if (typeof val === 'string' && val.length > 0) {
                    persisted[field] = AES.encrypt(val, encryptKey).toString()
                } else {
                    persisted[field] = ''
                }
            }

            // Ensure directory exists
            const dir = path.dirname(this.configFilePath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }

            fs.writeFileSync(
                this.configFilePath,
                JSON.stringify(persisted, null, 2),
                'utf-8'
            )
            logger.debug(`[GitSyncConfig:${this.workspaceId}] Configuration saved to disk`)
        } catch (error) {
            logger.error(`[GitSyncConfig:${this.workspaceId}] Failed to save config: ${error}`)
        }
    }

    /**
     * Delete the persisted config file from disk.
     * Called when the user disables Git Sync so no config remains at rest.
     */
    clear(): void {
        try {
            if (fs.existsSync(this.configFilePath)) {
                fs.unlinkSync(this.configFilePath)
                logger.debug(`[GitSyncConfig:${this.workspaceId}] Configuration file deleted from disk`)
            }
        } catch (error) {
            logger.error(`[GitSyncConfig:${this.workspaceId}] Failed to delete config file: ${error}`)
        }
    }

    /**
     * Check whether a persisted config file exists.
     */
    exists(): boolean {
        return fs.existsSync(this.configFilePath)
    }

    /**
     * Get config file path (for debugging / logs).
     */
    getConfigFilePath(): string {
        return this.configFilePath
    }
}

// ── Per-workspace factory ─────────────────────────────────────────────────────

const configManagerCache = new Map<string, GitSyncConfigManager>()

/**
 * Return (or create) the GitSyncConfigManager for the given workspace.
 * Instances are cached so a single file-handle is reused per workspace.
 */
export function getWorkspaceConfigManager(workspaceId: string): GitSyncConfigManager {
    let mgr = configManagerCache.get(workspaceId)
    if (!mgr) {
        mgr = new GitSyncConfigManager(workspaceId)
        configManagerCache.set(workspaceId, mgr)
    }
    return mgr
}

/**
 * Return the workspace IDs of all persisted workspace config files.
 * Used at startup to discover which workspaces have Git Sync configured.
 *
 * Only returns IDs that look like valid UUIDs — this filters out legacy
 * config files (e.g. `git-sync-config.json` from before workspace isolation).
 */
export function listWorkspaceConfigIds(): string[] {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    try {
        const storagePath = getStoragePath()
        const files = fs.readdirSync(storagePath)
        return files
            .filter((f) => f.startsWith('git-sync-') && f.endsWith('.json'))
            .map((f) => f.replace('git-sync-', '').replace('.json', ''))
            .filter((id) => UUID_RE.test(id))
    } catch {
        return []
    }
}

export default getWorkspaceConfigManager
