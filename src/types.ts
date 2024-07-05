import { Roles } from './roles';
import { AccessToken } from './auth';
import { opentelemetry } from './telemetry';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    // Used for auth
    userId?: string;
    premium?: boolean;
    roles?: Roles[];
    service?: boolean;
    accessToken?: AccessToken;

    // Used for tracking
    trackingId?: string;
    sessionId?: string;
    isBot?: boolean;

    // Used for tracing
    span?: opentelemetry.Span;
  }

  interface FastifyInstance {
    // Used for tracing
    tracer?: opentelemetry.Tracer;
  }
}

type IgnoredTypes = Promise<unknown> | ((...args: unknown[]) => unknown);

export type ChangeObject<Type> = {
  [Property in keyof Type as Exclude<
    Property,
    Type[Property] extends IgnoredTypes ? Property : never
  >]: Type[Property] extends Date ? number : Type[Property];
};

export type ChangeSchema = {
  type: string;
  fields: ChangeSchema[];
  optional: boolean;
  name: string;
};

export type ChangeMessage<T> = {
  schema: ChangeSchema;
  payload: {
    before: ChangeObject<T> | null;
    after: ChangeObject<T> | null;
    source: {
      version: string;
      connector: string;
      name: string;
      ts_ms: number;
      snapshot: boolean;
      db: string;
      sequence: string;
      schema: string;
      table: string;
      txId: number;
      lsn: number;
      xmin: number;
    };
    op: 'c' | 'u' | 'd' | 'r';
    ts_ms: number;
    transaction: number;
  };
};

export type WebhookPayload<T> = {
  Body?: T;
};

export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export enum UserVote {
  Up = 1,
  None = 0,
  Down = -1,
}

export enum UserVoteEntity {
  Comment = 'comment',
  Post = 'post',
}

export const DEFAULT_TIMEZONE = 'Etc/UTC';

export const maxFeedsPerUser = 10;

export type SlackAuthResponse = {
  ok: boolean;
  app_id: string;
  authed_user: {
    id: string;
  };
  scope: string;
  token_type: string;
  access_token: string;
  bot_user_id: string;
  team: {
    id: string;
    name: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  warning: string;
  response_metadata: {
    warnings: Array<string>;
  };
  error?: string;
};
