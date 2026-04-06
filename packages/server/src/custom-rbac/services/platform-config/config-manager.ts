/**
 * Platform Configuration Manager
 * 
 * In-memory configuration manager with file persistence for hot-reloadable settings.
 * Singleton pattern - shared across the application.
 * 
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0
 */

import fs from 'fs'
import path from 'path'
import { getStoragePath } from 'flowise-components'

const CONFIG_FILENAME = 'platform-config.json'

interface PlatformConfigData {
    applicationName: string
    [key: string]: any
}

class ConfigManager {
    private static instance: ConfigManager
    private config: Map<string, any> = new Map()
    private configFilePath: string

    private constructor() {
        // Use storage path for config file (respects BLOB_STORAGE_PATH env)
        const storagePath = getStoragePath()
        this.configFilePath = path.join(storagePath, CONFIG_FILENAME)
        this.loadFromFile()
    }

    /**
     * Get singleton instance
     */
    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager()
        }
        return ConfigManager.instance
    }

    /**
     * Get a config value
     */
    get<T = any>(key: string): T | undefined {
        return this.config.get(key) as T | undefined
    }

    /**
     * Set a config value (hot reload - updates immediately and persists)
     */
    set(key: string, value: any): void {
        this.config.set(key, value)
        this.saveToFile()
    }

    /**
     * Get all config as object
     */
    getAll(): PlatformConfigData {
        return Object.fromEntries(this.config) as PlatformConfigData
    }

    /**
     * Check if a config key exists
     */
    has(key: string): boolean {
        return this.config.has(key)
    }

    /**
     * Delete a config key
     */
    delete(key: string): boolean {
        const result = this.config.delete(key)
        if (result) {
            this.saveToFile()
        }
        return result
    }

    /**
     * Reset to defaults
     */
    reset(): void {
        this.config.clear()
        this.setDefaults()
        this.saveToFile()
    }

    /**
     * Set default values
     */
    private setDefaults(): void {
        this.config.set('applicationName', process.env.APPLICATION_NAME || 'AI Reinvention Studio')
        this.config.set('agentEvaluationUrl', process.env.AGENT_EVALUATION_URL || 'https://example.com/agent-evaluation/')
    }

    /**
     * Load config from file
     */
    private loadFromFile(): void {
        try {
            if (fs.existsSync(this.configFilePath)) {
                const data = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'))
                Object.entries(data).forEach(([key, value]) => {
                    this.config.set(key, value)
                })
            } else {
                // Initialize with defaults if file doesn't exist
                this.setDefaults()
                this.saveToFile()
            }
        } catch (error) {
            console.error('[ConfigManager] Failed to load config file:', error)
            this.setDefaults()
        }
    }

    /**
     * Save config to file
     */
    private saveToFile(): void {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.configFilePath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }

            const data = Object.fromEntries(this.config)
            fs.writeFileSync(this.configFilePath, JSON.stringify(data, null, 2), 'utf-8')
        } catch (error) {
            console.error('[ConfigManager] Failed to save config file:', error)
        }
    }

    /**
     * Get config file path (for debugging)
     */
    getConfigFilePath(): string {
        return this.configFilePath
    }
}

export default ConfigManager.getInstance()
