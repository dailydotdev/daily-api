import { z } from 'zod';
import { enumValues } from './utils';

export enum LiveRoomMode {
  Moderated = 'moderated',
  FreeForAll = 'free_for_all',
}

export enum LiveRoomStatus {
  Created = 'created',
  Live = 'live',
  Ended = 'ended',
}

export enum LiveRoomParticipantRole {
  Host = 'host',
  Audience = 'audience',
}

export enum LiveRoomLifecycleEventType {
  RoomStarted = 'room_started',
  RoomEnded = 'room_ended',
}

export const liveRoomModeSchema = z.enum(enumValues(LiveRoomMode), {
  error: 'Invalid live room mode',
});

export const liveRoomStatusSchema = z.enum(enumValues(LiveRoomStatus), {
  error: 'Invalid live room status',
});

export const liveRoomParticipantRoleSchema = z.enum(
  enumValues(LiveRoomParticipantRole),
  {
    error: 'Invalid live room participant role',
  },
);

export const liveRoomLifecycleEventTypeSchema = z.enum(
  enumValues(LiveRoomLifecycleEventType),
  {
    error: 'Invalid live room lifecycle event type',
  },
);

export const createLiveRoomSchema = z.object({
  topic: z.string().trim().min(1).max(280),
  mode: liveRoomModeSchema.default(LiveRoomMode.Moderated),
});

export const liveRoomIdSchema = z.uuid('Live room ID must be a valid UUID');

export const liveRoomIdInputSchema = z.object({
  roomId: liveRoomIdSchema,
});

export const liveRoomLifecycleEventSchema = z.object({
  eventId: z.uuid('Event ID must be a valid UUID'),
  roomId: liveRoomIdSchema,
  occurredAt: z.string().min(1),
  type: liveRoomLifecycleEventTypeSchema,
});

export const normalizeStoredLiveRoomMode = (
  mode: string | null | undefined,
): LiveRoomMode => {
  if (mode === 'debate') {
    return LiveRoomMode.Moderated;
  }

  return liveRoomModeSchema.parse(mode);
};
