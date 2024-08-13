import { Column, Entity, OneToOne, PrimaryColumn } from 'typeorm';
import { UserStreak } from './user';

export enum ReadingStreakActionType {
  Recover = 'recovered',
}

@Entity()
export class ReadingStreakActions {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @OneToOne(() => UserStreak, (userStreak) => userStreak.userId, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  userStreak: Promise<UserStreak>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  timestamp: Date;

  @Column({ type: 'text' })
  type: ReadingStreakActionType;
}
