import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Remove the foreign-key constraint between chat_flow_version.chatFlowId
 * and chat_flow.id (PostgreSQL).
 *
 * Previously the FK had ON DELETE SET NULL, which nulled chatFlowId when a
 * parent chatflow was deleted.  With no FK, the application layer preserves
 * chatFlowId on delete and detects orphans by subquery comparison.
 */
export class RemoveVersionForeignKey1760000000005 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE chat_flow_version DROP CONSTRAINT IF EXISTS "FK_chat_flow_version_chatFlowId";`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore the SET NULL foreign key
        await queryRunner.query(
            `ALTER TABLE chat_flow_version
             ADD CONSTRAINT "FK_chat_flow_version_chatFlowId"
             FOREIGN KEY ("chatFlowId") REFERENCES chat_flow(id) ON DELETE SET NULL;`
        )
    }
}
