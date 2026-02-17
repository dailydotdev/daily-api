import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { WorkerJobStatus, WorkerJobType } from '@dailydotdev/schema';

@Entity()
export class WorkerJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', comment: 'JobType from protobuf schema' })
  @Index()
  type: WorkerJobType;

  @Column({ type: 'integer', comment: 'JobStatus from protobuf schema' })
  @Index()
  status: WorkerJobStatus;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId: string | null;

  @ManyToOne(() => WorkerJob, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: WorkerJob | null;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
