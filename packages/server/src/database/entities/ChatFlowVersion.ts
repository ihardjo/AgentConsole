/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm'
import { ChatFlow } from './ChatFlow'

@Entity()
@Index(['chatFlowId', 'version'], { unique: true })
export class ChatFlowVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid' })
    @Index()
    chatFlowId: string

    @ManyToOne(() => ChatFlow, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chatFlowId' })
    chatFlow: ChatFlow

    @Column()
    version: number

    @Column({ type: 'text' })
    flowData: string

    @Column({ type: 'text', nullable: true })
    changeDescription?: string

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
