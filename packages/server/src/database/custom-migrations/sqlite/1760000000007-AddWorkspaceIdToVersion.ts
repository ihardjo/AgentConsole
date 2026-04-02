import { MigrationInterface, QueryRunner } from 'typeorm'
import { ensureColumnExists } from '../../../enterprise/database/migrations/sqlite/sqlliteCustomFunctions'

export class AddWorkspaceIdToVersion1760000000007 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1 — add nullable workspaceId column (idempotent)
        await ensureColumnExists(queryRunner, 'chat_flow_version', 'workspaceId', 'TEXT')

        // Step 2 — backfill from the parent chat_flow table
        await queryRunner.query(`
            UPDATE "chat_flow_version"
            SET "workspaceId" = (
                SELECT cf."workspaceId"
                FROM "chat_flow" cf
                WHERE cf."id" = "chat_flow_version"."chatFlowId"
            )
            WHERE "workspaceId" IS NULL;
        `)

        // Step 3 — index for fast workspace-scoped queries
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_workspaceId" ON "chat_flow_version" ("workspaceId");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_version_workspaceId";`)
        // SQLite doesn't support DROP COLUMN before 3.35.0 — recreate table approach
        // For simplicity, leave the column in place on down() since it's nullable
    }
}
