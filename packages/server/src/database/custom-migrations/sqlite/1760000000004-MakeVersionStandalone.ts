import { MigrationInterface, QueryRunner } from 'typeorm'

export class MakeVersionStandalone1760000000004 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // SQLite does not support ALTER COLUMN or ALTER CONSTRAINT, so we must
        // recreate the table with the new schema and copy data over.

        // 1. Create new table with updated schema
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
                CONSTRAINT "UQ_chat_flow_version_chatFlowId_version" UNIQUE ("chatFlowId", "version"),
                CONSTRAINT "FK_chat_flow_version_chatFlowId" FOREIGN KEY ("chatFlowId") REFERENCES "chat_flow"("id") ON DELETE SET NULL
            );`
        )

        // 2. Copy data (populate chatFlowName/chatFlowType from joined chat_flow)
        await queryRunner.query(
            `INSERT INTO "chat_flow_version_new"
                ("id", "chatFlowId", "version", "flowData", "changeDescription",
                 "chatFlowName", "chatFlowType", "createdBy", "createdDate", "updatedDate")
            SELECT
                v."id", v."chatFlowId", v."version", v."flowData", v."changeDescription",
                cf."name", cf."type", v."createdBy", v."createdDate", v."updatedDate"
            FROM "chat_flow_version" v
            LEFT JOIN "chat_flow" cf ON cf."id" = v."chatFlowId";`
        )

        // 3. Drop old table
        await queryRunner.query(`DROP TABLE "chat_flow_version";`)

        // 4. Rename new table
        await queryRunner.query(`ALTER TABLE "chat_flow_version_new" RENAME TO "chat_flow_version";`)

        // 5. Recreate indexes
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
        // Reverse: recreate the original table schema
        await queryRunner.query(
            `CREATE TABLE "chat_flow_version_old" (
                "id" varchar PRIMARY KEY NOT NULL,
                "chatFlowId" varchar NOT NULL,
                "version" integer NOT NULL,
                "flowData" text NOT NULL,
                "changeDescription" text,
                "createdBy" varchar(255),
                "createdDate" datetime NOT NULL DEFAULT (datetime('now')),
                "updatedDate" datetime NOT NULL DEFAULT (datetime('now')),
                CONSTRAINT "UQ_chat_flow_version_chatFlowId_version" UNIQUE ("chatFlowId", "version"),
                CONSTRAINT "FK_chat_flow_version_chatFlowId" FOREIGN KEY ("chatFlowId") REFERENCES "chat_flow"("id") ON DELETE CASCADE
            );`
        )

        await queryRunner.query(
            `INSERT INTO "chat_flow_version_old"
                ("id", "chatFlowId", "version", "flowData", "changeDescription",
                 "createdBy", "createdDate", "updatedDate")
            SELECT
                "id", "chatFlowId", "version", "flowData", "changeDescription",
                "createdBy", "createdDate", "updatedDate"
            FROM "chat_flow_version"
            WHERE "chatFlowId" IS NOT NULL;`
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
