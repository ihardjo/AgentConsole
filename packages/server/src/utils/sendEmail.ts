import * as handlebars from 'handlebars'
import axios from 'axios'
import fs from 'node:fs'
import path from 'path'
import { Platform } from '../Interface'

// SendGrid Configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_MAIL_FROM || process.env.SENDER_EMAIL || '"FlowiseAI Team" <team@mail.flowiseai.com>'
const SENDGRID_SANDBOX_ENABLED = process.env.SENDGRID_SANDBOX_ENABLED === 'true'
const SKIP_EMAIL = process.env.SKIP_EMAIL_SENDING === 'true'

// Check if SendGrid is configured
const isSendGridConfigured = !!SENDGRID_API_KEY

const logEmailSkip = (type: string, email: string) => {
    console.log(`[EMAIL SKIPPED] ${type} email would be sent to: ${email}`)
    if (!isSendGridConfigured && !SKIP_EMAIL) {
        console.warn(
            'SendGrid is not configured. Set SENDGRID_API_KEY in .env file, or set SKIP_EMAIL_SENDING=true to suppress this warning.'
        )
    }
}

/**
 * Send email using SendGrid API
 */
const sendEmailViaSendGrid = async (to: string, subject: string, textContent: string, htmlContent: string) => {
    if (!isSendGridConfigured) {
        throw new Error('SendGrid API key is not configured')
    }

    const payload = {
        personalizations: [
            {
                to: [{ email: to }],
                subject
            }
        ],
        from: {
            email: SENDGRID_FROM_EMAIL.includes('<')
                ? SENDGRID_FROM_EMAIL.match(/<(.+)>/)?.[1] || SENDGRID_FROM_EMAIL
                : SENDGRID_FROM_EMAIL,
            name: SENDGRID_FROM_EMAIL.includes('<') ? SENDGRID_FROM_EMAIL.match(/^"?(.+?)"?\s*</)?.[1] : undefined
        },
        content: [
            {
                type: 'text/plain',
                value: textContent
            },
            {
                type: 'text/html',
                value: htmlContent
            }
        ],
        mail_settings: {
            sandbox_mode: {
                enable: SENDGRID_SANDBOX_ENABLED
            }
        }
    }

    try {
        await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
            headers: {
                Authorization: `Bearer ${SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            }
        })
        console.log(`[EMAIL SENT] ${subject} to ${to}`)
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error.response?.data || error.message)
            throw new Error(`SendGrid API error: ${error.response?.data?.errors?.[0]?.message || error.message}`)
        }
        throw error
    }
}

const getEmailTemplate = (defaultTemplateName: string, userTemplatePath?: string) => {
    try {
        if (userTemplatePath) {
            return fs.readFileSync(userTemplatePath, 'utf8')
        }
    } catch (error) {
        console.warn(`Failed to load custom template from ${userTemplatePath}, falling back to default`)
    }
    return fs.readFileSync(path.join(__dirname, '../enterprise', 'emails', defaultTemplateName), 'utf8')
}

const sendWorkspaceAdd = async (email: string, workspaceName: string, dashboardLink: string, inviterName?: string) => {
    if (!isSendGridConfigured || SKIP_EMAIL) {
        logEmailSkip('Workspace Add', email)
        return
    }

    // Use the workspace_add_open_source.html template
    const templatePath = path.join(__dirname, '../emails', 'workspace_add_open_source.html')
    const template = fs.readFileSync(templatePath, 'utf8')
    
    // Replace template variables
    const htmlToSend = template
        .replaceAll('{{inviterName}}', inviterName || 'Administrator')
        .replaceAll('{{workspaceName}}', workspaceName)
        .replaceAll('{{dashboardLink}}', dashboardLink)

    const textContent = `You have been added to ${workspaceName}. Click here to visit your dashboard: ${dashboardLink}`

    await sendEmailViaSendGrid(email, `You have been added to ${workspaceName}`, textContent, htmlToSend)
}

const sendWorkspaceInvite = async (
    email: string,
    workspaceName: string,
    registerLink: string,
    platform: Platform = Platform.ENTERPRISE,
    inviteType: 'new' | 'update' = 'new',
    inviterName?: string,
    organizationName?: string,
    tempToken?: string
) => {
    if (!isSendGridConfigured || SKIP_EMAIL) {
        logEmailSkip('Workspace Invite', email)
        return
    }

    // Use the workspace_invite_open_source.html template
    const templatePath = path.join(__dirname, '../emails', 'workspace_invite_open_source.html')
    const template = fs.readFileSync(templatePath, 'utf8')
    
    // Replace template variables
    const htmlToSend = template
        .replaceAll('{{inviterName}}', inviterName || 'Administrator')
        .replaceAll('{{organizationName}}', organizationName || workspaceName)
        .replaceAll('{{workspaceName}}', workspaceName)
        .replaceAll('{{registerLink}}', registerLink)

    const textContent = `${inviterName || 'Administrator'} with ${organizationName || workspaceName} has invited you to join workspace ${workspaceName}. Click here to register: ${registerLink}`

    await sendEmailViaSendGrid(email, `You have been invited to ${workspaceName}`, textContent, htmlToSend)
}

const sendPasswordResetEmail = async (email: string, resetLink: string) => {
    if (!isSendGridConfigured || SKIP_EMAIL) {
        logEmailSkip('Password Reset', email)
        return
    }

    const passwordResetTemplateSource = fs.readFileSync(
        path.join(__dirname, '../enterprise', 'emails', 'workspace_user_reset_password.hbs'),
        'utf8'
    )
    const compiledPasswordResetTemplateSource = handlebars.compile(passwordResetTemplateSource)
    const htmlToSend = compiledPasswordResetTemplateSource({ resetLink })
    const textContent = `You requested a link to reset your password. Click here to reset the password: ${resetLink}`

    await sendEmailViaSendGrid(email, 'Reset your password', textContent, htmlToSend)
}

const sendVerificationEmailForCloud = async (email: string, verificationLink: string) => {
    if (!isSendGridConfigured || SKIP_EMAIL) {
        logEmailSkip('Email Verification', email)
        return
    }

    const template = getEmailTemplate('verify_email_cloud.hbs')
    const compiledWorkspaceInviteTemplateSource = handlebars.compile(template)
    const htmlToSend = compiledWorkspaceInviteTemplateSource({ verificationLink })
    const textContent = `To complete your registration, we need to verify your email address. Click here to verify your email address: ${verificationLink}`

    await sendEmailViaSendGrid(email, 'Action Required: Please verify your email', textContent, htmlToSend)
}

export { sendWorkspaceAdd, sendWorkspaceInvite, sendPasswordResetEmail, sendVerificationEmailForCloud }

