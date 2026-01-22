import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { User } from './User';

@Entity()
@Index('IDX_user_hot_take_user_id', ['userId'])
export class UserHotTake {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_user_hot_take_id',
  })
  id: string;

  @Column({ type: 'text' })
  userId: string;

  @Column({ type: 'text' })
  emoji: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'integer' })
  position: number;

  @Column({ type: 'integer', default: 0 })
  upvotes: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_user_hot_take_user_id',
  })
  user: Promise<User>;
}
