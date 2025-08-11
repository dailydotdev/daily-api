import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from './helpers';
import {
  ArticlePost,
  Post,
  PostTag,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  User,
  YouTubePost,
} from '../src/entity';
import {
  CampaignPost,
  CampaignSource,
  CampaignType,
  CampaignState,
} from '../src/entity/campaign';
import { SourceMemberRoles, sourceRoleRank } from '../src/roles';
import { sourcesFixture } from './fixture/source';
import {
  postsFixture,
  postTagsFixture,
  videoPostsFixture,
} from './fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { Context } from '../src/Context';

import { randomUUID } from 'crypto';
import { deleteKeysByPattern, ioRedisPool } from '../src/redis';
import { rateLimiterName } from '../src/directive/rateLimit';
import { badUsersFixture } from './fixture/user';
import { createMockNjordTransport } from './helpers';
import { createClient } from '@connectrpc/connect';
import { Credits } from '@dailydotdev/schema';
import * as njordCommon from '../src/common/njord';

jest.mock('../src/common/pubsub', () => ({
  ...(jest.requireActual('../src/common/pubsub') as Record<string, unknown>),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

// Mock fetchParse to test actual HTTP calls
jest.mock('../src/integrations/retry', () => ({
  fetchParse: jest.fn(),
}));

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null!;
let isTeamMember = false;
let isPlus = false;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    (req) =>
      new MockContext(
        con,
        loggedUser || undefined,
        [],
        req,
        isTeamMember,
        isPlus,
      ) as Context,
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null!;
  isTeamMember = false;
  isPlus = false;
  jest.clearAllMocks();
  await ioRedisPool.execute((client) => client.flushall());

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, YouTubePost, videoPostsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await saveFixtures(con, User, badUsersFixture);
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' });
  await con.getRepository(User).save({
    id: '2',
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
  });
  await con.getRepository(User).save([
    {
      id: '2',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
    },
    {
      id: '3',
      name: 'Amar',
    },
    {
      id: '4',
      name: 'John Doe',
    },
    {
      id: '5',
      name: 'Joanna Deer',
    },
  ]);
  await con.getRepository(SquadSource).save([
    {
      id: 'm',
      name: 'Moderated Squad',
      image: 'http//image.com/m',
      handle: 'moderatedSquad',
      type: SourceType.Squad,
      active: true,
      private: false,
      moderationRequired: true,
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Member],
      memberInviteRank: sourceRoleRank[SourceMemberRoles.Member],
    },
    {
      id: 'm2',
      name: 'Second Moderated Squad',
      image: 'http//image.com/m2',
      handle: 'moderatedSquad2',
      type: SourceType.Squad,
      active: true,
      private: false,
      moderationRequired: true,
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Member],
      memberInviteRank: sourceRoleRank[SourceMemberRoles.Member],
    },
  ]);

  await con.getRepository(SourceMember).save([
    {
      userId: '3',
      sourceId: 'm',
      role: SourceMemberRoles.Moderator,
      referralToken: randomUUID(),
    },
    {
      userId: '4',
      sourceId: 'm',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
    },
    {
      userId: '5',
      sourceId: 'm',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
    },
    {
      userId: '2',
      sourceId: 'm2',
      role: SourceMemberRoles.Moderator,
      referralToken: randomUUID(),
    },
  ]);
  await deleteKeysByPattern(`${rateLimiterName}:*`);
  await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });

  // Create a fresh transport and client for each test
  const mockTransport = createMockNjordTransport();
  jest
    .spyOn(njordCommon, 'getNjordClient')
    .mockImplementation(() => createClient(Credits, mockTransport));
});

afterAll(() => disposeGraphQLTesting(state));

// Test UUIDs for campaigns
const CAMPAIGN_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const CAMPAIGN_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
const CAMPAIGN_UUID_3 = '550e8400-e29b-41d4-a716-446655440003';
const CAMPAIGN_UUID_4 = '550e8400-e29b-41d4-a716-446655440004';
const CAMPAIGN_UUID_5 = '550e8400-e29b-41d4-a716-446655440005';

describe('query campaignById', () => {
  const CAMPAIGN_BY_ID_QUERY = /* GraphQL */ `
    query CampaignById($id: ID!) {
      campaignById(id: $id) {
        id
        type
        state
        createdAt
        endedAt
        flags {
          budget
          spend
          users
          clicks
          impressions
        }
        post {
          id
          title
          url
        }
        source {
          id
          name
          handle
        }
      }
    }
  `;

  beforeEach(async () => {
    // Create campaign fixtures
    await con.getRepository(CampaignPost).save([
      {
        id: CAMPAIGN_UUID_1,
        referenceId: 'ref1',
        userId: '1',
        type: CampaignType.Post,
        state: CampaignState.Active,
        createdAt: new Date('2023-01-01'),
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 1000,
          spend: 250,
          users: 50,
          clicks: 100,
          impressions: 5000,
        },
        postId: 'p1', // Using existing post fixture
      },
      {
        id: CAMPAIGN_UUID_2,
        referenceId: 'ref2',
        userId: '2',
        type: CampaignType.Post,
        state: CampaignState.Completed,
        createdAt: new Date('2023-02-01'),
        endedAt: new Date('2023-11-30'),
        flags: {
          budget: 500,
          spend: 500,
          users: 25,
          clicks: 75,
          impressions: 2500,
        },
        postId: 'p2', // Using existing post fixture
      },
    ]);

    await con.getRepository(CampaignSource).save([
      {
        id: CAMPAIGN_UUID_3,
        referenceId: 'ref3',
        userId: '1',
        type: CampaignType.Source,
        state: CampaignState.Active,
        createdAt: new Date('2023-03-01'),
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 2000,
          spend: 750,
          users: 100,
          clicks: 200,
          impressions: 10000,
        },
        sourceId: 'a', // Using existing source fixture
      },
    ]);
  });

  it('should return campaign by id for post campaign', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGN_BY_ID_QUERY, {
      variables: { id: CAMPAIGN_UUID_1 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignById).toEqual({
      id: CAMPAIGN_UUID_1,
      type: 'post',
      state: 'active',
      createdAt: new Date('2023-01-01').toISOString(),
      endedAt: new Date('2023-12-31').toISOString(),
      flags: {
        budget: 1000,
        spend: 250,
        users: 50,
        clicks: 100,
        impressions: 5000,
      },
      post: {
        id: 'p1',
        title: 'P1',
        url: 'http://p1.com',
      },
      source: null,
    });
  });

  it('should return campaign by id for source campaign', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGN_BY_ID_QUERY, {
      variables: { id: CAMPAIGN_UUID_3 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignById).toEqual({
      id: CAMPAIGN_UUID_3,
      type: 'source',
      state: 'active',
      createdAt: new Date('2023-03-01').toISOString(),
      endedAt: new Date('2023-12-31').toISOString(),
      flags: {
        budget: 2000,
        spend: 750,
        users: 100,
        clicks: 200,
        impressions: 10000,
      },
      post: null,
      source: {
        id: 'a',
        name: 'A',
        handle: 'a',
      },
    });
  });

  it('should throw error when campaign not found', async () => {
    loggedUser = '1';

    return testQueryErrorCode(
      client,
      {
        query: CAMPAIGN_BY_ID_QUERY,
        variables: { id: '550e8400-e29b-41d4-a716-446655440011' },
      },
      'NOT_FOUND',
    );
  });

  it("should throw error when user tries to access another user's campaign", async () => {
    loggedUser = '2'; // User 2 trying to access User 1's campaign

    return testQueryErrorCode(
      client,
      {
        query: CAMPAIGN_BY_ID_QUERY,
        variables: { id: CAMPAIGN_UUID_1 }, // This campaign belongs to user '1'
      },
      'NOT_FOUND',
    );
  });

  it('should throw error when user is not authenticated', async () => {
    loggedUser = null;

    const res = await client.query(CAMPAIGN_BY_ID_QUERY, {
      variables: { id: CAMPAIGN_UUID_1 },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});

describe('query campaignsList', () => {
  const CAMPAIGNS_LIST_QUERY = /* GraphQL */ `
    query CampaignsList($first: Int, $after: String) {
      campaignsList(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          node {
            id
            type
            state
            createdAt
            endedAt
            flags {
              budget
              spend
              users
              clicks
              impressions
            }
            post {
              id
              title
            }
            source {
              id
              name
            }
          }
          cursor
        }
      }
    }
  `;

  beforeEach(async () => {
    // Create multiple campaigns for user 1 and user 2
    const now = new Date();

    await con.getRepository(CampaignPost).save([
      {
        id: CAMPAIGN_UUID_1,
        referenceId: 'ref1',
        userId: '1',
        type: CampaignType.Post,
        state: CampaignState.Active,
        createdAt: new Date(now.getTime() - 1000), // Most recent active
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 1000,
          spend: 250,
          users: 50,
          clicks: 100,
          impressions: 5000,
        },
        postId: 'p1',
      },
      {
        id: CAMPAIGN_UUID_2,
        referenceId: 'ref2',
        userId: '1',
        type: CampaignType.Post,
        state: CampaignState.Completed,
        createdAt: new Date(now.getTime() - 2000), // Older completed
        endedAt: new Date('2023-11-30'),
        flags: {
          budget: 500,
          spend: 500,
          users: 25,
          clicks: 75,
          impressions: 2500,
        },
        postId: 'p2',
      },
      {
        id: CAMPAIGN_UUID_3,
        referenceId: 'ref3',
        userId: '1',
        type: CampaignType.Post,
        state: CampaignState.Active,
        createdAt: new Date(now.getTime() - 3000), // Older active
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 2000,
          spend: 750,
          users: 100,
          clicks: 200,
          impressions: 10000,
        },
        postId: 'p3',
      },
      {
        id: CAMPAIGN_UUID_4,
        referenceId: 'ref4',
        userId: '2', // Different user
        type: CampaignType.Post,
        state: CampaignState.Active,
        createdAt: new Date(now.getTime() - 500),
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 1500,
          spend: 300,
          users: 75,
          clicks: 150,
          impressions: 7500,
        },
        postId: 'p4',
      },
    ]);

    await con.getRepository(CampaignSource).save([
      {
        id: CAMPAIGN_UUID_5,
        referenceId: 'ref5',
        userId: '1',
        type: CampaignType.Source,
        state: CampaignState.Pending,
        createdAt: new Date(now.getTime() - 4000), // Oldest
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 3000,
          spend: 0,
          users: 0,
          clicks: 0,
          impressions: 0,
        },
        sourceId: 'b',
      },
    ]);
  });

  it('should return campaigns list ordered by state and creation date', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(4);

    // Should be ordered: Active campaigns first (by createdAt DESC), then others
    const campaigns = res.data.campaignsList.edges.map((edge) => edge.node);

    // First two should be active campaigns, ordered by createdAt DESC
    expect(campaigns[0].id).toBe(CAMPAIGN_UUID_1); // Most recent active
    expect(campaigns[0].state).toBe('active');
    expect(campaigns[1].id).toBe(CAMPAIGN_UUID_3); // Older active
    expect(campaigns[1].state).toBe('active');

    // Then non-active campaigns by createdAt DESC
    expect(campaigns[2].id).toBe(CAMPAIGN_UUID_2); // Completed
    expect(campaigns[2].state).toBe('completed');
    expect(campaigns[3].id).toBe(CAMPAIGN_UUID_5); // Pending (oldest)
    expect(campaigns[3].state).toBe('pending');
  });

  it('should only return campaigns for authenticated user', async () => {
    loggedUser = '2';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(1);
    expect(res.data.campaignsList.edges[0].node.id).toBe(CAMPAIGN_UUID_4);
  });

  it('should support pagination with first parameter', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 2 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(2);
    expect(res.data.campaignsList.pageInfo.hasNextPage).toBe(true);
    expect(res.data.campaignsList.pageInfo.hasPreviousPage).toBe(false);

    // Should get the first 2 campaigns (most recent active ones)
    expect(res.data.campaignsList.edges[0].node.id).toBe(CAMPAIGN_UUID_1);
    expect(res.data.campaignsList.edges[1].node.id).toBe(CAMPAIGN_UUID_3);
  });

  it('should support pagination with after cursor', async () => {
    loggedUser = '1';

    // First, get first page
    const firstPage = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 2 },
    });

    expect(firstPage.errors).toBeFalsy();
    const endCursor = firstPage.data.campaignsList.pageInfo.endCursor;

    // Then get next page
    const secondPage = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 2, after: endCursor },
    });

    expect(secondPage.errors).toBeFalsy();
    expect(secondPage.data.campaignsList.edges).toHaveLength(2);
    expect(secondPage.data.campaignsList.pageInfo.hasPreviousPage).toBe(true);

    // Should get the next 2 campaigns
    expect(secondPage.data.campaignsList.edges[0].node.id).toBe(
      CAMPAIGN_UUID_2,
    );
    expect(secondPage.data.campaignsList.edges[1].node.id).toBe(
      CAMPAIGN_UUID_5,
    );
  });

  it('should include post data when available', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 1 },
    });

    expect(res.errors).toBeFalsy();
    const campaign = res.data.campaignsList.edges[0].node;

    // Post campaign should have post data
    expect(campaign.post).toEqual({
      id: 'p1',
      title: 'P1',
    });
  });

  it('should throw error when user is not authenticated', async () => {
    loggedUser = null;

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('should return empty list when user has no campaigns', async () => {
    loggedUser = '3'; // User with no campaigns

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(0);
    expect(res.data.campaignsList.pageInfo.hasNextPage).toBe(false);
    expect(res.data.campaignsList.pageInfo.hasPreviousPage).toBe(false);
  });
});
