import { Roles } from './roles';
import { AccessToken } from './auth';
import { opentelemetry } from './telemetry';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
      CDC_WORKER_MAX_MESSAGES: string;
      TYPEORM_HOST: string;
      TYPEORM_USERNAME: string;
      TYPEORM_PASSWORD: string;
      TYPEORM_DATABASE: string;
      HEIMDALL_ORIGIN: string;
      ENABLE_PRIVATE_ROUTES: string;
      ACCESS_SECRET: string;
      ALLOCATION_QUEUE_CONCURRENCY: string;
      QUEUE_CONCURRENCY: string;
      JWT_AUDIENCE: string;
      JWT_ISSUER: string;
      JWT_PUBLIC_KEY_PATH: string;
      JWT_PRIVATE_KEY_PATH: string;
      CIO_SITE_ID: string;
      CIO_API_KEY: string;
      CIO_APP_KEY: string;
      CIO_REPORTING_WEBHOOK_SECRET: string;
      CIO_WEBHOOK_SECRET: string;
      COMMENTS_PREFIX: string;
      GROWTHBOOK_CLIENT_KEY: string;
      EXPERIMENTATION_KEY: string;
      COOKIES_KEY: string;
      KRATOS_ORIGIN: string;
      ONESIGNAL_APP_ID: string;
      ONESIGNAL_API_KEY: string;
      REDIS_HOST: string;
      REDIS_PORT: string;
      PERSONALIZED_DIGEST_FEED: string;
      DIGEST_QUEUE_CONCURRENCY: string;
      URL_PREFIX: string;
      SLACK_CLIENT_ID: string;
      SLACK_CLIENT_SECRET: string;
      SLACK_DB_KEY: string;
      SENDGRID_WEBHOOK_ANALYTICS_KEY: string;
      SCRAPER_URL: string;
      NODE_ENV: 'development' | 'production' | 'test';
      SNOTRA_ORIGIN: string;
      LOFN_ORIGIN: string;
      POPULAR_FEED: string;
      INTERNAL_FEED: string;
      ROASTER_URL: string;
      MEILI_ORIGIN: string;
      MEILI_TOKEN: string;
      MEILI_INDEX: string;
      MAGNI_ORIGIN: string;
      ANALYTICS_URL: string;
      DEFAULT_IMAGE_RATIO: string;
      POST_SCRAPER_ORIGIN: string;
      SUBMIT_ARTICLE_THRESHOLD: string;
      SLACK_SIGNING_SECRET: string;
      API_CONFIG_FEATURE_KEY: string;
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
    Required<Type>[Property] extends IgnoredTypes ? Property : never
  >]: Required<Type>[Property] extends Date ? number : Type[Property];
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

export enum UserVote {
  Up = 1,
  None = 0,
  Down = -1,
}

export enum UserVoteEntity {
  Comment = 'comment',
  Post = 'post',
}

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

export enum ContentLanguage {
  English = 'en',
  German = 'de',
  Spanish = 'es',
  French = 'fr',
  Italian = 'it',
  Japanese = 'ja',
  Korean = 'ko',
  PortugueseBrazil = 'pt-BR',
  PortuguesePortugal = 'pt-PT',
  ChineseSimplified = 'zh-Hans',
}

export type I18nRecord = Partial<Record<ContentLanguage, string>>;

export const validLanguages = Object.values(ContentLanguage);

export type PropsParameters<T extends (props: never) => unknown> = T extends (
  props: infer P,
) => unknown
  ? P
  : never;

export enum PostCodeSnippetLanguage {
  Plain = 'plain',
}

export type PostCodeSnippetJsonFile = {
  snippets: string[];
};
