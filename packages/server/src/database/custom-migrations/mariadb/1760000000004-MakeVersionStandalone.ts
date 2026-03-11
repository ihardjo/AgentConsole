import { MigrationInterface, QueryRunner } from 'typeorm'

export class MakeVersionStandalone1760000000004 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add new columns
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` ADD COLUMN \`chatFlowName\` varchar(255) NULL;`
        )
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` ADD COLUMN \`chatFlowType\` varchar(50) NULL;`
        )

        // 2. Back-fill chatFlowName and chatFlowType from the parent chatflow
        await queryRunner.query(
            `UPDATE \`chat_flow_version\` v
             INNER JOIN \`chat_flow\` cf ON cf.\`id\` = v.\`chatFlowId\`
             SET v.\`chatFlowName\` = cf.\`name\`,
                 v.\`chatFlowType\` = cf.\`type\`;`
        )

        // 3. Make chatFlowId nullable
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` MODIFY COLUMN \`chatFlowId\` varchar(36) NULL;`
        )

        // 4. Drop the CASCADE foreign key and recreate with SET NULL
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` DROP FOREIGN KEY \`FK_chat_flow_version_chatFlowId\`;`
        )
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\`
             ADD CONSTRAINT \`FK_chat_flow_version_chatFlowId\`
             FOREIGN KEY (\`chatFlowId\`) REFERENCES \`chat_flow\`(\`id\`) ON DELETE SET NULL;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Delete orphaned versions (those with NULL chatFlowId)
        await queryRunner.query(
            `DELETE FROM \`chat_flow_version\` WHERE \`chatFlowId\` IS NULL;`
        )

        // Restore CASCADE foreign key
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` DROP FOREIGN KEY \`FK_chat_flow_version_chatFlowId\`;`
        )
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\`
             ADD CONSTRAINT \`FK_chat_flow_version_chatFlowId\`
             FOREIGN KEY (\`chatFlowId\`) REFERENCES \`chat_flow\`(\`id\`) ON DELETE CASCADE;`
        )

        // Make chatFlowId NOT NULL again
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` MODIFY COLUMN \`chatFlowId\` varchar(36) NOT NULL;`
        )

        // Drop the new columns
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` DROP COLUMN \`chatFlowType\`;`
        )
        await queryRunner.query(
            `ALTER TABLE \`chat_flow_version\` DROP COLUMN \`chatFlowName\`;`
        )
    }
}
