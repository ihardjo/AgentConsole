import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Remove the foreign-key constraint between chat_flow_version.chatFlowId
 * and chat_flow.id.
 *
 * Previously the FK had ON DELETE SET NULL, which nulled chatFlowId when a
 * parent chatflow was deleted — making it impossible to restore the flow at
 * the same UUID.  With no FK at all, the DB never touches chatFlowId on
 * delete, and the application layer handles orphan detection by comparing
 * chatFlowId against the set of active chat_flow rows.
 *
 * SQLite does not support DROP CONSTRAINT, so the table must be recreated.
 */
export class RemoveVersionForeignKey1760000000005 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create new table without the FK constraint
        await queryRunner.query(
            `CREATE TABLE "chat_flow_version_new" (
                "id" varchar PRIMARY KEY NOT NULL,
                "chatFlowId" varchar NULL,
                "version" integer NOT NULL,
                "flowData" text NOT NULL,
                "changeDescription" text,
                "chatFlowName" varchar(255),
                "chatFlowType" varchar(50),
                "createdBy" varchar(255),
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now')),
                CONSTRAINT "UQ_chat_flow_version_chatFlowId_version" UNIQUE ("chatFlowId", "version")
            );`
        )

        // 2. Copy all data as-is (chatFlowId values preserved)
        await queryRunner.query(
            `INSERT INTO "chat_flow_version_new"
                ("id", "chatFlowId", "version", "flowData", "changeDescription",
                 "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate")
            SELECT
                "id", "chatFlowId", "version", "flowData", "changeDescription",
                "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate"
            FROM "chat_flow_version";`
        )

        // 3. Drop old table and rename
        await queryRunner.query(`DROP TABLE "chat_flow_version";`)
        await queryRunner.query(`ALTER TABLE "chat_flow_version_new" RENAME TO "chat_flow_version";`)

        // 4. Recreate indexes
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_chatFlowId" ON "chat_flow_version" ("chatFlowId");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_createdBy" ON "chat_flow_version" ("createdBy");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_createdDate" ON "chat_flow_version" ("createdDate");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the SET NULL foreign key (previous behaviour)
        await queryRunner.query(
            `CREATE TABLE "chat_flow_version_fk" (
                "id" varchar PRIMARY KEY NOT NULL,
                "chatFlowId" varchar NULL,
                "version" integer NOT NULL,
                "flowData" text NOT NULL,
                "changeDescription" text,
                "chatFlowName" varchar(255),
                "chatFlowType" varchar(50),
                "createdBy" varchar(255),
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now')),
                CONSTRAINT "UQ_chat_flow_version_chatFlowId_version" UNIQUE ("chatFlowId", "version"),
                CONSTRAINT "FK_chat_flow_version_chatFlowId" FOREIGN KEY ("chatFlowId") REFERENCES "chat_flow"("id") ON DELETE SET NULL
            );`
        )

        await queryRunner.query(
            `INSERT INTO "chat_flow_version_fk"
                ("id", "chatFlowId", "version", "flowData", "changeDescription",
                 "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate")
            SELECT
                "id", "chatFlowId", "version", "flowData", "changeDescription",
                "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate"
            FROM "chat_flow_version";`
        )

        await queryRunner.query(`DROP TABLE "chat_flow_version";`)
        await queryRunner.query(`ALTER TABLE "chat_flow_version_fk" RENAME TO "chat_flow_version";`)

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_chatFlowId" ON "chat_flow_version" ("chatFlowId");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_createdBy" ON "chat_flow_version" ("createdBy");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_version_createdDate" ON "chat_flow_version" ("createdDate");`
        )
    }
}
