import { ApplicationFailure } from '@temporalio/activity'
import nodemailer from 'nodemailer'

export interface SendEmailParams {
    to: string | string[]
    subject: string
    body: string // HTML or plain text
    from?: string // Override default sender
}

export interface SendEmailResult {
    success: boolean
    messageId?: string
    error?: string
}

// Create transporter lazily to allow for configuration at runtime
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
    if (!transporter) {
        const host = process.env.SMTP_HOST
        const port = parseInt(process.env.SMTP_PORT || '587', 10)
        const secure = process.env.SMTP_SECURE === 'true'
        const user = process.env.SMTP_USER
        const pass = process.env.SMTP_PASS

        if (!host) {
            throw ApplicationFailure.nonRetryable('SMTP_HOST environment variable is not configured')
        }

        transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: user && pass ? { user, pass } : undefined
        })
    }
    return transporter
}

/**
 * Send an email using SMTP
 *
 * Environment variables required:
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (default: 587)
 * - SMTP_SECURE: Use TLS (default: false)
 * - SMTP_USER: SMTP username (optional)
 * - SMTP_PASS: SMTP password (optional)
 * - SMTP_FROM: Default sender email address
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    const { to, subject, body, from } = params

    try {
        const transport = getTransporter()
        const defaultFrom = process.env.SMTP_FROM

        if (!from && !defaultFrom) {
            throw ApplicationFailure.nonRetryable('No sender email specified and SMTP_FROM is not configured')
        }

        const info = await transport.sendMail({
            from: from || defaultFrom,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html: body
        })

        return {
            success: true,
            messageId: info.messageId
        }
    } catch (error: any) {
        // Check for authentication errors (non-retryable)
        if (error.code === 'EAUTH' || error.responseCode === 535) {
            throw ApplicationFailure.nonRetryable(`Email authentication failed: ${error.message}`)
        }

        // Check for invalid recipient (non-retryable)
        if (error.responseCode === 550 || error.responseCode === 553) {
            throw ApplicationFailure.nonRetryable(`Invalid recipient: ${error.message}`)
        }

        // Check for configuration errors (non-retryable)
        if (error.message?.includes('SMTP_HOST') || error.message?.includes('SMTP_FROM')) {
            throw ApplicationFailure.nonRetryable(error.message)
        }

        // Connection errors are retryable
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
            throw ApplicationFailure.retryable(`Email send failed (connection error): ${error.message}`)
        }

        // Default to retryable for unknown errors
        throw ApplicationFailure.retryable(`Email send failed: ${error.message}`)
    }
}
