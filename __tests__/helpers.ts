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
import {
  Message,
  TypedWorker,
  Worker,
  TypedNotificationWorker,
} from '../src/workers/worker';
import { base64, PubSubSchema, triggerTypedEvent } from '../src/common';
import { Roles } from '../src/roles';
import { Cron } from '../src/cron/cron';
import { ChangeMessage, ChangeObject, ContentLanguage } from '../src/types';
import { PubSub } from '@google-cloud/pubsub';
import { Logger } from 'pino';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import appFunc from '../src';
import createOrGetConnection from '../src/db';
import { NotificationHandlerReturn } from '../src/workers/notifications/worker';
import {
  generateNotificationV2,
  NotificationBaseContext,
  storeNotificationBundleV2,
} from '../src/notifications';
import { NotificationType } from '../src/notifications/common';
import { DataLoaderService, defaultCacheKeyFn } from '../src/dataLoaderService';
import { opentelemetry } from '../src/telemetry/opentelemetry';
import { logger } from '../src/logger';
import {
  Code as ConnectCode,
  ConnectError,
  createRouterTransport,
} from '@connectrpc/connect';
import {
  ApplicationService as GondulService,
  Credits,
  TransferType,
  type TransferStatus,
  ScreeningQuestionsResponse,
  BrokkrService,
  ExtractMarkdownResponse,
  ParseCVResponse,
} from '@dailydotdev/schema';
import { createClient, type ClickHouseClient } from '@clickhouse/client';
import * as clickhouseCommon from '../src/common/clickhouse';
import { Message as ProtobufMessage } from '@bufbuild/protobuf';
import { GarmrService } from '../src/integrations/garmr';
import { userExperienceCertificationFixture } from './fixture/profile/certification';
import { userExperienceEducationFixture } from './fixture/profile/education';
import { userExperienceProjectFixture } from './fixture/profile/project';
import { userExperienceWorkFixture } from './fixture/profile/work';

export class MockContext extends Context {
  mockSpan: MockProxy<opentelemetry.Span> & opentelemetry.Span;
  mockUserId: string | null;
  mockRoles: Roles[];
  mockIsTeamMember: boolean;
  mockIsPlus: boolean;
  logger: FastifyLoggerInstance;
  contentLanguage: ContentLanguage;
  mockRegion: string;

  constructor(
    con: DataSource,
    userId: string | null = null,
    roles = [],
    req?: FastifyRequest,
    isTeamMember = false,
    isPlus = false,
    region = '',
  ) {
    super(mock<FastifyRequest>(), con);
    this.mockSpan = mock<opentelemetry.Span>();
    this.mockSpan.setAttributes.mockImplementation(() =>
      mock<opentelemetry.Span>(),
    );
    this.mockUserId = userId;
    this.mockRoles = roles;
    this.mockIsTeamMember = isTeamMember;
    this.mockIsPlus = isPlus;
    this.logger = mock<FastifyLoggerInstance>();
    this.mockRegion = region;

    if (req?.headers['content-language']) {
      this.contentLanguage = req.headers['content-language'] as ContentLanguage;
    }
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

  get isTeamMember(): boolean {
    return this.mockIsTeamMember;
  }

  get roles(): Roles[] {
    return this.mockRoles;
  }

  get log(): FastifyLoggerInstance {
    return this.logger;
  }

  get isPlus(): boolean {
    return this.mockIsPlus;
  }

  get region(): string {
    return this.mockRegion;
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
  callback?: (errors: readonly GraphQLFormattedError[]) => void | Promise<void>,
): Promise<void> =>
  testMutationError(client, mutation, (errors) => {
    expect(errors?.length || 0).toEqual(1);
    expect(errors[0].extensions?.code).toEqual(code);
    if (message) {
      expect(errors[0].message).toEqual(message);
    }
    return callback?.(errors);
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
  message?: string,
  callback?: (errors: readonly GraphQLFormattedError[]) => void | Promise<void>,
): Promise<void> =>
  testQueryError(client, query, (errors) => {
    expect(errors?.length || 0).toEqual(1);
    expect(errors[0].extensions?.code).toEqual(code);
    if (message) {
      expect(errors[0].message).toEqual(message);
    }
    return callback?.(errors);
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

export const invokeTypedNotificationWorker = async <
  T extends keyof PubSubSchema,
>(
  worker: TypedNotificationWorker<T>,
  data: PubSubSchema[T],
): Promise<NotificationHandlerReturn> => {
  const con = await createOrGetConnection();

  // Create message data based on whether it's a protobuf type or not
  const messageData =
    data instanceof ProtobufMessage
      ? Buffer.from(data.toBinary())
      : Buffer.from(JSON.stringify(data), 'utf-8');

  const message: Message = {
    data: messageData,
    messageId: '1',
  };

  // Simulate the internal wrapper logic that parses the message
  const parser =
    worker.parseMessage ||
    ((msg: Message) => JSON.parse(msg.data.toString('utf-8')));
  const parsedData = parser(message);

  return worker.handler(parsedData, con, logger);
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

export const doNotFake: FakeableAPI[] = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

export const createMockBrokkrTransport = () =>
  createRouterTransport(({ service }) => {
    service(BrokkrService, {
      extractMarkdown: (request) => {
        if (request.blobName === 'error.pdf') {
          throw new ConnectError('Not found', ConnectCode.NotFound);
        }

        return new ExtractMarkdownResponse({
          content: `# Extracted content for ${request.blobName} in ${request.bucketName}`,
        });
      },
      parseCV: (request) => {
        if (request.blobName === 'empty-cv-mock') {
          return new ParseCVResponse({});
        }

        return new ParseCVResponse({
          parsedCv: JSON.stringify([
            userExperienceCertificationFixture[0],
            userExperienceEducationFixture[0],
            userExperienceProjectFixture[0],
            userExperienceWorkFixture[0],
          ]),
        });
      },
    });
  });

export const createMockNjordTransport = () => {
  return createRouterTransport(({ service }) => {
    const accounts: Record<
      string,
      {
        amount: number;
      }
    > = {};

    service(Credits, {
      getBalance: (request) => {
        return (
          accounts[request.account!.userId] || {
            amount: BigInt(0),
          }
        );
      },
      transfer: (transferRequest) => {
        const [request] = transferRequest.transfers;
        const receiverAccount = accounts[request.receiver!.id] || {
          amount: BigInt(0),
        };
        const senderAccount = accounts[request.sender!.id] || {
          amount: BigInt(0),
        };

        receiverAccount.amount += request.amount;
        senderAccount.amount -= request.amount;

        accounts[request.receiver!.id] = receiverAccount;
        accounts[request.sender!.id] = senderAccount;

        return {
          idempotencyKey: transferRequest.idempotencyKey,
          results: [
            {
              senderId: request.sender?.id,
              senderBalance: {
                previousBalance: 0,
                newBalance: senderAccount.amount,
                changeAmount: -request.amount,
              },
              receiverId: request.receiver?.id,
              receiverBalance: {
                previousBalance: 0,
                newBalance: receiverAccount.amount,
                changeAmount: request.amount,
              },
              timestamp: Date.now(),
              transferType: TransferType.TRANSFER,
            },
          ],
        };
      },
    });
  });
};

export const createMockNjordErrorTransport = ({
  errorStatus,
  errorMessage = 'something broke',
}: {
  errorStatus: TransferStatus;
  errorMessage?: string;
}) => {
  return createRouterTransport(({ service }) => {
    const accounts: Record<
      string,
      {
        amount: number;
      }
    > = {};

    service(Credits, {
      getBalance: (request) => {
        return (
          accounts[request.account!.userId] || {
            amount: BigInt(0),
          }
        );
      },
      transfer: (transferRequest) => {
        const [request] = transferRequest.transfers;

        const receiverAccount = accounts[request.receiver!.id] || {
          amount: BigInt(0),
        };
        const senderAccount = accounts[request.sender!.id] || {
          amount: BigInt(0),
        };

        return {
          idempotencyKey: transferRequest.idempotencyKey,
          status: errorStatus,
          errorMessage,
          results: [
            {
              senderId: request.sender?.id,
              senderBalance: {
                previousBalance: senderAccount.amount,
                newBalance: senderAccount.amount,
                changeAmount: -request.amount,
              },
              receiverId: request.receiver?.id,
              receiverBalance: {
                previousBalance: receiverAccount.amount,
                newBalance: receiverAccount.amount,
                changeAmount: request.amount,
              },
              timestamp: Date.now(),
              transferType: TransferType.TRANSFER,
            },
          ],
          timestamp: Date.now(),
        };
      },
    });
  });
};

export const mockClickhouseClientOnce = () => {
  const clientMock = createClient({});

  jest
    .spyOn(clickhouseCommon, 'getClickHouseClient')
    .mockImplementationOnce(() => {
      return clientMock;
    });

  return clientMock;
};

export const mockClickhouseQueryJSONOnce = <T>(
  client: ClickHouseClient,
  data: T,
): jest.SpyInstance => {
  return jest.spyOn(client, 'query').mockImplementationOnce(() => {
    return {
      json: async () => {
        return data;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });
};

export const createMockGondulTransport = ({
  screeningQuestions,
}: {
  screeningQuestions?: string[];
} = {}) => {
  return createRouterTransport(({ service }) => {
    service(GondulService, {
      screeningQuestions: () => {
        return new ScreeningQuestionsResponse({
          screening: screeningQuestions ?? [
            `You're tasked with optimizing a React component that renders a list of 1000+ issues in Linear's interface, but users are experiencing lag when scrolling. Walk me through your approach to diagnosing and solving this performance problem, including what specific techniques you'd consider and how you'd measure success.`,
            `Describe a time when you had to make a significant architectural decision for a frontend codebase that would impact other developers. What was the decision, what factors did you weigh, and how did you ensure buy-in from your team while maintaining code quality and developer experience?`,
            `Linear's design system needs to support both light and dark themes while maintaining consistent spacing, typography, and component behavior across the entire application. How would you structure the CSS-in-JS or styling approach in a React/TypeScript codebase to make this scalable and maintainable for a growing team?`,
          ],
        });
      },
    });
  });
};

export const createGarmrMock = () => {
  return new GarmrService({
    service: 'mock',
    breakerOpts: {
      halfOpenAfter: Infinity,
      threshold: 1,
      duration: 0,
    },
    retryOpts: {
      maxAttempts: Infinity,
    },
  });
};
