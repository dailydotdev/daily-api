import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { LiveRoom } from './LiveRoom';
import type { User } from './user/User';

@Entity({ name: 'live_room_subscription' })
@Index('IDX_live_room_subscription_user_created', ['userId', 'createdAt'])
export class LiveRoomSubscription {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_live_room_subscription',
  })
  roomId: LiveRoom['id'];

  @PrimaryColumn({
    type: 'text',
    primaryKeyConstraintName: 'PK_live_room_subscription',
  })
  userId: User['id'];

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('LiveRoom', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'roomId',
    foreignKeyConstraintName: 'FK_live_room_subscription_room',
  })
  room: Promise<LiveRoom>;

  @ManyToOne('User', {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_live_room_subscription_user',
  })
  user: Promise<User>;
}
