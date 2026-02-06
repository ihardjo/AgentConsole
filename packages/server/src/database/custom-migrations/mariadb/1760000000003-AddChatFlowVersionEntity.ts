import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddChatFlowVersionEntity1760000000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`chat_flow_version\` (
                \`id\` varchar(36) NOT NULL,
                \`chatFlowId\` varchar(36) NOT NULL,
                \`version\` int NOT NULL,
                \`flowData\` text NOT NULL,
                \`changeDescription\` text NULL,
                \`createdBy\` varchar(255) NULL,
                \`createdDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE INDEX \`UQ_chat_flow_version_chatFlowId_version\` (\`chatFlowId\`, \`version\`),
                INDEX \`IDX_chat_flow_version_chatFlowId\` (\`chatFlowId\`),
                INDEX \`IDX_chat_flow_version_createdBy\` (\`createdBy\`),
                INDEX \`IDX_chat_flow_version_createdDate\` (\`createdDate\`),
                CONSTRAINT \`FK_chat_flow_version_chatFlowId\` FOREIGN KEY (\`chatFlowId\`) REFERENCES \`chat_flow\`(\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`chat_flow_version\``)
    }
}
