import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChatFlowMetadataEntity1760000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS chat_flow_metadata (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "chatFlowId" uuid NOT NULL,
                "createdBy" varchar(255),
                "updatedBy" varchar(255),
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_chat_flow_metadata_id" PRIMARY KEY (id),
                CONSTRAINT "FK_chat_flow_metadata_chatFlowId" FOREIGN KEY ("chatFlowId") REFERENCES chat_flow(id) ON DELETE CASCADE,
                CONSTRAINT "UQ_chat_flow_metadata_chatFlowId" UNIQUE ("chatFlowId")
            );`
        )

        // Create indexes for faster lookups
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_metadata_chatFlowId" ON chat_flow_metadata ("chatFlowId");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_chat_flow_metadata_createdBy" ON chat_flow_metadata ("createdBy");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_metadata_createdBy"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chat_flow_metadata_chatFlowId"`)
        await queryRunner.query(`DROP TABLE IF EXISTS chat_flow_metadata`)
    }
}
