import { Roles } from './roles';
import { AccessToken } from './auth';
import { opentelemetry } from './telemetry/opentelemetry';

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
    meter?: opentelemetry.Meter;
  }

  interface FastifyInstance {
    // Used for tracing
    tracer?: opentelemetry.Tracer;
    meter?: opentelemetry.Meter;
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

export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}
