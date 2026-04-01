import { Parser } from 'expr-eval'

/**
 * Expression evaluator using expr-eval library.
 * Supports compound conditions (&&, ||), parentheses, ternary operators,
 * math operations, and custom helper functions.
 */

// Create parser instance
const parser = new Parser()

// Register custom functions for backward compatibility and convenience
parser.functions.contains = (str: string, substr: string): boolean => {
    if (typeof str === 'string' && typeof substr === 'string') {
        return str.includes(substr)
    }
    if (Array.isArray(str)) {
        return str.includes(substr)
    }
    return false
}

parser.functions.startsWith = (str: string, prefix: string): boolean => {
    return typeof str === 'string' && typeof prefix === 'string' && str.startsWith(prefix)
}

parser.functions.endsWith = (str: string, suffix: string): boolean => {
    return typeof str === 'string' && typeof suffix === 'string' && str.endsWith(suffix)
}

parser.functions.isNull = (val: any): boolean => {
    return val === null || val === undefined
}

parser.functions.isNotNull = (val: any): boolean => {
    return val !== null && val !== undefined
}

parser.functions.lower = (str: string): string => {
    return typeof str === 'string' ? str.toLowerCase() : str
}

parser.functions.upper = (str: string): string => {
    return typeof str === 'string' ? str.toUpperCase() : str
}

parser.functions.length = (val: any): number => {
    if (Array.isArray(val)) {
        return val.length
    }
    if (typeof val === 'string') {
        return val.length
    }
    return 0
}

/**
 * Transforms an expression to be compatible with expr-eval.
 * - Strips {{ }} from variable references
 * - Converts && to 'and' and || to 'or' (expr-eval syntax)
 * - Converts === to == and !== to != (expr-eval doesn't support ===)
 */
function transformExpression(expression: string): string {
    let transformed = expression

    // Strip {{ }} from variable references
    transformed = transformed.replace(/\{\{([^}]+)\}\}/g, (_, path) => path.trim())

    // Convert JavaScript operators to expr-eval operators
    // Note: Must replace && before & and || before |
    transformed = transformed.replace(/&&/g, ' and ')
    transformed = transformed.replace(/\|\|/g, ' or ')
    transformed = transformed.replace(/===/g, '==')
    transformed = transformed.replace(/!==/g, '!=')

    return transformed
}

/**
 * Evaluates condition expressions for Condition nodes.
 *
 * Supports:
 * - Logical operators: && (and), || (or), ! (not)
 * - Comparison operators: ==, !=, >, <, >=, <=
 * - Parentheses for grouping: (a > 1) && (b < 2)
 * - Ternary operator: a > b ? "yes" : "no"
 * - Math operators: +, -, *, /, %
 * - Custom functions: contains, startsWith, endsWith, isNull, isNotNull, lower, upper, length
 *
 * @param expression - The expression to evaluate (may contain {{variable}} syntax)
 * @param context - The context object containing variables
 * @returns The boolean result of the expression
 */
export function evaluateExpression(expression: string, context: Record<string, any>): boolean {
    const transformed = transformExpression(expression)

    try {
        const expr = parser.parse(transformed)
        const result = expr.evaluate(context)
        return Boolean(result)
    } catch (error: any) {
        console.error(`Failed to evaluate expression: ${expression}`, error)
        return false
    }
}
