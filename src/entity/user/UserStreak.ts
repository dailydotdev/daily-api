import { Index, Column, PrimaryColumn } from 'typeorm';

export class UserStreak {
  @PrimaryColumn({ type: 'text' })
  @Index()
  userId: string;

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
