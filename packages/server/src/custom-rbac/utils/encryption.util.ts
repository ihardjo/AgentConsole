/**
 * Custom RBAC - Encryption Utilities
 *
 * Copyright (c) 2024-2026
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * CLEAN ROOM IMPLEMENTATION: This file was developed independently without
 * reference to any FlowiseAI Enterprise code.
 */

import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Default salt rounds for bcrypt
const SALT_ROUNDS = 10

/**
 * Hashes a password using bcrypt
 * @param password - The plain text password to hash
 * @returns The hashed password
 */
export function hashPassword(password: string): string {
    const salt = bcrypt.genSaltSync(SALT_ROUNDS)
    return bcrypt.hashSync(password, salt)
}

/**
 * Compares a plain text password with a hashed password
 * @param password - The plain text password
 * @param hashedPassword - The hashed password to compare against
 * @returns true if passwords match
 */
export function comparePassword(password: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(password, hashedPassword)
}

/**
 * Generates a secure random token
 * @param length - The length of the token in bytes (default 32)
 * @returns The generated token as a hex string
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
}

/**
 * Generates a temporary token with a shorter length for verification purposes
 * @returns A 24-character hex token
 */
export function generateTempToken(): string {
    return crypto.randomBytes(12).toString('hex')
}

/**
 * Generates a UUID v4
 * @returns A new UUID v4 string
 */
export function generateUUID(): string {
    return crypto.randomUUID()
}

/**
 * Creates a SHA-256 hash of a string
 * @param data - The string to hash
 * @returns The hash as a hex string
 */
export function sha256Hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Encrypts data using AES-256-GCM
 * @param data - The data to encrypt
 * @param key - The encryption key (must be 32 bytes)
 * @returns Object containing the encrypted data, iv, and auth tag
 */
export function encryptAES(
    data: string,
    key: Uint8Array
): {
    encrypted: string
    iv: string
    authTag: string
} {
    const ivBuffer = crypto.randomBytes(16)
    const iv = Uint8Array.from(ivBuffer)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()
    return {
        encrypted,
        iv: ivBuffer.toString('hex'),
        authTag: authTag.toString('hex')
    }
}

/**
 * Decrypts data encrypted with AES-256-GCM
 * @param encrypted - The encrypted data as hex string
 * @param key - The encryption key (must be 32 bytes)
 * @param iv - The initialization vector as hex string
 * @param authTag - The authentication tag as hex string
 * @returns The decrypted data
 */
export function decryptAES(encrypted: string, key: Uint8Array, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Uint8Array.from(Buffer.from(iv, 'hex')))
    decipher.setAuthTag(Uint8Array.from(Buffer.from(authTag, 'hex')))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

/**
 * Derives an encryption key from a password using PBKDF2
 * @param password - The password to derive from
 * @param salt - The salt (should be stored alongside encrypted data)
 * @returns A 32-byte key suitable for AES-256
 */
export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
    return Uint8Array.from(crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256'))
}

/**
 * Generates a random salt for key derivation
 * @returns A 16-byte salt
 */
export function generateSalt(): Buffer {
    return crypto.randomBytes(16)
}

/**
 * Masks sensitive data for logging purposes
 * @param data - The data to mask
 * @param visibleChars - Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSensitiveData(data: string, visibleChars: number = 2): string {
    if (!data || data.length <= visibleChars * 2) {
        return '***'
    }
    return `${data.substring(0, visibleChars)}${'*'.repeat(Math.min(8, data.length - visibleChars * 2))}${data.substring(data.length - visibleChars)}`
}
