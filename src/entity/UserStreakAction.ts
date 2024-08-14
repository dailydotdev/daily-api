import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserStreak } from './user';

export enum UserStreakActionType {
  Recover = 'recovered',
}

@Entity()
export class UserStreakAction {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: UserStreakActionType;

  @PrimaryColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => UserStreak, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  streak: Promise<UserStreak>;
}
