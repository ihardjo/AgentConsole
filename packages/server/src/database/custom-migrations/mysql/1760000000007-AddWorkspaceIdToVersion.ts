import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddWorkspaceIdToVersion1760000000007 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1 — add nullable workspaceId column (idempotent check)
        const table = await queryRunner.getTable('chat_flow_version')
        if (table && !table.findColumnByName('workspaceId')) {
            await queryRunner.query(
                `ALTER TABLE \`chat_flow_version\` ADD COLUMN \`workspaceId\` varchar(36) NULL;`
            )
        }

        // Step 2 — backfill from the parent chat_flow table
        await queryRunner.query(`
            UPDATE \`chat_flow_version\` v
            INNER JOIN \`chat_flow\` cf ON v.\`chatFlowId\` = cf.\`id\`
            SET v.\`workspaceId\` = cf.\`workspaceId\`
            WHERE v.\`workspaceId\` IS NULL;
        `)

        // Step 3 — index for fast workspace-scoped queries
        const hasIndex = table?.indices.some((idx) => idx.name === 'IDX_chat_flow_version_workspaceId')
        if (!hasIndex) {
            await queryRunner.query(
                `CREATE INDEX \`IDX_chat_flow_version_workspaceId\` ON \`chat_flow_version\` (\`workspaceId\`);`
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_chat_flow_version_workspaceId\` ON \`chat_flow_version\`;`)
        await queryRunner.query(`ALTER TABLE \`chat_flow_version\` DROP COLUMN \`workspaceId\`;`)
    }
}
