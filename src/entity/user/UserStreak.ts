import { Column, PrimaryColumn, Entity, OneToOne } from 'typeorm';
import { User } from './User';

@Entity()
export class UserStreak {
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @OneToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;

  @Column({ type: 'integer', default: 0 })
  currentStreak: number;

  @Column({ type: 'integer', default: 0 })
  totalStreak: number;

  @Column({ type: 'integer', default: 0 })
  maxStreak: number;

  @Column({ type: 'timestamptz' })
  lastViewAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
