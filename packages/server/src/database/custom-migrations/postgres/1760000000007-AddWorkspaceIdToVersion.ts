import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceIdToVersion1760000000007 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1 — add nullable workspaceId column
        await queryRunner.query(
            `ALTER TABLE "chat_flow_version" ADD COLUMN IF NOT EXISTS "workspaceId" varchar;`
        )

        // Step 2 — backfill from the parent chat_flow table
        await queryRunner.query(`
            UPDATE "chat_flow_version" v
            SET "workspaceId" = cf."workspaceId"
            FROM "chat_flow" cf
            WHERE v."chatFlowId" = cf."id"
              AND v."workspaceId" IS NULL;
        `)

        // Step 3 — index for fast workspace-scoped queries
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_workspaceId" ON "chat_flow_version" ("workspaceId");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_version_workspaceId";`)
        await queryRunner.query(`ALTER TABLE "chat_flow_version" DROP COLUMN IF EXISTS "workspaceId";`)
    }
}
