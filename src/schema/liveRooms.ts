import type { IResolvers } from '@graphql-tools/utils';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import type { GraphQLResolveInfo } from 'graphql';
import type { Context } from '../Context';
import { toGQLEnum } from '../common';
import { GQLEmptyResponse } from './common';
import { createLiveRoomJoinToken } from '../common/liveRoom/token';
import {
  deleteContentEmbedsByParent,
  MAX_LIVE_ROOM_CONTENT_EMBEDS,
  replaceContentEmbeds,
} from '../common/contentEmbeds';
import { renderMarkdown } from '../common/markdown';
import {
  createLiveRoomSchema,
  LiveRoomMode,
  LiveRoomParticipantRole,
  liveRoomIdInputSchema,
  LiveRoomStatus,
} from '../common/schema/liveRooms';
import { ContentEmbedParentType } from '../entity/ContentEmbed';
import { NotFoundError } from '../errors';
import { Feature, FeatureType, FeatureValue } from '../entity/Feature';
import { LiveRoom } from '../entity/LiveRoom';
import { LiveRoomSubscription } from '../entity/LiveRoomSubscription';
import graphorm from '../graphorm';
import { getFlytingClient } from '../integrations/flyting/client';
import { AbortError, HttpError } from '../integrations/retry';
import { Roles } from '../roles';

export type GQLLiveRoom = LiveRoom;

type GQLLiveRoomJoinToken = {
  room: LiveRoom;
  role: LiveRoomParticipantRole;
  token: string;
};

export const typeDefs = /* GraphQL */ `
  ${toGQLEnum(LiveRoomMode, 'LiveRoomMode')}
  ${toGQLEnum(LiveRoomStatus, 'LiveRoomStatus')}
  ${toGQLEnum(LiveRoomParticipantRole, 'LiveRoomParticipantRole')}

  type LiveRoom {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    topic: String!
    mode: LiveRoomMode!
    status: LiveRoomStatus!
    startedAt: DateTime
    endedAt: DateTime
    scheduledStart: DateTime
    description: String
    descriptionHtml: String
    subscribed: Boolean!
    contentEmbeds: [ContentEmbed!]!
    participantCount: Int
    host: User!
  }

  type LiveRoomJoinToken {
    room: LiveRoom!
    role: LiveRoomParticipantRole!
    token: String!
  }

  input CreateLiveRoomInput {
    topic: String!
    mode: LiveRoomMode = moderated
    speakerLimit: Int
    scheduledStart: DateTime
    description: String
  }

  extend type Query {
    liveRoom(id: ID!): LiveRoom
    activeLiveRooms: [LiveRoom!]!
  }

  extend type Mutation {
    createLiveRoom(input: CreateLiveRoomInput!): LiveRoomJoinToken! @auth
    endLiveRoom(roomId: ID!): LiveRoom! @auth
    liveRoomJoinToken(roomId: ID!): LiveRoomJoinToken!
    subscribeToLiveRoom(roomId: ID!): EmptyResponse! @auth
    unsubscribeFromLiveRoom(roomId: ID!): EmptyResponse! @auth
  }
`;

const shouldDeleteRoomAfterPrepareFailure = (error: unknown): boolean => {
  if (error instanceof HttpError) {
    return error.statusCode < 500;
  }

  if (error instanceof AbortError && error.originalError instanceof HttpError) {
    return error.originalError.statusCode < 500;
  }

  return false;
};

const getRoomOrThrow = async ({
  roomId,
  ctx,
}: {
  roomId: string;
  ctx: Context;
}): Promise<LiveRoom> => {
  const room = await ctx.con.getRepository(LiveRoom).findOneBy({ id: roomId });

  if (!room) {
    throw new NotFoundError('Live room not found');
  }

  return room;
};

const assertCanEndRoom = ({
  ctx,
  room,
}: {
  ctx: Context;
  room: LiveRoom;
}): Promise<void> => {
  if (room.hostId === ctx.userId || ctx.roles.includes(Roles.Moderator)) {
    return Promise.resolve();
  }

  if (room.status === LiveRoomStatus.Live) {
    return getFlytingClient()
      .getParticipantPrivileges({
        participantId: getJoinParticipantId(ctx),
        roomId: room.id,
      })
      .then((privileges) => {
        if (privileges?.hasHostPrivileges) {
          return;
        }

        throw new ForbiddenError('Access denied!');
      });
  }

  throw new ForbiddenError('Access denied!');
};

const assertCanCreateRoom = async ({
  ctx,
}: {
  ctx: Context;
}): Promise<void> => {
  const hasStandupAccess = await ctx.con.getRepository(Feature).exists({
    where: {
      userId: ctx.userId,
      feature: FeatureType.Standup,
      value: FeatureValue.Allow,
    },
  });

  if (hasStandupAccess) {
    return;
  }

  throw new ForbiddenError('Access denied!');
};

const createJoinTokenPayload = async ({
  authKind,
  room,
  participantId,
  role,
}: {
  authKind: 'anonymous' | 'authenticated';
  room: LiveRoom;
  participantId: string;
  role: LiveRoomParticipantRole;
}): Promise<GQLLiveRoomJoinToken> => {
  const secret = process.env.FLYTING_JOIN_TOKEN_SECRET;
  if (!secret) {
    throw new Error('FLYTING_JOIN_TOKEN_SECRET is not configured');
  }

  const token = await createLiveRoomJoinToken({
    authKind,
    participantId,
    role,
    roomId: room.id,
    secret,
  });

  return {
    room,
    role,
    token,
  };
};

const getJoinParticipantId = (ctx: Context): string => {
  if (ctx.userId) {
    return ctx.userId;
  }

  if (!ctx.trackingId) {
    throw new ValidationError('Tracking ID is required to join a live room');
  }

  return ctx.trackingId;
};

const assertJoinAllowedByFlyting = async ({
  participantId,
  roomId,
}: {
  participantId: string;
  roomId: string;
}): Promise<void> => {
  const eligibility = await getFlytingClient().getJoinEligibility({
    participantId,
    roomId,
  });

  if (eligibility.canJoin) {
    return;
  }

  if (eligibility.reason === 'kicked') {
    throw new ValidationError('You have been removed from this live room');
  }

  throw new ValidationError('Cannot join this live room');
};

const assertCanSubscribeToRoom = (room: LiveRoom): void => {
  if (room.status !== LiveRoomStatus.Created || !room.scheduledStart) {
    throw new ValidationError('Cannot subscribe to this live room');
  }
};

const isAnonymousJoinableRoom = (room: LiveRoom): boolean =>
  room.status === LiveRoomStatus.Live ||
  (room.status === LiveRoomStatus.Created && !!room.scheduledStart);

const queryLiveRoomById = (
  ctx: Context,
  info: GraphQLResolveInfo,
  roomId: string,
): Promise<GQLLiveRoom> =>
  graphorm.queryOneOrFail<GQLLiveRoom>(ctx, info, (builder) => {
    builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
      id: roomId,
    });
    return builder;
  });

export const resolvers: IResolvers = {
  LiveRoomJoinToken: {
    room: (
      payload: GQLLiveRoomJoinToken,
      _,
      ctx: Context,
      info: GraphQLResolveInfo,
    ): Promise<GQLLiveRoom> => queryLiveRoomById(ctx, info, payload.room.id),
  },
  LiveRoom: {
    participantCount: async (
      room: GQLLiveRoom,
      _,
      ctx: Context,
    ): Promise<number | null> => {
      if (room.status !== LiveRoomStatus.Live) {
        return null;
      }

      return ctx.dataLoader.liveRoomParticipantCount.load(room.id);
    },
  },
  Query: {
    liveRoom: async (
      _,
      args: { id: string },
      ctx: Context,
      info,
    ): Promise<GQLLiveRoom> =>
      graphorm.queryOneOrFail<GQLLiveRoom>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
            id: args.id,
          });
          if (!ctx.userId) {
            builder.queryBuilder.andWhere(
              `("${builder.alias}"."status" = :liveStatus OR ("${builder.alias}"."status" = :createdStatus AND "${builder.alias}"."scheduledStart" IS NOT NULL))`,
              {
                createdStatus: LiveRoomStatus.Created,
                liveStatus: LiveRoomStatus.Live,
              },
            );
          }
          return builder;
        },
        LiveRoom,
      ),
    activeLiveRooms: async (
      _,
      __,
      ctx: Context,
      info,
    ): Promise<GQLLiveRoom[]> =>
      graphorm.query<GQLLiveRoom>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."status" = :status`, {
              status: LiveRoomStatus.Live,
            })
            .orderBy(`"${builder.alias}"."createdAt"`, 'DESC');
          return builder;
        },
        true,
      ),
  },
  Mutation: {
    createLiveRoom: async (
      _,
      args: {
        input: {
          description?: string | null;
          mode: LiveRoomMode;
          speakerLimit?: number;
          scheduledStart?: string | null;
          topic: string;
        };
      },
      ctx: Context,
    ): Promise<GQLLiveRoomJoinToken> => {
      const input = createLiveRoomSchema.parse(args.input);
      await assertCanCreateRoom({ ctx });
      const description = input.description || null;
      const renderedDescription = description
        ? renderMarkdown(description)
        : null;
      const roomRepo = ctx.con.getRepository(LiveRoom);
      const room = await roomRepo.save(
        roomRepo.create({
          description,
          descriptionHtml: renderedDescription?.contentHtml ?? null,
          hostId: ctx.userId,
          mode: input.mode,
          scheduledStart: input.scheduledStart ?? null,
          topic: input.topic,
          status: LiveRoomStatus.Created,
        }),
      );

      if (description) {
        await replaceContentEmbeds({
          con: ctx.con,
          parentType: ContentEmbedParentType.LiveRoom,
          parentId: room.id,
          content: description,
          tokens: renderedDescription?.tokens,
          limit: MAX_LIVE_ROOM_CONTENT_EMBEDS,
        });
      }

      try {
        await getFlytingClient().prepareRoom({
          mode: room.mode,
          roomId: room.id,
          speakerLimit: input.speakerLimit,
        });
      } catch (error) {
        if (shouldDeleteRoomAfterPrepareFailure(error)) {
          await ctx.con.transaction(async (manager) => {
            await deleteContentEmbedsByParent({
              con: manager,
              parentType: ContentEmbedParentType.LiveRoom,
              parentIds: [room.id],
            });
            await manager.getRepository(LiveRoom).delete({ id: room.id });
          });
        }
        throw error;
      }

      return createJoinTokenPayload({
        authKind: 'authenticated',
        room,
        participantId: getJoinParticipantId(ctx),
        role: LiveRoomParticipantRole.Host,
      });
    },
    endLiveRoom: async (
      _,
      args: { roomId: string },
      ctx: Context,
      info,
    ): Promise<GQLLiveRoom> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });

      await assertCanEndRoom({ ctx, room });

      if (room.status === LiveRoomStatus.Ended) {
        return graphorm.queryOneOrFail<GQLLiveRoom>(ctx, info, (builder) => {
          builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
            id: room.id,
          });
          return builder;
        });
      }

      await getFlytingClient().endRoom({ roomId: room.id });

      await ctx.con.getRepository(LiveRoom).update(
        { id: room.id },
        {
          status: LiveRoomStatus.Ended,
          endedAt: room.endedAt ?? new Date(),
        },
      );

      return graphorm.queryOneOrFail<GQLLiveRoom>(ctx, info, (builder) => {
        builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
          id: room.id,
        });
        return builder;
      });
    },
    liveRoomJoinToken: async (
      _,
      args: { roomId: string },
      ctx: Context,
    ): Promise<GQLLiveRoomJoinToken> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });

      if (room.status === LiveRoomStatus.Ended) {
        throw new ValidationError('Cannot join an ended live room');
      }

      const authKind = ctx.userId ? 'authenticated' : 'anonymous';
      if (authKind === 'anonymous' && !isAnonymousJoinableRoom(room)) {
        throw new ValidationError(
          'Anonymous viewers can only join live rooms or scheduled lobbies',
        );
      }

      const role =
        room.hostId === ctx.userId
          ? LiveRoomParticipantRole.Host
          : LiveRoomParticipantRole.Audience;
      const participantId = getJoinParticipantId(ctx);

      await assertJoinAllowedByFlyting({
        participantId,
        roomId: room.id,
      });

      return createJoinTokenPayload({
        authKind,
        room,
        participantId,
        role,
      });
    },
    subscribeToLiveRoom: async (
      _,
      args: { roomId: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });
      assertCanSubscribeToRoom(room);

      await ctx.con
        .getRepository(LiveRoomSubscription)
        .createQueryBuilder()
        .insert()
        .values({
          roomId: room.id,
          userId: ctx.userId,
        })
        .orIgnore()
        .execute();

      return { _: true };
    },
    unsubscribeFromLiveRoom: async (
      _,
      args: { roomId: string },
      ctx: Context,
    ): Promise<GQLEmptyResponse> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });

      await ctx.con.getRepository(LiveRoomSubscription).delete({
        roomId: room.id,
        userId: ctx.userId,
      });

      return { _: true };
    },
  },
};
