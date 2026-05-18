import type { IResolvers } from '@graphql-tools/utils';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import type { GraphQLResolveInfo } from 'graphql';
import type { EntityManager } from 'typeorm';
import type { Context } from '../Context';
import { ONE_HOUR_IN_SECONDS, toGQLEnum } from '../common';
import { GQLEmptyResponse } from './common';
import { createLiveRoomJoinToken } from '../common/liveRoom/token';
import {
  deleteContentEmbedsByParent,
  MAX_LIVE_ROOM_CONTENT_EMBEDS,
  replaceContentEmbeds,
} from '../common/contentEmbeds';
import { renderMarkdown } from '../common/markdown';
import {
  activeLiveRoomsQuerySchema,
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
import { LiveRoomPost } from '../entity/posts/LiveRoomPost';
import { PostOrigin } from '../entity/posts/Post';
import { generateTitleHtml } from '../entity/posts/utils';
import graphorm from '../graphorm';
import { getFlytingClient } from '../integrations/flyting/client';
import { AbortError, HttpError } from '../integrations/retry';
import { Roles } from '../roles';
import { scheduleLiveRoomStartingSoonReminder } from '../temporal/notifications/liveRoom';
import { generateShortId } from '../ids';
import { ensureUserSourceExists } from './sources';

export type GQLLiveRoom = LiveRoom;

export const LIVE_ROOM_POST_PROMOTION_SECONDS = 6 * ONE_HOUR_IN_SECONDS;

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
    activeLiveRooms(limit: Int): [LiveRoom!]!
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

const getLiveRoomPromotionExpiresAt = (): number =>
  Math.floor((Date.now() + LIVE_ROOM_POST_PROMOTION_SECONDS * 1000) / 1000);

const createScheduledLiveRoomPost = async ({
  manager,
  room,
  userId,
}: {
  manager: EntityManager;
  room: LiveRoom;
  userId: string;
}): Promise<void> => {
  const id = await generateShortId();

  await manager.getRepository(LiveRoomPost).save(
    manager.getRepository(LiveRoomPost).create({
      id,
      shortId: id,
      liveRoomId: room.id,
      sourceId: userId,
      authorId: userId,
      title: room.topic,
      titleHtml: generateTitleHtml(room.topic, []),
      visible: true,
      visibleAt: new Date(),
      private: false,
      origin: PostOrigin.UserGenerated,
      showOnFeed: true,
      flags: {
        visible: true,
        private: false,
        promoteToPublic: getLiveRoomPromotionExpiresAt(),
      },
    }),
  );
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
              `("${builder.alias}"."status" = :liveStatus OR "${builder.alias}"."status" = :endedStatus OR ("${builder.alias}"."status" = :createdStatus AND "${builder.alias}"."scheduledStart" IS NOT NULL))`,
              {
                createdStatus: LiveRoomStatus.Created,
                endedStatus: LiveRoomStatus.Ended,
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
      args: { limit?: number | null },
      ctx: Context,
      info,
    ): Promise<GQLLiveRoom[]> => {
      const input = activeLiveRoomsQuerySchema.parse(args);

      return graphorm.query<GQLLiveRoom>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."status" = :status`, {
              status: LiveRoomStatus.Live,
            })
            .orderBy(`"${builder.alias}"."createdAt"`, 'DESC')
            .limit(input.limit);
          return builder;
        },
        true,
      );
    },
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
      const userId = ctx.userId;
      if (!userId) {
        throw new ForbiddenError('Access denied!');
      }
      const description = input.description || null;
      const renderedDescription = description
        ? renderMarkdown(description)
        : null;

      const room = await ctx.con.transaction(async (manager) => {
        const roomRepo = manager.getRepository(LiveRoom);
        const savedRoom = await roomRepo.save(
          roomRepo.create({
            description,
            descriptionHtml: renderedDescription?.contentHtml ?? null,
            hostId: userId,
            mode: input.mode,
            scheduledStart: input.scheduledStart ?? null,
            topic: input.topic,
            status: LiveRoomStatus.Created,
          }),
        );

        if (description) {
          await replaceContentEmbeds({
            con: manager,
            parentType: ContentEmbedParentType.LiveRoom,
            parentId: savedRoom.id,
            content: description,
            tokens: renderedDescription?.tokens,
            limit: MAX_LIVE_ROOM_CONTENT_EMBEDS,
          });
        }

        return savedRoom;
      });

      const roomRepo = ctx.con.getRepository(LiveRoom);

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

      if (room.scheduledStart) {
        await ensureUserSourceExists(userId, ctx.con);
        await ctx.con.transaction(async (manager) =>
          createScheduledLiveRoomPost({
            manager,
            room,
            userId,
          }),
        );

        await scheduleLiveRoomStartingSoonReminder({
          roomId: room.id,
          entityTableName: roomRepo.metadata.tableName,
          scheduledStart: room.scheduledStart,
        }).catch((err) => {
          ctx.log.error(
            { err, roomId: room.id },
            'Failed to schedule live room starting soon reminder',
          );
        });
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
