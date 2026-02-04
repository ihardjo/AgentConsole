/* eslint-disable */
import { Entity, Column, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm'
import { ChatFlow } from './ChatFlow'

@Entity()
export class ChatFlowMetadata {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ type: 'uuid' })
    chatFlowId: string

    @ManyToOne(() => ChatFlow, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chatFlowId' })
    chatFlow: ChatFlow

    @Column({ nullable: true, type: 'varchar', length: 255 })
    createdBy?: string

    @Column({ nullable: true, type: 'varchar', length: 255 })
    updatedBy?: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
