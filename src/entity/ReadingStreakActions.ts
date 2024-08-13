import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserStreak } from './user';

export enum ReadingStreakActionType {
  Recover = 'recovered',
}

@Entity()
export class ReadingStreakActions {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @ManyToOne(() => UserStreak, (userStreak) => userStreak.userId, {
    onDelete: 'CASCADE',
  })
  userStreak: Promise<UserStreak>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  timestamp: Date;

  @Column({ type: 'text' })
  type: ReadingStreakActionType;
}
