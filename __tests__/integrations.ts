import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  UserIntegration,
  UserIntegrationType,
} from '../src/entity/UserIntegration';
import { usersFixture } from './fixture/user';
import { Source, User } from '../src/entity';
import { Context } from '../src/Context';
import { sourcesFixture } from './fixture/source';

jest.mock('@slack/web-api', () => ({
  ...(jest.requireActual('@slack/web-api') as Record<string, unknown>),
  WebClient: function () {
    return {
      conversations: {
        list: jest.fn().mockResolvedValue({
          ok: true,
          channels: [
            {
              id: '1',
              name: 'channel1',
            },
            {
              id: '2',
              name: 'channel2',
            },
          ],
          response_metadata: {
            next_cursor: 'next-cursor',
          },
        }),
        info: ({ channel }) => {
          return {
            ok: true,
            channel: {
              id: channel,
            },
          };
        },
        join: jest.fn().mockResolvedValue({
          ok: true,
        }),
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue({
          ok: true,
        }),
      },
    };
  },
}));

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | undefined;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser) as unknown as Context,
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = undefined;
});

afterAll(() => disposeGraphQLTesting(state));

const getIntegrationId = async ({
  type,
  userId,
}: {
  type: UserIntegrationType;
  userId: string;
}) => {
  const integration = await con.getRepository(UserIntegration).findOneByOrFail({
    type,
    userId,
  });

  return integration;
};

describe('slack integration', () => {
  beforeEach(async () => {
    await saveFixtures(con, User, usersFixture);
    await saveFixtures(con, Source, sourcesFixture);
    await con.getRepository(UserIntegration).save([
      {
        userId: '1',
        type: UserIntegrationType.Slack,
        name: 'daily.dev',
        meta: {
          appId: 'sapp1',
          scope: 'channels:read,chat:write,channels:join',
          teamId: 'st1',
          teamName: 'daily.dev',
          tokenType: 'bot',
          accessToken: 'xoxb-token',
          slackUserId: 'su1',
        },
      },
    ]);
  });

  describe('query slackChannels', () => {
    const QUERY = ({ integrationId, limit = 999 }) => `
      query {
        slackChannels(integrationId: "${integrationId}", limit: ${limit}) {
          data {
            id
            name
          }
          cursor
        }
      }
    `;

    it('should require authentication', async () => {
      await testQueryErrorCode(
        client,
        {
          query: QUERY({
            integrationId: 'integration-id',
          }),
        },
        'UNAUTHENTICATED',
      );
    });

    it('should return a list of slack channels', async () => {
      loggedUser = '1';
      const userIntegration = await getIntegrationId({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      const res = await client.query(
        QUERY({
          integrationId: userIntegration.id,
        }),
      );

      expect(res.errors).toBeFalsy();
      expect(res.data.slackChannels).toMatchObject({
        data: [
          { id: '1', name: 'channel1' },
          { id: '2', name: 'channel2' },
        ],
        cursor: 'next-cursor',
      });
    });
  });

  describe('mutation slackConnectSource', () => {
    const MUTATION = ({ integrationId, channelId, sourceId }) => `
      mutation {
        slackConnectSource(
          integrationId: "${integrationId}",
          channelId: "${channelId}",
          sourceId: "${sourceId}"
        ) {
          _
        }
      }
    `;

    it('should require authentication', async () => {
      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION({
            integrationId: 'integration-id',
            channelId: 'channel-id',
            sourceId: 'source-id',
          }),
        },
        'UNAUTHENTICATED',
      );
    });

    it('should connect a slack channel to a source', async () => {
      loggedUser = '1';
      const userIntegration = await getIntegrationId({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      const res = await client.mutate(
        MUTATION({
          integrationId: userIntegration.id,
          channelId: '1',
          sourceId: 'a',
        }),
      );

      expect(res.errors).toBeFalsy();
    });
  });
});
