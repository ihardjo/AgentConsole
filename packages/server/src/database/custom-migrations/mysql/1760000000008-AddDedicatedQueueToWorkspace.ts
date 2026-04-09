import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDedicatedQueueToWorkspace1760000000008 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('workspace')
        if (table && !table.findColumnByName('dedicatedQueue')) {
            await queryRunner.query(
                `ALTER TABLE \`workspace\` ADD COLUMN \`dedicatedQueue\` tinyint(1) NOT NULL DEFAULT 0;`
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`workspace\` DROP COLUMN \`dedicatedQueue\`;`)
    }
}
