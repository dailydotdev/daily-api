import {
  Column,
  PrimaryColumn,
  Entity,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './';

@Entity()
@Index('IDX_user_streak_currentStreak_userId', { synchronize: false })
@Index('IDX_user_streak_totalStreak_userId', { synchronize: false })
export class UserStreak {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @OneToOne(() => User, (user) => user.streak, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;

  @Column({ type: 'integer', default: 0 })
  currentStreak: number;

  @Column({ type: 'integer', default: 0 })
  totalStreak: number;

  @Column({ type: 'integer', default: 0 })
  maxStreak: number;

  @Column({ type: 'timestamptz', default: null })
  lastViewAt: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
