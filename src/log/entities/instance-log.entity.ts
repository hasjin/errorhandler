// src/log/entities/instance-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ExceptionEntity } from './exception.entity';

@Entity({ name: 'instance_logs' })
export class InstanceLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'instance_id', type: 'varchar', length: 50 })
  instanceId!: string;

  @Column({ name: 'log_date', type: 'date' })
  logDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => ExceptionEntity, (exception) => exception.log)
  exceptions!: ExceptionEntity[];
}