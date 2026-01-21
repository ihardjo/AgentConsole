import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPlatformAssetEntity1760000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS platform_asset (
                id uuid NOT NULL DEFAULT uuid_generate_v4(),
                "assetType" varchar(20) NOT NULL,
                "storagePath" varchar(500) NOT NULL,
                "fileName" varchar(255) NOT NULL,
                "mimeType" varchar(100) NOT NULL,
                "fileSize" integer NOT NULL,
                "isActive" boolean NOT NULL DEFAULT false,
                "createdDate" timestamp NOT NULL DEFAULT now(),
                "updatedDate" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_platform_asset_id" PRIMARY KEY (id)
            );`
        )

        // Create indexes for faster lookups
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_platform_asset_assetType" ON platform_asset ("assetType");`
        )
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_platform_asset_isActive" ON platform_asset ("isActive");`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_platform_asset_isActive"`)
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_platform_asset_assetType"`)
        await queryRunner.query(`DROP TABLE IF EXISTS platform_asset`)
    }
}
