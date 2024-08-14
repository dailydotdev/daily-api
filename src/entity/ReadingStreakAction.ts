import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserStreak } from './user';

export enum ReadingStreakActionType {
  Recover = 'recovered',
}

@Entity()
export class ReadingStreakAction {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @ManyToOne(() => UserStreak, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userStreak' })
  userStreak: Promise<UserStreak>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  timestamp: Date;

  @Column({ type: 'text' })
  type: ReadingStreakActionType;
}
