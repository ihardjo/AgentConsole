/**
 * Send Notification Activity
 * Multi-channel notification delivery (email, SMS, webhook)
 */

export interface NotificationInput {
    // Email configuration
    emailEnabled?: boolean
    emailTo?: string
    emailSubject?: string
    emailBody?: string
    // SMS configuration
    smsEnabled?: boolean
    smsTo?: string
    smsBody?: string
    // Webhook configuration
    webhookEnabled?: boolean
    webhookUrl?: string
    webhookMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH'
    webhookHeaders?: Record<string, string>
    webhookBody?: string
}

export interface NotificationResult {
    sent: boolean
    channels: string[]
    results: {
        email?: { success: boolean; error?: string; messageId?: string }
        sms?: { success: boolean; error?: string; messageId?: string }
        webhook?: { success: boolean; error?: string; status?: number; data?: any }
    }
    sentAt: string
}

/**
 * Send notifications through configured channels.
 * This is designed to be extensible - add actual email/SMS providers as needed.
 */
export async function sendNotification(input: NotificationInput): Promise<NotificationResult> {
    const channels: string[] = []
    const results: NotificationResult['results'] = {}

    // Email channel
    if (input.emailEnabled && input.emailTo) {
        channels.push('email')
        try {
            // For now, we'll use a placeholder that logs the email
            // In production, integrate with SendGrid, AWS SES, Nodemailer, etc.
            console.log(`[Notification] Email to: ${input.emailTo}`)
            console.log(`[Notification] Subject: ${input.emailSubject}`)
            console.log(`[Notification] Body: ${input.emailBody}`)

            // Placeholder: simulate successful send
            // Replace with actual email sending logic:
            // const response = await sendgrid.send({ to: input.emailTo, subject: input.emailSubject, text: input.emailBody })
            results.email = {
                success: true,
                messageId: `email_${Date.now()}`
            }
        } catch (error: any) {
            results.email = {
                success: false,
                error: error.message || 'Failed to send email'
            }
        }
    }

    // SMS channel
    if (input.smsEnabled && input.smsTo) {
        channels.push('sms')
        try {
            // For now, we'll use a placeholder that logs the SMS
            // In production, integrate with Twilio, AWS SNS, etc.
            console.log(`[Notification] SMS to: ${input.smsTo}`)
            console.log(`[Notification] Message: ${input.smsBody}`)

            // Placeholder: simulate successful send
            // Replace with actual SMS sending logic:
            // const response = await twilio.messages.create({ to: input.smsTo, body: input.smsBody })
            results.sms = {
                success: true,
                messageId: `sms_${Date.now()}`
            }
        } catch (error: any) {
            results.sms = {
                success: false,
                error: error.message || 'Failed to send SMS'
            }
        }
    }

    // Webhook channel
    if (input.webhookEnabled && input.webhookUrl) {
        channels.push('webhook')
        try {
            const method = input.webhookMethod || 'POST'
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                ...(input.webhookHeaders || {})
            }

            const fetchOptions: RequestInit = {
                method,
                headers
            }

            // Only add body for methods that support it
            if (['POST', 'PUT', 'PATCH'].includes(method) && input.webhookBody) {
                fetchOptions.body = input.webhookBody
            }

            const response = await fetch(input.webhookUrl, fetchOptions)
            const responseText = await response.text()

            let responseData: any
            try {
                responseData = JSON.parse(responseText)
            } catch {
                responseData = responseText
            }

            results.webhook = {
                success: response.ok,
                status: response.status,
                data: responseData,
                error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
            }
        } catch (error: any) {
            results.webhook = {
                success: false,
                error: error.message || 'Failed to send webhook'
            }
        }
    }

    // Determine overall success - at least one channel must succeed
    const anySuccess = Object.values(results).some((r) => r?.success)

    return {
        sent: anySuccess,
        channels,
        results,
        sentAt: new Date().toISOString()
    }
}
