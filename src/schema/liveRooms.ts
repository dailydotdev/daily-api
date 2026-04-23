import type { IResolvers } from '@graphql-tools/utils';
import { ForbiddenError, ValidationError } from 'apollo-server-errors';
import type { AuthContext } from '../Context';
import { toGQLEnum } from '../common';
import { createLiveRoomJoinToken } from '../common/liveRoom/token';
import {
  createLiveRoomSchema,
  LiveRoomMode,
  LiveRoomParticipantRole,
  liveRoomIdInputSchema,
  LiveRoomStatus,
} from '../common/schema/liveRooms';
import { NotFoundError } from '../errors';
import { LiveRoom } from '../entity/LiveRoom';
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

const activeLiveRoomStatuses = [LiveRoomStatus.Created, LiveRoomStatus.Live];

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
    host: User!
  }

  type LiveRoomJoinToken {
    room: LiveRoom!
    role: LiveRoomParticipantRole!
    token: String!
  }

  input CreateLiveRoomInput {
    topic: String!
    mode: LiveRoomMode = debate
  }

  extend type Query {
    liveRoom(id: ID!): LiveRoom @auth
    activeLiveRooms: [LiveRoom!]! @auth
  }

  extend type Mutation {
    createLiveRoom(input: CreateLiveRoomInput!): LiveRoomJoinToken! @auth
    endLiveRoom(roomId: ID!): LiveRoom! @auth
    liveRoomJoinToken(roomId: ID!): LiveRoomJoinToken! @auth
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
  ctx: AuthContext;
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
  ctx: AuthContext;
  room: LiveRoom;
}): void => {
  if (room.hostId === ctx.userId || ctx.roles.includes(Roles.Moderator)) {
    return;
  }

  throw new ForbiddenError('Access denied!');
};

const createJoinTokenPayload = async ({
  room,
  participantId,
  role,
}: {
  room: LiveRoom;
  participantId: string;
  role: LiveRoomParticipantRole;
}): Promise<GQLLiveRoomJoinToken> => {
  const secret = process.env.FLYTING_JOIN_TOKEN_SECRET;
  if (!secret) {
    throw new Error('FLYTING_JOIN_TOKEN_SECRET is not configured');
  }

  const token = await createLiveRoomJoinToken({
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

export const resolvers: IResolvers = {
  Query: {
    liveRoom: async (
      _,
      args: { id: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLLiveRoom> =>
      graphorm.queryOneOrFail<GQLLiveRoom>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder.where(`"${builder.alias}"."id" = :id`, {
            id: args.id,
          });
          return builder;
        },
        LiveRoom,
      ),
    activeLiveRooms: async (
      _,
      __,
      ctx: AuthContext,
      info,
    ): Promise<GQLLiveRoom[]> =>
      graphorm.query<GQLLiveRoom>(
        ctx,
        info,
        (builder) => {
          builder.queryBuilder
            .where(`"${builder.alias}"."status" IN (:...statuses)`, {
              statuses: activeLiveRoomStatuses,
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
      args: { input: { mode: LiveRoomMode; topic: string } },
      ctx: AuthContext,
    ): Promise<GQLLiveRoomJoinToken> => {
      const input = createLiveRoomSchema.parse(args.input);
      const roomRepo = ctx.con.getRepository(LiveRoom);
      const room = await roomRepo.save(
        roomRepo.create({
          hostId: ctx.userId,
          mode: input.mode,
          topic: input.topic,
          status: LiveRoomStatus.Created,
        }),
      );

      try {
        await getFlytingClient().prepareRoom({
          mode: room.mode,
          roomId: room.id,
        });
      } catch (error) {
        if (shouldDeleteRoomAfterPrepareFailure(error)) {
          await roomRepo.delete({ id: room.id });
        }
        throw error;
      }

      return createJoinTokenPayload({
        room,
        participantId: ctx.userId,
        role: LiveRoomParticipantRole.Host,
      });
    },
    endLiveRoom: async (
      _,
      args: { roomId: string },
      ctx: AuthContext,
      info,
    ): Promise<GQLLiveRoom> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });

      assertCanEndRoom({ ctx, room });

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
      ctx: AuthContext,
    ): Promise<GQLLiveRoomJoinToken> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });

      if (room.status === LiveRoomStatus.Ended) {
        throw new ValidationError('Cannot join an ended live room');
      }

      const secret = process.env.FLYTING_JOIN_TOKEN_SECRET;
      if (!secret) {
        throw new Error('FLYTING_JOIN_TOKEN_SECRET is not configured');
      }

      const role =
        room.hostId === ctx.userId
          ? LiveRoomParticipantRole.Host
          : LiveRoomParticipantRole.Audience;

      return createJoinTokenPayload({
        room,
        participantId: ctx.userId,
        role,
      });
    },
  },
};
