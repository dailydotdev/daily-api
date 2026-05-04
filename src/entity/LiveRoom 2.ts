import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from './user/User';
import type { z } from 'zod';
import type {
  liveRoomModeSchema,
  liveRoomStatusSchema,
} from '../common/schema/liveRooms';

@Entity({ name: 'live_room' })
@Index('IDX_live_room_host_id', ['hostId'])
@Index('IDX_live_room_status', ['status'])
export class LiveRoom {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_live_room_id',
  })
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  hostId: User['id'];

  @ManyToOne('User', {
    createForeignKeyConstraints: false,
    lazy: true,
  })
  @JoinColumn({ name: 'hostId' })
  host: Promise<User>;

  @Column({ type: 'text' })
  topic: string;

  @Column({ type: 'text' })
  mode: z.infer<typeof liveRoomModeSchema>;

  @Column({ type: 'text', default: 'created' })
  status: z.infer<typeof liveRoomStatusSchema>;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
