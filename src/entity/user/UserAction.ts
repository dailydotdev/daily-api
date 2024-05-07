import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './User';

export enum UserActionType {
  EnableNotification = 'enable_notification',
  CreateSquad = 'create_squad',
  JoinSquad = 'join_squad',
  SquadFirstComment = 'squad_first_comment',
  SquadFirstPost = 'squad_first_post',
  SquadInvite = 'squad_invite',
  MyFeed = 'my_feed',
  EditWelcomePost = 'edit_welcome_post',
}

@Entity()
export class UserAction {
  @Index()
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @PrimaryColumn({ type: 'text' })
  type: UserActionType;

  @Column({ type: 'timestamp without time zone', default: () => 'now()' })
  completedAt: Date;

  @ManyToOne(() => User, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  user: Promise<User>;
}
