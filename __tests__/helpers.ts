import { mock, MockProxy } from 'jest-mock-extended';
import {
  FastifyRequest,
  FastifyLoggerInstance,
  FastifyInstance,
} from 'fastify';
import { DataSource, DeepPartial, ObjectType } from 'typeorm';
import request from 'supertest';
import { GraphQLFormattedError } from 'graphql';
import { Context } from '../src/Context';
import { Message, TypedWorker, Worker } from '../src/workers/worker';
import { base64, PubSubSchema, triggerTypedEvent } from '../src/common';
import { Roles } from '../src/roles';
import { Cron } from '../src/cron/cron';
import { ChangeMessage, ChangeObject } from '../src/types';
import { PubSub } from '@google-cloud/pubsub';
import { Logger } from 'pino';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import appFunc from '../src';
import createOrGetConnection from '../src/db';
import {
  NotificationHandlerReturn,
  NotificationWorker,
} from '../src/workers/notifications/worker';
import {
  generateNotificationV2,
  NotificationBaseContext,
  storeNotificationBundleV2,
} from '../src/notifications';
import { NotificationType } from '../src/notifications/common';
import { DataLoaderService, defaultCacheKeyFn } from '../src/dataLoaderService';
import { opentelemetry } from '../src/telemetry/opentelemetry';
import { logger } from '../src/logger';

export class MockContext extends Context {
  mockSpan: MockProxy<opentelemetry.Span> & opentelemetry.Span;
  mockUserId: string | null;
  mockPremium: boolean;
  mockRoles: Roles[];
  logger: FastifyLoggerInstance;

  constructor(
    con: DataSource,
    userId: string = null,
    premium = false,
    roles = [],
  ) {
    super(mock<FastifyRequest>(), con);
    this.mockSpan = mock<opentelemetry.Span>();
    this.mockSpan.setAttributes.mockImplementation(() =>
      mock<opentelemetry.Span>(),
    );
    this.mockUserId = userId;
    this.mockPremium = premium;
    this.mockRoles = roles;
    this.logger = mock<FastifyLoggerInstance>();
  }

  get span(): opentelemetry.Span {
    return this.mockSpan;
  }

  get userId(): string | null {
    return this.mockUserId;
  }

  get trackingId(): string | null {
    return this.mockUserId;
  }

  get premium(): boolean | null {
    return this.mockPremium;
  }

  get roles(): Roles[] {
    return this.mockRoles;
  }

  get log(): FastifyLoggerInstance {
    return this.logger;
  }
}

export type GraphQLTestClient = ReturnType<typeof createMercuriusTestClient>;
export type GraphQLTestingState = {
  app: FastifyInstance;
  client: GraphQLTestClient;
};

export const initializeGraphQLTesting = async (
  contextFn: (request: FastifyRequest) => Context,
): Promise<GraphQLTestingState> => {
  const app = await appFunc(contextFn);
  const client = createMercuriusTestClient(app);
  await app.ready();
  return { app, client };
};

export const disposeGraphQLTesting = async ({
  app,
}: GraphQLTestingState): Promise<void> => {
  await app.close();
};

export const authorizeRequest = (
  req: request.Test,
  userId = '1',
  roles: Roles[] = [],
): request.Test =>
  req
    .set('authorization', `Service ${process.env.ACCESS_SECRET}`)
    .set('user-id', userId)
    .set('logged-in', 'true')
    .set('roles', roles.join(','));

export type Mutation = {
  mutation: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables?: { [name: string]: any };
};

export const testMutationError = async (
  client: GraphQLTestClient,
  mutation: Mutation,
  callback: (errors: readonly GraphQLFormattedError[]) => void | Promise<void>,
): Promise<void> => {
  const res = await client.mutate(mutation.mutation, {
    variables: mutation.variables,
  });
  return callback(res.errors);
};

export const testMutationErrorCode = async (
  client: GraphQLTestClient,
  mutation: Mutation,
  code: string,
  message?: string,
): Promise<void> =>
  testMutationError(client, mutation, (errors) => {
    expect(errors.length).toEqual(1);
    expect(errors[0].extensions?.code).toEqual(code);
    if (message) {
      expect(errors[0].message).toEqual(message);
    }
  });

export type Query = {
  query: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables?: { [name: string]: any };
};

export const testQueryError = async (
  client: GraphQLTestClient,
  query: Query,
  callback: (errors: readonly GraphQLFormattedError[]) => void | Promise<void>,
): Promise<void> => {
  const res = await client.query(query.query, { variables: query.variables });
  return callback(res.errors);
};

export const testQueryErrorCode = async (
  client: GraphQLTestClient,
  query: Query,
  code: string,
): Promise<void> =>
  testQueryError(client, query, (errors) => {
    expect(errors.length).toEqual(1);
    expect(errors[0].extensions?.code).toEqual(code);
  });

export async function saveFixtures<Entity>(
  con: DataSource,
  target: ObjectType<Entity>,
  entities: DeepPartial<Entity>[],
): Promise<void> {
  await con.getRepository(target).save(
    entities.map((e) => {
      con.getRepository(target).create(e);
      return e;
    }),
  );
}

export const mockMessage = (
  data: Record<string, unknown>,
): { message: Message } => {
  const message: Message = {
    data: Buffer.from(base64(JSON.stringify(data)), 'base64'),
    messageId: '1',
  };
  return { message };
};

export const invokeBackground = async (
  worker: Worker,
  data: Record<string, unknown>,
): Promise<void> => {
  const con = await createOrGetConnection();
  const pubsub = new PubSub();
  await worker.handler(mockMessage(data).message, con, logger, pubsub);
};

export const expectSuccessfulBackground = (
  worker: Worker,
  data: Record<string, unknown>,
): Promise<void> => invokeBackground(worker, data);

export const invokeNotificationWorker = async (
  worker: NotificationWorker,
  data: Record<string, unknown>,
): Promise<NotificationHandlerReturn> => {
  const con = await createOrGetConnection();
  return worker.handler(mockMessage(data).message, con, logger);
};

export const invokeCron = async (cron: Cron, logger: Logger): Promise<void> => {
  const con = await createOrGetConnection();
  const pubsub = new PubSub();
  await cron.handler(con, logger, pubsub);
};

export const expectSuccessfulCron = (cron: Cron): Promise<void> =>
  invokeCron(cron, logger);

export const mockChangeMessage = <T>({
  before,
  after,
  table,
  op,
}: {
  before?: ChangeObject<T>;
  after?: ChangeObject<T>;
  table: string;
  op: 'c' | 'u' | 'd' | 'r';
}): ChangeMessage<T> => ({
  schema: {
    type: 'type',
    fields: [],
    optional: false,
    name: 'name',
  },
  payload: {
    before,
    after,
    source: {
      version: '1',
      connector: 'api',
      name: 'api',
      ts_ms: 0,
      snapshot: false,
      db: 'api',
      sequence: 's',
      schema: 'public',
      table,
      txId: 0,
      lsn: 0,
      xmin: 0,
    },
    op,
    ts_ms: 0,
    transaction: 0,
  },
});

export const saveNotificationV2Fixture = async (
  con: DataSource,
  type: NotificationType,
  ctx: NotificationBaseContext,
): Promise<string> => {
  const res = await con.transaction((entityManager) =>
    storeNotificationBundleV2(entityManager, generateNotificationV2(type, ctx)),
  );
  return res[0].id;
};

export const TEST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36';

export class MockDataLoaderService extends DataLoaderService {
  public loaders: DataLoaderService['loaders'];
  public getLoader: DataLoaderService['getLoader'];
  public mockLoadFn = jest.fn(async (key) => {
    if (key instanceof Error) {
      throw key;
    }

    return key;
  });

  get test() {
    return this.getLoader({
      type: 'test',
      loadFn: this.mockLoadFn,
      cacheKeyFn: defaultCacheKeyFn,
    });
  }
}

export const invokeTypedBackground = async <T extends keyof PubSubSchema>(
  worker: TypedWorker<T>,
  data: PubSubSchema[T],
): Promise<void> => {
  const con = await createOrGetConnection();
  const pubsub = new PubSub();
  await worker.handler({ data, messageId: 'msg' }, con, logger, pubsub);
};

export const expectSuccessfulTypedBackground = <T extends keyof PubSubSchema>(
  worker: TypedWorker<T>,
  data: PubSubSchema[T],
): Promise<void> => invokeTypedBackground(worker, data);

export const feedFields = (extra = '') => `
pageInfo {
  endCursor
  hasNextPage
}
edges {
  node {
    ${extra}
    id
    url
    title
    readTime
    tags
    type
    source {
      id
      name
      image
      public
    }
  }
}`;

export function expectTypedEvent<T extends keyof PubSubSchema>(
  topic: T,
  data: PubSubSchema[T],
): void {
  expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  expect(triggerTypedEvent).toHaveBeenCalledWith(
    expect.anything(),
    topic,
    data,
  );
}
