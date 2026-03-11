import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add config-snapshot columns to chat_flow_version (SQLite).
 *
 * These columns mirror the corresponding columns on chat_flow so that a
 * version restore can fully reconstruct the chatflow settings, not just its
 * node graph (flowData).
 *
 * SQLite does not support ADD COLUMN for columns with UNIQUE constraints or
 * the recreation requirements here; we recreate the table to add the new
 * nullable text columns cleanly.
 */
export class AddVersionConfigColumns1760000000006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create new table with the 7 extra columns
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
                "chatbotConfig" text,
                "apiConfig" text,
                "analytic" text,
                "category" text,
                "speechToText" text,
                "followUpPrompts" text,
                "textToSpeech" text,
                CONSTRAINT "UQ_chat_flow_version_chatFlowId_version" UNIQUE ("chatFlowId", "version")
            );`
        )

        // 2. Copy existing data; new columns default to NULL
        await queryRunner.query(
            `INSERT INTO "chat_flow_version_new"
                ("id", "chatFlowId", "version", "flowData", "changeDescription",
                 "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate")
            SELECT
                "id", "chatFlowId", "version", "flowData", "changeDescription",
                "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate"
            FROM "chat_flow_version";`
        )

        // 3. Replace old table
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
        // Recreate table without the 7 config columns
        await queryRunner.query(
            `CREATE TABLE "chat_flow_version_old" (
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

        await queryRunner.query(
            `INSERT INTO "chat_flow_version_old"
                ("id", "chatFlowId", "version", "flowData", "changeDescription",
                 "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate")
            SELECT
                "id", "chatFlowId", "version", "flowData", "changeDescription",
                "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate"
            FROM "chat_flow_version";`
        )

        await queryRunner.query(`DROP TABLE "chat_flow_version";`)
        await queryRunner.query(`ALTER TABLE "chat_flow_version_old" RENAME TO "chat_flow_version";`)

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
