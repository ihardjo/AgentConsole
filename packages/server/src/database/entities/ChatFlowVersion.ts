/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { ChatFlow } from './ChatFlow'

@Entity()
@Index(['chatFlowId', 'version'], { unique: true })
export class ChatFlowVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid', nullable: true })
    @Index()
    chatFlowId: string

    @ManyToOne(() => ChatFlow, { nullable: true })
    @JoinColumn({ name: 'chatFlowId' })
    chatFlow: ChatFlow

    @Column()
    version: number

    @Column({ type: 'text' })
    flowData: string

    @Column({ type: 'text', nullable: true })
    changeDescription?: string

    /** Original chatflow name — stored so the version is self-describing
     *  even after the parent chatflow has been deleted. */
    @Column({ nullable: true, type: 'varchar', length: 255 })
    chatFlowName?: string

    /** Original chatflow type (e.g. AGENTFLOW, CHATFLOW) — stored so
     *  the version can be restored to the correct type if the parent
     *  chatflow no longer exists. */
    @Column({ nullable: true, type: 'varchar', length: 50 })
    chatFlowType?: string

    // ── Config snapshot columns (mirrors ChatFlow) ────────────────────
    // Captured at version-save time so a restore can fully reconstruct
    // the chatflow's configuration, not just its node graph.

    @Column({ nullable: true, type: 'text' })
    chatbotConfig?: string

    @Column({ nullable: true, type: 'text' })
    apiConfig?: string

    @Column({ nullable: true, type: 'text' })
    analytic?: string

    @Column({ nullable: true, type: 'text' })
    category?: string

    @Column({ nullable: true, type: 'text' })
    speechToText?: string

    @Column({ nullable: true, type: 'text' })
    followUpPrompts?: string

    @Column({ nullable: true, type: 'text' })
    textToSpeech?: string

    @Column({ nullable: true, type: 'varchar', length: 255 })
    @Index()
    createdBy?: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    @Index()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
