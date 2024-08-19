import { Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum UserStreakActionType {
  Recover = 'recover',
}

export const streakRecoverCost = 25;

@Entity()
export class UserStreakAction {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: UserStreakActionType;

  @PrimaryColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @OneToOne(() => User, (user) => user.streak, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
