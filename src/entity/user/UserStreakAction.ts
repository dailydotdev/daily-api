import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';
import { ReputationReason, reputationReasonAmount } from '../ReputationEvent';

export enum UserStreakActionType {
  Recover = 'recover',
}

export const streakRecoverCost = Math.abs(
  reputationReasonAmount[ReputationReason.StreakRecover],
);

@Entity()
export class UserStreakAction {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: UserStreakActionType;

  @PrimaryColumn({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.streakActions, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
