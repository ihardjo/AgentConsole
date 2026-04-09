import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDedicatedQueueToWorkspace1760000000008 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "workspace" ADD COLUMN IF NOT EXISTS "dedicatedQueue" boolean NOT NULL DEFAULT false;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace" DROP COLUMN IF EXISTS "dedicatedQueue";`)
    }
}
