import type { Roles } from './roles';
import type { AccessToken } from './auth';
import type { opentelemetry } from './telemetry';

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
      INTERNAL_FEED: string;
      ROASTER_URL: string;
      MAGNI_ORIGIN: string;
      ANALYTICS_URL: string;
      POST_SCRAPER_ORIGIN: string;
      SUBMIT_ARTICLE_THRESHOLD: string;
      SLACK_SIGNING_SECRET: string;
      API_CONFIG_FEATURE_KEY: string;
      VALID_LANGUAGES_FEATURE_KEY: string;
      PADDLE_API_KEY: string;
      PADDLE_WEBHOOK_SECRET: string;
      PADDLE_ENVIRONMENT: string;
      SLACK_WEBHOOK: string;
      SLACK_COMMENTS_WEBHOOK: string;
      SLACK_VORDR_WEBHOOK: string;
      SLACK_TRANSACTIONS_WEBHOOK: string;
      SLACK_ADS_WEBHOOK: string;
      NJORD_ORIGIN: string;
      OPEN_EXCHANGE_RATES_APP_ID?: string;
      SKADI_ORIGIN: string;
      SKADI_API_ORIGIN: string;
      SKADI_API_ORIGIN_V2: string;

      APPLE_APP_APPLE_ID: string;
      APPLE_APP_BUNDLE_ID: string;

      GEOIP_PATH?: string;
      RESUME_BUCKET_NAME: string;
      EMPLOYMENT_AGREEMENT_BUCKET_NAME: string;
    }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    // Used for auth
    userId?: string;
    roles?: Roles[];
    service?: boolean;
    accessToken?: AccessToken;
    isTeamMember?: boolean;
    isPlus: boolean;

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
  >]: Required<Type>[Property] extends Date
    ? number
    : Required<Type>[Property] extends Record<string | number | symbol, unknown>
      ? string
      : Type[Property];
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

export const maxFeedsPerUser = 20;

export const maxBookmarksPerMutation = 10;

export enum BookmarkListCountLimit {
  Free = 0,
  Plus = 50,
}

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

export enum CoresRole {
  None = 0,
  ReadOnly = 1,
  User = 2,
  Creator = 3,
}

export const serviceClientId = 'api';

export type GeoRecord = Partial<{
  country: string;
  continent: string;
  city: string;
  location: Partial<{
    lat: number;
    lng: number;
    accuracyRadius: number;
  }>;
  subdivision?: string;
}>;

export enum StreakRestoreCoresPrice {
  First = 0,
  Regular = 100,
}

/**
 * Map of accepted file extensions to their corresponding MIME types.
 */
export type AcceptedFilesMap = Record<string, { mime: Array<string> }>;

/**
 * Defines a fully typed map of accepted file extensions to their corresponding MIME types.
 * @param map - Map of accepted file extensions to their corresponding MIME types.
 * @returns The same map, for convenience.
 */
export const defineAcceptedFilesMap = <T extends AcceptedFilesMap>(map: T): T =>
  map;

export const acceptedResumeFileTypes: Array<Record<'mime' | 'ext', string>> = [
  { mime: 'application/pdf', ext: 'pdf' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
  },
] as const;
export const acceptedResumeExtensions = [
  'pdf',
  'docx',
] as const satisfies Array<(typeof acceptedResumeFileTypes)[number]['ext']>;

export const clickhouseMigrationsDir = 'clickhouse/migrations';

export const clickhouseMigrationFilenameMatch =
  /^(\d+)_([a-zA-Z_]+)\.(up|down)\.sql$/i;

export enum MultipleSourcesPostItemType {
  Post = 'post',
  ModerationItem = 'moderationItem',
}

export interface MultipleSourcesPostResult {
  id: string;
  type: MultipleSourcesPostItemType;
  sourceId: string;
}
