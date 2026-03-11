import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Add config-snapshot columns to chat_flow_version (MySQL).
 *
 * These columns mirror the corresponding columns on chat_flow so that a
 * version restore can fully reconstruct the chatflow settings, not just its
 * node graph (flowData).
 */
export class AddVersionConfigColumns1760000000006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // MySQL does not support IF NOT EXISTS for ADD COLUMN — guard via
        // information_schema check is handled by TypeORM migration runner
        // (migrations run exactly once).
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`chatbotConfig\` text NULL;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`apiConfig\` text NULL;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`analytic\` text NULL;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`category\` text NULL;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`speechToText\` text NULL;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`followUpPrompts\` text NULL;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` ADD COLUMN \`textToSpeech\` text NULL;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`textToSpeech\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`followUpPrompts\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`speechToText\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`category\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`analytic\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`apiConfig\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`chatbotConfig\`;`)
    }
}
