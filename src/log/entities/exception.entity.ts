// src/log/entities/exception.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InstanceLog } from './instance-log.entity';

@Entity({ name: 'exceptions' })
export class ExceptionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => InstanceLog, (log) => log.exceptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'log_id' })
  log!: InstanceLog;

  @Column({ name: 'instance_id', type: 'varchar', length: 50 })
  instanceId!: string;

  @Column({ name: 'line_no', type: 'integer' })
  lineNo!: number;

  @Column({ name: 'pre_lines', type: 'text', nullable: true })
  preLines?: string;

  @Column({ name: 'exception_message', type: 'text' })
  exceptionMessage!: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}