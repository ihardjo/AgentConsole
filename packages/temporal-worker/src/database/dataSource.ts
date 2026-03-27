import 'reflect-metadata'
import { DataSource } from 'typeorm'

let dataSource: DataSource | null = null

/**
 * Gets or creates a database connection for the Temporal Worker.
 * Used for fetching flow definitions and API keys directly from the database.
 */
export async function getDataSource(): Promise<DataSource> {
    if (dataSource?.isInitialized) {
        return dataSource
    }

    const dbType = (process.env.DATABASE_TYPE || 'postgres') as 'postgres' | 'mysql' | 'mariadb' | 'sqlite'

    const baseConfig = {
        synchronize: false,
        logging: process.env.LOG_LEVEL === 'debug'
    }

    if (dbType === 'sqlite') {
        dataSource = new DataSource({
            ...baseConfig,
            type: 'sqlite',
            database: process.env.DATABASE_PATH || ':memory:'
        })
    } else {
        dataSource = new DataSource({
            ...baseConfig,
            type: dbType,
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || (dbType === 'postgres' ? '5432' : '3306')),
            username: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            ssl: process.env.DATABASE_SSL === 'true' ? true : undefined
        })
    }

    await dataSource.initialize()
    console.log('Database connection established')

    return dataSource
}

/**
 * Closes the database connection gracefully.
 * Should be called when the worker shuts down.
 */
export async function closeDataSource(): Promise<void> {
    if (dataSource?.isInitialized) {
        await dataSource.destroy()
        dataSource = null
        console.log('Database connection closed')
    }
}
