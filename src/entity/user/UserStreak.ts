import {
  Column,
  PrimaryColumn,
  Entity,
  OneToOne,
  JoinColumn,
  BeforeUpdate,
} from 'typeorm';
import { User } from './';

@Entity()
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
  lastViewAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
