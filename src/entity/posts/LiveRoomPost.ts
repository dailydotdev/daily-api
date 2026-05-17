import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { type LiveRoom } from '../LiveRoom';
import { Post, PostType } from './Post';

@ChildEntity(PostType.LiveRoom)
export class LiveRoomPost extends Post {
  @Column({ type: 'uuid', nullable: true })
  liveRoomId: string;

  @ManyToOne('LiveRoom', {
    createForeignKeyConstraints: false,
    lazy: true,
  })
  @JoinColumn({ name: 'liveRoomId' })
  liveRoom: Promise<LiveRoom>;
}
