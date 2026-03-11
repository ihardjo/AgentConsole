import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add config-snapshot columns to chat_flow_version (PostgreSQL).
 *
 * These columns mirror the corresponding columns on chat_flow so that a
 * version restore can fully reconstruct the chatflow settings, not just its
 * node graph (flowData).
 */
export class AddVersionConfigColumns1760000000006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "chatbotConfig" text;`)
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "apiConfig" text;`)
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "analytic" text;`)
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "category" text;`)
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "speechToText" text;`)
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "followUpPrompts" text;`)
        await queryRunner.query(`ALTER TABLE chat_flow_version ADD COLUMN IF NOT EXISTS "textToSpeech" text;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "textToSpeech";`)
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "followUpPrompts";`)
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "speechToText";`)
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "category";`)
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "analytic";`)
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "apiConfig";`)
        await queryRunner.query(`ALTER TABLE chat_flow_version DROP COLUMN IF EXISTS "chatbotConfig";`)
    }
}
