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
import { flytingClient } from '../integrations/flyting/client';
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
    myLiveRooms: [LiveRoom!]! @auth
  }

  extend type Mutation {
    createLiveRoom(input: CreateLiveRoomInput!): LiveRoom! @auth
    endLiveRoom(roomId: ID!): LiveRoom! @auth
    liveRoomJoinToken(roomId: ID!): LiveRoomJoinToken! @auth
  }
`;

const shouldDeleteRoomAfterPrepareFailure = (error: unknown): boolean => {
  return (
    error instanceof AbortError &&
    error.originalError instanceof HttpError &&
    error.originalError.statusCode < 500
  );
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

export const resolvers: IResolvers = {
  Query: {
    liveRoom: async (
      _,
      args: { id: string },
      ctx: AuthContext,
    ): Promise<GQLLiveRoom> => {
      const room = await getRoomOrThrow({ roomId: args.id, ctx });

      return room;
    },
    myLiveRooms: async (_, __, ctx: AuthContext): Promise<GQLLiveRoom[]> => {
      return ctx.con.getRepository(LiveRoom).find({
        where: {
          hostId: ctx.userId,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    },
  },
  Mutation: {
    createLiveRoom: async (
      _,
      args: { input: { mode: LiveRoomMode; topic: string } },
      ctx: AuthContext,
    ): Promise<GQLLiveRoom> => {
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
        await flytingClient.prepareRoom({
          mode: room.mode,
          roomId: room.id,
          topic: room.topic,
        });
      } catch (error) {
        if (shouldDeleteRoomAfterPrepareFailure(error)) {
          await roomRepo.delete({ id: room.id });
        }
        throw error;
      }

      return room;
    },
    endLiveRoom: async (
      _,
      args: { roomId: string },
      ctx: AuthContext,
    ): Promise<GQLLiveRoom> => {
      const input = liveRoomIdInputSchema.parse(args);
      const room = await getRoomOrThrow({ roomId: input.roomId, ctx });

      assertCanEndRoom({ ctx, room });

      if (room.status === LiveRoomStatus.Ended) {
        return room;
      }

      await flytingClient.endRoom({ roomId: room.id });

      await ctx.con.getRepository(LiveRoom).update(
        { id: room.id },
        {
          status: LiveRoomStatus.Ended,
          endedAt: room.endedAt ?? new Date(),
        },
      );

      return getRoomOrThrow({ roomId: room.id, ctx });
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

      const token = await createLiveRoomJoinToken({
        participantId: ctx.userId,
        role,
        roomId: room.id,
        secret,
      });

      return {
        room,
        role,
        token,
      };
    },
  },
  LiveRoom: {
    host: (room: LiveRoom, _, ctx: AuthContext) =>
      ctx.dataLoader.user.load({ userId: room.hostId }),
  },
};
