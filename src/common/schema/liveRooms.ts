import { z } from 'zod';
import { enumValues } from './utils';

export enum LiveRoomMode {
  Moderated = 'moderated',
  FreeForAll = 'free_for_all',
  CommunityModerated = 'community_moderated',
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

export const liveRoomSpeakerLimitSchema = z
  .number()
  .int()
  .positive('Speaker limit must be at least 1');

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

export const createLiveRoomSchema = z
  .object({
    topic: z.string().trim().min(1).max(280),
    description: z.string().trim().max(20_000).optional().nullable(),
    mode: liveRoomModeSchema.default(LiveRoomMode.Moderated),
    speakerLimit: liveRoomSpeakerLimitSchema.optional(),
    scheduledStart: z.coerce.date().optional().nullable(),
  })
  .superRefine((input, ctx) => {
    if (
      input.mode !== LiveRoomMode.FreeForAll &&
      input.mode !== LiveRoomMode.CommunityModerated &&
      input.speakerLimit !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['speakerLimit'],
        message:
          'Speaker limit can only be set for free-for-all or community-moderated rooms',
      });
    }
  });

export const activeLiveRoomsQuerySchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullish()
    .transform((value) => value ?? 5),
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
