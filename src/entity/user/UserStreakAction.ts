import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { User } from './User';

export enum UserStreakActionType {
  Recover = 'recover',
}

@Entity()
@Index('IDX_usa_userid_type', ['userId', 'type'])
export class UserStreakAction {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: UserStreakActionType;

  @PrimaryColumn({ type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne('User', (user: User) => user.streakActions, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
