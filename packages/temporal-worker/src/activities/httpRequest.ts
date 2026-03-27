import axios, { AxiosRequestConfig, Method } from 'axios'
import { ApplicationFailure } from '@temporalio/activity'

export interface HttpRequestParams {
    url: string
    method: Method
    headers?: Record<string, string>
    body?: any
    timeout?: number
}

export interface HttpRequestResult {
    status: number
    statusText: string
    headers: Record<string, string>
    data: any
}

/**
 * Makes HTTP requests to external APIs.
 * This activity enables workflows to integrate with external services.
 */
export async function httpRequest(params: HttpRequestParams): Promise<HttpRequestResult> {
    const { url, method, headers, body, timeout = 30000 } = params

    const config: AxiosRequestConfig = {
        url,
        method,
        headers: headers || {},
        timeout
    }

    // Add body for methods that support it
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        config.data = body
    }

    try {
        const response = await axios(config)

        return {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers as Record<string, string>,
            data: response.data
        }
    } catch (error: any) {
        if (error.response) {
            // Server responded with error status - return it as data
            return {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers as Record<string, string>,
                data: error.response.data
            }
        } else if (error.code === 'ECONNABORTED') {
            throw ApplicationFailure.retryable(`HTTP request timed out after ${timeout}ms`)
        } else if (error.code === 'ECONNREFUSED') {
            throw ApplicationFailure.retryable(`Connection refused: ${url}`)
        } else {
            throw ApplicationFailure.retryable(`HTTP request failed: ${error.message}`)
        }
    }
}
