import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './activities'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', 'server', '.env') })

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default'
const TEMPORAL_TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'agentconsole-durable-workflows'

async function run() {
    console.log(`Connecting to Temporal server at ${TEMPORAL_ADDRESS}...`)

    const connection = await NativeConnection.connect({
        address: TEMPORAL_ADDRESS
    })

    const worker = await Worker.create({
        connection,
        namespace: TEMPORAL_NAMESPACE,
        taskQueue: TEMPORAL_TASK_QUEUE,
        workflowsPath: require.resolve('./workflows'),
        activities
    })

    console.log(`Temporal Worker started!`)
    console.log(`  Namespace: ${TEMPORAL_NAMESPACE}`)
    console.log(`  Task Queue: ${TEMPORAL_TASK_QUEUE}`)
    console.log(`Polling for tasks...`)

    await worker.run()
}

run().catch((err) => {
    console.error('Failed to start Temporal Worker:', err)
    process.exit(1)
})
