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
import {
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  User,
} from '../src/entity';
import { Context } from '../src/Context';
import { sourcesFixture } from './fixture/source';
import { encrypt } from '../src/common';
import {
  UserSourceIntegration,
  UserSourceIntegrationSlack,
} from '../src/entity/UserSourceIntegration';
import { SourceMemberRoles } from '../src/roles';
import { addSeconds } from 'date-fns';

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

const getIntegration = async ({
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
          accessToken: await encrypt(
            'xoxb-token',
            process.env.SLACK_DB_KEY as string,
          ),
          slackUserId: 'su1',
        },
      },
    ]);
    await con.getRepository(SquadSource).save([
      {
        id: 'squadslack',
        name: 'Squad Slack',
        image: 'http//image.com/s',
        handle: 'squadslack',
        type: SourceType.Squad,
        active: true,
        private: true,
      },
      {
        id: 'squadslack2',
        name: 'Squad Slack 2',
        image: 'http//image.com/s2',
        handle: 'squadslack2',
        type: SourceType.Squad,
        active: true,
        private: true,
      },
      {
        id: 'squadslack3',
        name: 'Squad Slack 3',
        image: 'http//image.com/s3',
        handle: 'squadslack3',
        type: SourceType.Squad,
        active: true,
        private: true,
      },
    ]);
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'squadslack',
        userId: '1',
        role: SourceMemberRoles.Admin,
        referralToken: 'squadslacktoken1',
      },
      {
        sourceId: 'squadslack',
        userId: '2',
        role: SourceMemberRoles.Admin,
        referralToken: 'squadslacktoken2',
      },
      {
        sourceId: 'squadslack',
        userId: '3',
        role: SourceMemberRoles.Member,
        referralToken: 'squadslacktoken3',
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
      const userIntegration = await getIntegration({
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
      const userIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      const res = await client.mutate(
        MUTATION({
          integrationId: userIntegration.id,
          channelId: '1',
          sourceId: 'squadslack',
        }),
      );

      expect(res.errors).toBeFalsy();
    });

    it('should update channel for source', async () => {
      loggedUser = '1';
      const userIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      const res = await client.mutate(
        MUTATION({
          integrationId: userIntegration.id,
          channelId: '1',
          sourceId: 'squadslack',
        }),
      );

      expect(res.errors).toBeFalsy();

      const userSourceIntegration = await con
        .getRepository(UserSourceIntegration)
        .findOneByOrFail({
          userIntegrationId: userIntegration.id,
          sourceId: 'squadslack',
        });
      expect(userSourceIntegration).toMatchObject({
        channelIds: ['1'],
      });

      const resUpdate = await client.mutate(
        MUTATION({
          integrationId: userIntegration.id,
          channelId: '2',
          sourceId: 'squadslack',
        }),
      );

      expect(resUpdate.errors).toBeFalsy();

      const userSourceIntegrationUpdate = await con
        .getRepository(UserSourceIntegration)
        .findOneByOrFail({
          userIntegrationId: userIntegration.id,
          sourceId: 'squadslack',
        });
      expect(userSourceIntegrationUpdate).toMatchObject({
        channelIds: ['2'],
      });
    });

    it('should not allow connecting source if existing connection is already present', async () => {
      loggedUser = '2';

      await con.getRepository(UserIntegration).save([
        {
          userId: '2',
          type: UserIntegrationType.Slack,
          name: 'daily.dev',
          meta: {
            appId: 'sapp1',
            scope: 'channels:read,chat:write,channels:join',
            teamId: 'st1',
            teamName: 'daily.dev',
            tokenType: 'bot',
            accessToken: await encrypt(
              'xoxb-token',
              process.env.SLACK_DB_KEY as string,
            ),
            slackUserId: 'su2',
          },
        },
      ]);
      const existingUserIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: '1',
      });
      const userIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      await con.getRepository(UserSourceIntegrationSlack).save([
        {
          userIntegrationId: existingUserIntegration.id,
          sourceId: 'squadslack',
          channelIds: ['1'],
        },
      ]);

      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION({
            integrationId: userIntegration.id,
            channelId: '1',
            sourceId: 'squadslack',
          }),
        },
        'CONFLICT',
      );
    });

    it('should return error if user does not have access to source', async () => {
      loggedUser = '4';

      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION({
            integrationId: 'integration-id',
            channelId: '1',
            sourceId: 'squadslack',
          }),
        },
        'FORBIDDEN',
      );
    });

    it('should return error if user is not admin', async () => {
      loggedUser = '3';

      await testMutationErrorCode(
        client,
        {
          mutation: MUTATION({
            integrationId: 'integration-id',
            channelId: '1',
            sourceId: 'squadslack',
          }),
        },
        'FORBIDDEN',
      );
    });
  });

  describe('query sourceIntegration', () => {
    const QUERY = ({ sourceId, type }) => `
      query {
        sourceIntegration(sourceId: "${sourceId}", type: ${type}) {
          userIntegration {
            id
            userId
          }
          type
          createdAt
          updatedAt
          source {
            id
          }
        }
      }
    `;

    it('should require authentication', async () => {
      await testQueryErrorCode(
        client,
        {
          query: QUERY({
            sourceId: 'source-id',
            type: UserIntegrationType.Slack,
          }),
        },
        'UNAUTHENTICATED',
      );
    });

    it('should return source integration', async () => {
      loggedUser = '1';

      const userIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      await con.getRepository(UserSourceIntegrationSlack).save([
        {
          userIntegrationId: userIntegration.id,
          sourceId: 'squadslack',
          channelIds: ['1'],
        },
      ]);

      const res = await client.query(
        QUERY({
          sourceId: 'squadslack',
          type: UserIntegrationType.Slack,
        }),
      );

      expect(res.errors).toBeFalsy();
      expect(res.data.sourceIntegration).toMatchObject({
        userIntegration: {
          id: userIntegration.id,
          userId: userIntegration.userId,
        },
        type: UserIntegrationType.Slack,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        source: {
          id: 'squadslack',
        },
      });
    });

    it('should return error if source integration does not exist', async () => {
      loggedUser = '1';

      await testQueryErrorCode(
        client,
        {
          query: QUERY({
            sourceId: 'squadslack',
            type: UserIntegrationType.Slack,
          }),
        },
        'NOT_FOUND',
      );
    });

    it('should return error if user does not have access to source', async () => {
      loggedUser = '4';

      await testQueryErrorCode(
        client,
        {
          query: QUERY({
            sourceId: 'squadslack',
            type: UserIntegrationType.Slack,
          }),
        },
        'FORBIDDEN',
      );
    });

    it('should return error if user is not admin', async () => {
      loggedUser = '3';

      await testQueryErrorCode(
        client,
        {
          query: QUERY({
            sourceId: 'squadslack',
            type: UserIntegrationType.Slack,
          }),
        },
        'FORBIDDEN',
      );
    });

    it('should return source if user has access to private source', async () => {
      loggedUser = '1';

      const userIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });
      await con.getRepository(UserSourceIntegrationSlack).save([
        {
          userIntegrationId: userIntegration.id,
          sourceId: 'squadslack',
          channelIds: ['1'],
        },
      ]);

      const res = await client.query(
        QUERY({
          sourceId: 'squadslack',
          type: UserIntegrationType.Slack,
        }),
      );

      expect(res.errors).toBeFalsy();
      expect(res.data.sourceIntegration).toMatchObject({
        userIntegration: {
          id: userIntegration.id,
          userId: userIntegration.userId,
        },
        type: UserIntegrationType.Slack,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        source: {
          id: 'squadslack',
        },
      });
    });
  });

  describe('query sourceIntegrations', () => {
    const QUERY = ({ integrationId }) => `
      query {
        sourceIntegrations(integrationId: "${integrationId}") {
          edges {
            node {
              userIntegration {
                id
                userId
              }
              type
              createdAt
              updatedAt
              source {
                id
              }
            }
          }
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

    it('should return source integrations', async () => {
      loggedUser = '1';

      const [additionalIntegration] = await con
        .getRepository(UserIntegration)
        .save([
          {
            userId: '2',
            type: UserIntegrationType.Slack,
            name: 'daily.dev',
            meta: {
              appId: 'sapp1',
              scope: 'channels:read,chat:write,channels:join',
              teamId: 'st1',
              teamName: 'daily.dev',
              tokenType: 'bot',
              accessToken: await encrypt(
                'xoxb-token',
                process.env.SLACK_DB_KEY as string,
              ),
              slackUserId: 'su2',
            },
          },
        ]);

      const userIntegration = await getIntegration({
        type: UserIntegrationType.Slack,
        userId: loggedUser,
      });

      const createdAt = new Date();

      await con.getRepository(UserSourceIntegrationSlack).save([
        {
          userIntegrationId: userIntegration.id,
          sourceId: 'squadslack',
          channelIds: ['1'],
          createdAt: addSeconds(createdAt, 3),
        },
        {
          userIntegrationId: userIntegration.id,
          sourceId: 'squadslack2',
          channelIds: ['2'],
          createdAt: addSeconds(createdAt, 2),
        },
        {
          userIntegrationId: additionalIntegration.id,
          sourceId: 'squadslack3',
          channelIds: ['3'],
          createdAt: addSeconds(createdAt, 1),
        },
      ]);

      const res = await client.query(
        QUERY({
          integrationId: userIntegration.id,
        }),
      );

      expect(res.errors).toBeFalsy();
      expect(res.data.sourceIntegrations).toMatchObject({
        edges: [
          {
            node: {
              userIntegration: {
                id: userIntegration.id,
                userId: userIntegration.userId,
              },
              type: UserIntegrationType.Slack,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              source: {
                id: 'squadslack',
              },
            },
          },
          {
            node: {
              userIntegration: {
                id: userIntegration.id,
                userId: userIntegration.userId,
              },
              type: UserIntegrationType.Slack,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              source: {
                id: 'squadslack2',
              },
            },
          },
        ],
      });
    });
  });
});
