import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ONE_MONTH_IN_SECONDS } from './constants';

export const MARKDOWN_TOKEN_PREFIX = 'ddm_';
export const MARKDOWN_TOKEN_AUDIENCE = 'dailydev-markdown';
export const MARKDOWN_TOKEN_ISSUER = 'https://api.daily.dev';
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
  const expiresAt = new Date(Date.now() + ONE_MONTH_IN_SECONDS * 1000);
  const agentId = crypto.randomUUID();
  const token = jwt.sign(
    {
      scope: MARKDOWN_TOKEN_SCOPE,
    },
    getMarkdownTokenSecret(),
    {
      algorithm: 'HS256',
      audience: MARKDOWN_TOKEN_AUDIENCE,
      expiresIn: ONE_MONTH_IN_SECONDS,
      issuer: MARKDOWN_TOKEN_ISSUER,
      jwtid: crypto.randomUUID(),
      subject: agentId,
    },
  );

  return { token: `${MARKDOWN_TOKEN_PREFIX}${token}`, expiresAt };
};
