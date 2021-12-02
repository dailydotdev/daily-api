import { mock, MockProxy } from 'jest-mock-extended';
import fastify, {
  FastifyRequest,
  FastifyLoggerInstance,
  FastifyInstance,
} from 'fastify';
import fastifyStatic from 'fastify-static';
import { Connection, DeepPartial, getConnection, ObjectType } from 'typeorm';
import request from 'supertest';
import {
  RootSpan,
  Span,
} from '@google-cloud/trace-agent/build/src/plugin-types';
import { GraphQLFormattedError } from 'graphql';
import { Context } from '../src/Context';
import { Message, Worker } from '../src/workers/worker';
import { base64 } from '../src/common';
import { join } from 'path';
import http from 'http';
import { Roles } from '../src/roles';
import { Cron } from '../src/cron/cron';
import { ChangeMessage, ChangeObject } from '../src/types';
import { PubSub } from '@google-cloud/pubsub';
import pino from 'pino';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import appFunc from '../src';

export class MockContext extends Context {
  mockSpan: MockProxy<RootSpan> & RootSpan;
  mockUserId: string | null;
  mockPremium: boolean;
  mockRoles: Roles[];
  logger: FastifyLoggerInstance;

  constructor(
    con: Connection,
    userId: string = null,
    premium = false,
    roles = [],
  ) {
    super(mock<FastifyRequest>(), con);
    this.mockSpan = mock<RootSpan>();
    this.mockSpan.createChildSpan.mockImplementation(() => mock<Span>());
    this.mockUserId = userId;
    this.mockPremium = premium;
    this.mockRoles = roles;
    this.logger = mock<FastifyLoggerInstance>();
  }

  get span(): RootSpan {
    return this.mockSpan;
  }

  get userId(): string | null {
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
): Promise<void> =>
  testMutationError(client, mutation, (errors) => {
    expect(errors.length).toEqual(1);
    expect(errors[0].extensions.code).toEqual(code);
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
    expect(errors[0].extensions.code).toEqual(code);
  });

export async function saveFixtures<Entity>(
  con: Connection,
  target: ObjectType<Entity>,
  entities: DeepPartial<Entity>[],
): Promise<void> {
  await con
    .getRepository(target)
    .save(entities.map((e) => con.getRepository(target).create(e)));
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
  const con = await getConnection();
  const pubsub = new PubSub();
  const logger = pino();
  await worker.handler(mockMessage(data).message, con, logger, pubsub);
};

export const expectSuccessfulBackground = (
  worker: Worker,
  data: Record<string, unknown>,
): Promise<void> => invokeBackground(worker, data);

export const invokeCron = async (
  cron: Cron,
  data: Record<string, unknown> = undefined,
): Promise<void> => {
  const con = await getConnection();
  const pubsub = new PubSub();
  const logger = pino();
  await cron.handler(
    con,
    logger,
    pubsub,
    data ? mockMessage(data).message.data : Buffer.from(''),
  );
};

export const expectSuccessfulCron = (
  cron: Cron,
  data: Record<string, unknown> = undefined,
): Promise<void> => invokeCron(cron, data);

export const setupStaticServer = async (
  rss?: string,
): Promise<FastifyInstance> => {
  const app = fastify({ logger: false });
  app.register(fastifyStatic, {
    root: join(__dirname, 'fixture'),
    prefix: '/',
    setHeaders(res: http.ServerResponse, path: string): void {
      if (rss && path.indexOf(rss) > -1) {
        res.setHeader('content-type', 'application/rss+xml');
      }
    },
  });
  if (rss) {
    app.get('/rss.xml', (req, res) => {
      res.sendFile(rss);
    });
  }
  await app.listen(6789);
  return app;
};

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
