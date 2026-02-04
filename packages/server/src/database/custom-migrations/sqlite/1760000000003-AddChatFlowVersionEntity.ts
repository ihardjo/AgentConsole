import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChatFlowVersionEntity1760000000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "chat_flow_version" (
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

        // Create indexes for faster lookups
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
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_version_createdDate";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_version_createdBy";`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_version_chatFlowId";`)
        await queryRunner.query(`DROP TABLE IF EXISTS "chat_flow_version";`)
    }
}
