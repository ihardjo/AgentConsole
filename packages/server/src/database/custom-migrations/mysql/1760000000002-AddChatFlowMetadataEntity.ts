import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChatFlowMetadataEntity1760000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`chat_flow_metadata\` (
                \`id\` varchar(36) NOT NULL,
                \`chatFlowId\` varchar(36) NOT NULL,
                \`createdBy\` varchar(255) NULL,
                \`updatedBy\` varchar(255) NULL,
                \`createdDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE INDEX \`UQ_chat_flow_metadata_chatFlowId\` (\`chatFlowId\`),
                INDEX \`IDX_chat_flow_metadata_chatFlowId\` (\`chatFlowId\`),
                INDEX \`IDX_chat_flow_metadata_createdBy\` (\`createdBy\`),
                CONSTRAINT \`FK_chat_flow_metadata_chatFlowId\` FOREIGN KEY (\`chatFlowId\`) REFERENCES \`chat_flow\`(\`id\`) ON DELETE CASCADE
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`chat_flow_metadata\``)
    }
}
