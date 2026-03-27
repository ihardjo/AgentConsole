/**
 * Evaluates condition expressions for Condition nodes.
 * Supports basic comparison operators: ==, !=, >, <, >=, <=
 * Also supports: contains, startsWith, endsWith, isNull, isNotNull
 */
export function evaluateExpression(expression: string, context: Record<string, any>): boolean {
    // First resolve any template variables in the expression
    const resolvedExpression = resolveTemplateVariables(expression, context)

    // Parse and evaluate the expression
    try {
        return parseAndEvaluate(resolvedExpression, context)
    } catch (error: any) {
        console.error(`Failed to evaluate expression: ${expression}`, error)
        return false
    }
}

/**
 * Resolves template variables in expression strings
 */
function resolveTemplateVariables(expression: string, context: Record<string, any>): string {
    return expression.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const value = getNestedValue(context, path.trim())
        if (value === undefined || value === null) {
            return 'null'
        }
        if (typeof value === 'string') {
            return `"${value}"`
        }
        if (typeof value === 'object') {
            return JSON.stringify(value)
        }
        return String(value)
    })
}

/**
 * Parses and evaluates a simple comparison expression
 */
function parseAndEvaluate(expression: string, context: Record<string, any>): boolean {
    const trimmed = expression.trim()

    // Handle boolean literals
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false

    // Handle isNull/isNotNull
    if (trimmed.endsWith(' isNull')) {
        const varPath = trimmed.replace(' isNull', '').trim()
        const value = getValueOrLiteral(varPath, context)
        return value === null || value === undefined
    }
    if (trimmed.endsWith(' isNotNull')) {
        const varPath = trimmed.replace(' isNotNull', '').trim()
        const value = getValueOrLiteral(varPath, context)
        return value !== null && value !== undefined
    }

    // Handle contains
    if (trimmed.includes(' contains ')) {
        const [left, right] = trimmed.split(' contains ').map((s) => s.trim())
        const leftVal = getValueOrLiteral(left, context)
        const rightVal = getValueOrLiteral(right, context)
        if (typeof leftVal === 'string' && typeof rightVal === 'string') {
            return leftVal.includes(rightVal)
        }
        if (Array.isArray(leftVal)) {
            return leftVal.includes(rightVal)
        }
        return false
    }

    // Handle startsWith
    if (trimmed.includes(' startsWith ')) {
        const [left, right] = trimmed.split(' startsWith ').map((s) => s.trim())
        const leftVal = String(getValueOrLiteral(left, context))
        const rightVal = String(getValueOrLiteral(right, context))
        return leftVal.startsWith(rightVal)
    }

    // Handle endsWith
    if (trimmed.includes(' endsWith ')) {
        const [left, right] = trimmed.split(' endsWith ').map((s) => s.trim())
        const leftVal = String(getValueOrLiteral(left, context))
        const rightVal = String(getValueOrLiteral(right, context))
        return leftVal.endsWith(rightVal)
    }

    // Handle comparison operators
    const operators = ['===', '!==', '==', '!=', '>=', '<=', '>', '<']
    for (const op of operators) {
        if (trimmed.includes(op)) {
            const [left, right] = trimmed.split(op).map((s) => s.trim())
            const leftVal = getValueOrLiteral(left, context)
            const rightVal = getValueOrLiteral(right, context)

            switch (op) {
                case '===':
                    return leftVal === rightVal
                case '!==':
                    return leftVal !== rightVal
                case '==':
                    return leftVal == rightVal
                case '!=':
                    return leftVal != rightVal
                case '>=':
                    return leftVal >= rightVal
                case '<=':
                    return leftVal <= rightVal
                case '>':
                    return leftVal > rightVal
                case '<':
                    return leftVal < rightVal
            }
        }
    }

    // If no operator found, try to evaluate as truthy/falsy
    const value = getValueOrLiteral(trimmed, context)
    return Boolean(value)
}

/**
 * Gets a value either as a literal or from context
 */
function getValueOrLiteral(str: string, context: Record<string, any>): any {
    const trimmed = str.trim()

    // String literal
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1)
    }

    // Number literal
    if (!isNaN(Number(trimmed)) && trimmed !== '') {
        return Number(trimmed)
    }

    // Boolean literal
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false

    // Null literal
    if (trimmed === 'null') return null

    // Otherwise treat as context path
    return getNestedValue(context, trimmed)
}

/**
 * Gets a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined
        }
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
