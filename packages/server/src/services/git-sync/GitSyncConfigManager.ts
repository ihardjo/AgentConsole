/**
 * Git Sync Configuration Manager
 *
 * Persists Git Sync settings to a JSON file on disk (similar to Platform ConfigManager).
 * Sensitive fields (accessToken, sshKeyPath) are AES-encrypted using the same
 * encryption key as the rest of the Flowise credential store.
 *
 * File location: <storagePath>/git-sync-config.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { AES, enc } from 'crypto-js'
import { getStoragePath } from 'flowise-components'
import { getEncryptionKey } from '../../utils'
import logger from '../../utils/logger'

import type { GitSyncConfig } from './GitSyncService'

const CONFIG_FILENAME = 'git-sync-config.json'

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
    private static instance: GitSyncConfigManager
    private configFilePath: string

    private constructor() {
        const storagePath = getStoragePath()
        this.configFilePath = path.join(storagePath, CONFIG_FILENAME)
    }

    static getInstance(): GitSyncConfigManager {
        if (!GitSyncConfigManager.instance) {
            GitSyncConfigManager.instance = new GitSyncConfigManager()
        }
        return GitSyncConfigManager.instance
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
                        logger.warn(`[GitSyncConfig] Failed to decrypt field '${field}', clearing it`)
                        raw[field] = ''
                    }
                }
            }

            return raw as unknown as GitSyncConfig
        } catch (error) {
            logger.error(`[GitSyncConfig] Failed to load config: ${error}`)
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
            logger.info('[GitSyncConfig] Configuration saved to disk')
        } catch (error) {
            logger.error(`[GitSyncConfig] Failed to save config: ${error}`)
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
                logger.info('[GitSyncConfig] Configuration file deleted from disk')
            }
        } catch (error) {
            logger.error(`[GitSyncConfig] Failed to delete config file: ${error}`)
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

export default GitSyncConfigManager.getInstance()
