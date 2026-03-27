/**
 * Resolves template placeholders in the format {{variable.path}} with values from context.
 * Supports nested paths like {{input.customerName}} or {{node_123.result.text}}
 */
export function resolveTemplate(template: string | any, context: Record<string, any>): any {
    if (template === null || template === undefined) {
        return template
    }

    if (typeof template === 'object') {
        if (Array.isArray(template)) {
            return template.map((item) => resolveTemplate(item, context))
        }
        const resolved: Record<string, any> = {}
        for (const [key, value] of Object.entries(template)) {
            resolved[key] = resolveTemplate(value, context)
        }
        return resolved
    }

    if (typeof template !== 'string') {
        return template
    }

    // Replace all {{path}} placeholders
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getNestedValue(context, path.trim())
        if (value === undefined) {
            console.warn(`Template variable not found: ${path}`)
            return match // Keep original if not found
        }
        // If the entire template is just a placeholder, return the actual value (not stringified)
        if (match === template) {
            return value
        }
        // Otherwise stringify for string concatenation
        return typeof value === 'object' ? JSON.stringify(value) : String(value)
    })
}

/**
 * Gets a nested value from an object using dot notation path.
 * Example: getNestedValue({a: {b: 1}}, 'a.b') => 1
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined
        }
        // Handle array indexing like [0]
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
        if (arrayMatch) {
            const [, key, index] = arrayMatch
            current = current[key]?.[parseInt(index, 10)]
        } else {
            current = current[part]
        }
    }

    return current
}
