import crypto from 'crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  PersonalAccessToken,
  PERSONAL_ACCESS_TOKEN_PREFIX,
} from '../entity/PersonalAccessToken';
import { IsNull } from 'typeorm';

const TOKEN_BYTE_LENGTH = 32;

export interface GeneratedToken {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

export const generatePersonalAccessToken = (): GeneratedToken => {
  const randomBytes = crypto.randomBytes(TOKEN_BYTE_LENGTH);
  const token =
    PERSONAL_ACCESS_TOKEN_PREFIX + randomBytes.toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenPrefix = token.substring(0, 12);

  return { token, tokenHash, tokenPrefix };
};

export const hashPersonalAccessToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export interface ValidateTokenResult {
  valid: boolean;
  userId?: string;
  tokenId?: string;
}

export const validatePersonalAccessToken = async (
  con: DataSource | EntityManager,
  token: string,
): Promise<ValidateTokenResult> => {
  const hash = hashPersonalAccessToken(token);

  const pat = await con.getRepository(PersonalAccessToken).findOne({
    where: {
      tokenHash: hash,
      revokedAt: IsNull(),
    },
  });

  if (!pat) {
    return { valid: false };
  }

  if (pat.expiresAt && pat.expiresAt < new Date()) {
    return { valid: false };
  }

  // Update last used timestamp (fire and forget, don't block request)
  con
    .getRepository(PersonalAccessToken)
    .update({ id: pat.id }, { lastUsedAt: new Date() })
    .catch(() => {
      // Ignore errors for lastUsedAt update
    });

  return { valid: true, userId: pat.userId, tokenId: pat.id };
};

export const revokeAllUserTokens = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<void> => {
  await con
    .getRepository(PersonalAccessToken)
    .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
};
