import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum UserActionType {
  EnableNotification = 'enable_notification',
  CreateSquad = 'create_squad',
  JoinSquad = 'join_squad',
  SquadFirstComment = 'squad_first_comment',
  SquadFirstPost = 'squad_first_post',
  SquadInvite = 'squad_invite',
  MyFeed = 'my_feed',
  EditWelcomePost = 'edit_welcome_post',
  DevCardUnlocked = 'dev_card_unlocked',
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
}
