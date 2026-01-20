import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddPlatformAssetEntity1760000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS \`platform_asset\` (
                \`id\` varchar(36) NOT NULL,
                \`assetType\` varchar(20) NOT NULL,
                \`storagePath\` varchar(500) NOT NULL,
                \`fileName\` varchar(255) NOT NULL,
                \`mimeType\` varchar(100) NOT NULL,
                \`fileSize\` int NOT NULL,
                \`isActive\` tinyint(1) NOT NULL DEFAULT 0,
                \`createdDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedDate\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                INDEX \`IDX_platform_asset_assetType\` (\`assetType\`),
                INDEX \`IDX_platform_asset_isActive\` (\`isActive\`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`platform_asset\``)
    }
}
