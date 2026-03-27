// BEWARE: This file is an intereem solution until we have a proper config strategy

import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env'), override: true })

// default config
const loggingConfig = {
    dir: process.env.LOG_PATH ?? path.join(__dirname, '..', '..', 'logs'),
    server: {
        level: process.env.LOG_LEVEL ?? 'info',
        filename: 'server.log',
        errorFilename: 'server-error.log'
    },
    express: {
        level: process.env.LOG_LEVEL ?? 'info',
        format: 'jsonl', // can't be changed currently
        filename: 'server-requests.log.jsonl' // should end with .jsonl
    }
}

// Temporal configuration
const temporalConfig = {
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'agentconsole-durable-workflows',
    webUiUrl: process.env.TEMPORAL_WEB_UI_URL ?? 'http://localhost:8080'
}

export default {
    logging: loggingConfig,
    temporal: temporalConfig
}
