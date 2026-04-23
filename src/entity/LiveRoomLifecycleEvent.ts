import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { z } from 'zod';
import type {
  liveRoomIdSchema,
  liveRoomLifecycleEventTypeSchema,
} from '../common/schema/liveRooms';

@Entity({ name: 'live_room_lifecycle_event' })
@Index('IDX_live_room_lifecycle_event_room_id', ['roomId'])
export class LiveRoomLifecycleEvent {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_live_room_lifecycle_event_id',
  })
  eventId: string;

  @Column({ type: 'uuid' })
  roomId: z.infer<typeof liveRoomIdSchema>;

  @Column({ type: 'text' })
  type: z.infer<typeof liveRoomLifecycleEventTypeSchema>;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn()
  processedAt: Date;
}
