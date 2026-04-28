/**
 * Execute SubWorkflow Activity
 * Starts a child workflow and optionally waits for completion
 */

import { Client, Connection } from '@temporalio/client'

export interface SubWorkflowInput {
    workflowId: string
    workspaceId: string
    input?: Record<string, any>
    waitForCompletion?: boolean
    timeout?: number // milliseconds
}

export interface SubWorkflowResult {
    workflowId: string
    runId: string
    result?: any
    status: 'started' | 'completed' | 'failed' | 'timeout'
    completedAt: string
    error?: string
}

/**
 * Execute a child workflow.
 * Can either fire-and-forget or wait for completion.
 */
export async function executeSubWorkflow(input: SubWorkflowInput): Promise<SubWorkflowResult> {
    const { workflowId, workspaceId, input: workflowInput = {}, waitForCompletion = true, timeout } = input

    // Connect to Temporal
    const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    })

    const client = new Client({ connection })

    try {
        // Generate a unique child workflow ID
        const childWorkflowId = `child-${workflowId}-${Date.now()}`

        // Start the child workflow
        const handle = await client.workflow.start('durableWorkflowExecutor', {
            taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'flowise-temporal-queue',
            workflowId: childWorkflowId,
            args: [
                {
                    flowId: workflowId,
                    workspaceId,
                    input: workflowInput
                }
            ]
        })

        // If not waiting for completion, return immediately
        if (!waitForCompletion) {
            return {
                workflowId: handle.workflowId,
                runId: handle.firstExecutionRunId,
                status: 'started',
                completedAt: new Date().toISOString()
            }
        }

        // Wait for completion with optional timeout
        try {
            let result: any

            if (timeout && timeout > 0) {
                // Wait with timeout
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('SubWorkflow timeout')), timeout)
                })

                result = await Promise.race([handle.result(), timeoutPromise])
            } else {
                // Wait indefinitely
                result = await handle.result()
            }

            return {
                workflowId: handle.workflowId,
                runId: handle.firstExecutionRunId,
                result,
                status: result?.success ? 'completed' : 'failed',
                completedAt: new Date().toISOString(),
                error: result?.error
            }
        } catch (error: any) {
            if (error.message === 'SubWorkflow timeout') {
                return {
                    workflowId: handle.workflowId,
                    runId: handle.firstExecutionRunId,
                    status: 'timeout',
                    completedAt: new Date().toISOString(),
                    error: 'SubWorkflow execution timeout'
                }
            }

            return {
                workflowId: handle.workflowId,
                runId: handle.firstExecutionRunId,
                status: 'failed',
                completedAt: new Date().toISOString(),
                error: error.message || 'Unknown error'
            }
        }
    } finally {
        await connection.close()
    }
}
