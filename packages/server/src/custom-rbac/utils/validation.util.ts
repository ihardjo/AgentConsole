/**
 * Custom RBAC - Validation Utilities
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

// UUID v4 regex pattern
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// General UUID regex (more permissive)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Email regex pattern (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Validates if a string is a valid UUID
 * @param id - The string to validate
 * @returns true if the string is NOT a valid UUID (invalid)
 */
export function isInvalidUUID(id: string | undefined | null): boolean {
    if (!id || typeof id !== 'string') return true
    return !UUID_REGEX.test(id.trim())
}

/**
 * Validates if a string is a valid UUID v4
 * @param id - The string to validate
 * @returns true if the string is a valid UUID v4
 */
export function isValidUUIDv4(id: string | undefined | null): boolean {
    if (!id || typeof id !== 'string') return false
    return UUID_V4_REGEX.test(id.trim())
}

/**
 * Validates if a string is a valid email address
 * @param email - The string to validate
 * @returns true if the string is NOT a valid email (invalid)
 */
export function isInvalidEmail(email: string | undefined | null): boolean {
    if (!email || typeof email !== 'string') return true
    const trimmedEmail = email.trim()
    if (trimmedEmail.length === 0 || trimmedEmail.length > 255) return true
    return !EMAIL_REGEX.test(trimmedEmail)
}

/**
 * Validates if a name is valid
 * Name must be 1-100 characters, not empty or just whitespace
 * @param name - The string to validate
 * @returns true if the name is NOT valid (invalid)
 */
export function isInvalidName(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') return true
    const trimmedName = name.trim()
    return trimmedName.length === 0 || trimmedName.length > 100
}

/**
 * Validates password strength
 * Password must be at least 8 characters with at least one letter and one number
 * @param password - The password to validate
 * @returns true if the password is NOT valid (invalid)
 */
export function isInvalidPassword(password: string | undefined | null): boolean {
    if (!password || typeof password !== 'string') return true
    if (password.length < 8 || password.length > 128) return true
    // At least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    return !(hasLetter && hasNumber)
}

/**
 * Validates if a description is valid
 * Description can be empty but must be under 500 characters if provided
 * @param description - The string to validate
 * @returns true if the description is NOT valid (invalid)
 */
export function isInvalidDescription(description: string | undefined | null): boolean {
    if (description === undefined || description === null) return false // Optional field
    if (typeof description !== 'string') return true
    return description.length > 500
}

/**
 * Validates if a string is a valid JSON
 * @param jsonString - The string to validate
 * @returns true if the string is NOT valid JSON (invalid)
 */
export function isInvalidJSON(jsonString: string | undefined | null): boolean {
    if (!jsonString || typeof jsonString !== 'string') return true
    try {
        JSON.parse(jsonString)
        return false
    } catch {
        return true
    }
}

/**
 * Sanitizes a string by removing potentially dangerous characters
 * @param input - The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeString(input: string | undefined | null): string {
    if (!input || typeof input !== 'string') return ''
    // Remove null bytes and trim
    return input.replace(/\0/g, '').trim()
}

/**
 * Validates if a permissions string is valid
 * Must be a valid JSON array of strings
 * @param permissions - The permissions string to validate
 * @returns true if permissions is NOT valid (invalid)
 */
export function isInvalidPermissions(permissions: string | undefined | null): boolean {
    if (!permissions || typeof permissions !== 'string') return true
    try {
        const parsed = JSON.parse(permissions)
        if (!Array.isArray(parsed)) return true
        return parsed.some((item) => typeof item !== 'string')
    } catch {
        return true
    }
}

/**
 * Validates if a status value is valid for a given enum
 * @param status - The status value to validate
 * @param validStatuses - Array of valid status values
 * @returns true if status is NOT valid (invalid)
 */
export function isInvalidStatus(status: string | undefined | null, validStatuses: string[]): boolean {
    if (!status || typeof status !== 'string') return true
    return !validStatuses.includes(status)
}

/**
 * Validates if a date string is valid
 * @param dateString - The date string to validate
 * @returns true if the date is NOT valid (invalid)
 */
export function isInvalidDate(dateString: string | undefined | null): boolean {
    if (!dateString || typeof dateString !== 'string') return true
    const date = new Date(dateString)
    return isNaN(date.getTime())
}

/**
 * Normalizes an email address (lowercase and trim)
 * @param email - The email to normalize
 * @returns The normalized email
 */
export function normalizeEmail(email: string | undefined | null): string {
    if (!email || typeof email !== 'string') return ''
    return email.trim().toLowerCase()
}
