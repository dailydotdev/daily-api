import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ONE_HOUR_IN_SECONDS } from './constants';

export const MARKDOWN_TOKEN_PREFIX = 'ddm_';
export const MARKDOWN_TOKEN_AUDIENCE = 'dailydev-markdown';
export const MARKDOWN_TOKEN_ISSUER = process.env.URL_PREFIX;
export const MARKDOWN_TOKEN_SCOPE = 'markdown:read';

const getMarkdownTokenSecret = (): string => {
  const secret = process.env.AGENT_ACCESS_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error(
      'AGENT_ACCESS_TOKEN_SECRET must be configured with at least 32 bytes',
    );
  }
  return secret;
};

export const generateAgentMarkdownToken = (): {
  token: string;
  expiresAt: Date;
} => {
  const agentId = crypto.randomUUID();
  const payload: jwt.JwtPayload = {
    scope: MARKDOWN_TOKEN_SCOPE,
  };
  const token = jwt.sign(payload, getMarkdownTokenSecret(), {
    algorithm: 'HS256',
    audience: MARKDOWN_TOKEN_AUDIENCE,
    expiresIn: ONE_HOUR_IN_SECONDS,
    issuer: MARKDOWN_TOKEN_ISSUER,
    jwtid: crypto.randomUUID(),
    mutatePayload: true,
    subject: agentId,
  });
  if (typeof payload.exp !== 'number') {
    throw new Error('Agent access token is missing an expiration');
  }

  return {
    token: `${MARKDOWN_TOKEN_PREFIX}${token}`,
    expiresAt: new Date(payload.exp * 1000),
  };
};
