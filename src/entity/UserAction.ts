import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum UserActionType {
  EnableNotification = 'enable_notification',
  SquadFirstPost = 'squad_first_post',
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
