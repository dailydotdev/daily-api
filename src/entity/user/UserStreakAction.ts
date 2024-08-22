import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum UserStreakActionType {
  Recover = 'recover',
}

@Entity()
export class UserStreakAction {
  @PrimaryColumn({ length: 36 })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: UserStreakActionType;

  @PrimaryColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.streakActions, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Promise<User>;
}
