import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export enum ActionType {
  Notification = 'notification',
}

@Entity()
export class Action {
  @Index()
  @PrimaryColumn({ type: 'text' })
  userId: string;

  @Index()
  @PrimaryColumn({ type: 'text' })
  type: ActionType;

  @Column({ type: 'timestamp without time zone', default: () => 'now()' })
  completedAt: Date;
}
