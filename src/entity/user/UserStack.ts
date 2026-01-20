import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './User';
import type { DatasetStack } from '../dataset/DatasetStack';

@Entity()
@Index('IDX_user_stack_user_id', ['userId'])
export class UserStack {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_stack_id',
  })
  id: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'uuid' })
  stackId: string;

  @Column({ type: 'text' })
  section: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'date', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_stack_user_id',
  })
  user: Promise<User>;

  @ManyToOne('DatasetStack', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'stackId',
    foreignKeyConstraintName: 'FK_user_stack_stack_id',
  })
  stack: Promise<DatasetStack>;
}
