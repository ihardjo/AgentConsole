import { MigrationInterface, QueryRunner } from 'typeorm'
import { ensureColumnExists } from '../../../enterprise/database/migrations/sqlite/sqlliteCustomFunctions'

export class AddDedicatedQueueToWorkspace1760000000008 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await ensureColumnExists(queryRunner, 'workspace', 'dedicatedQueue', 'INTEGER NOT NULL DEFAULT 0')
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQLite doesn't support DROP COLUMN before 3.35.0 — leave the column in place on down()
    }
}
