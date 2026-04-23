import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ONE_MINUTE_IN_SECONDS } from '../constants';
import { LiveRoomParticipantRole } from '../schema/liveRooms';

export const DEFAULT_LIVE_ROOM_JOIN_TOKEN_AUDIENCE = 'flyting';
export const DEFAULT_LIVE_ROOM_JOIN_TOKEN_ISSUER = 'daily-api';
export const DEFAULT_LIVE_ROOM_JOIN_TOKEN_TTL_SECONDS =
  5 * ONE_MINUTE_IN_SECONDS;

export const createLiveRoomJoinToken = async (input: {
  participantId: string;
  role: LiveRoomParticipantRole;
  roomId: string;
  audience?: string;
  expiresInSeconds?: number;
  issuer?: string;
  now?: Date;
  secret: string;
}): Promise<string> => {
  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1000);

  return jwt.sign(
    {
      iat: issuedAt,
      jti: randomUUID(),
      participantId: input.participantId,
      role: input.role,
      roomId: input.roomId,
    },
    input.secret,
    {
      algorithm: 'HS256',
      audience: input.audience ?? DEFAULT_LIVE_ROOM_JOIN_TOKEN_AUDIENCE,
      expiresIn:
        input.expiresInSeconds ?? DEFAULT_LIVE_ROOM_JOIN_TOKEN_TTL_SECONDS,
      issuer: input.issuer ?? DEFAULT_LIVE_ROOM_JOIN_TOKEN_ISSUER,
    },
  );
};
