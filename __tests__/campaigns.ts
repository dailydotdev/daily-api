import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
  testMutationErrorCode,
} from './helpers';
import {
  ArticlePost,
  Keyword,
  Post,
  PostKeyword,
  PostTag,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  User,
  YouTubePost,
  PostType,
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
import {
  createMockNjordTransport,
  createMockNjordErrorTransport,
} from './helpers';
import { createClient } from '@connectrpc/connect';
import { Credits, EntityType } from '@dailydotdev/schema';
import * as njordCommon from '../src/common/njord';
import { updateFlagsStatement } from '../src/common';
import { UserTransaction } from '../src/entity/user/UserTransaction';
import nock from 'nock';
import { getAdvertiserId } from '../src/integrations/skadi/api/v2/clients';

jest.mock('../src/common/pubsub', () => ({
  ...(jest.requireActual('../src/common/pubsub') as Record<string, unknown>),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
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
  loggedUser = null;
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
        type: CampaignType.Squad,
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
      type: 'POST',
      state: 'ACTIVE',
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
      type: 'SQUAD',
      state: 'ACTIVE',
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

  it('should return full flags data for campaign owners', async () => {
    loggedUser = '1'; // User 1 accessing their own campaign

    const res = await client.query(CAMPAIGN_BY_ID_QUERY, {
      variables: { id: CAMPAIGN_UUID_1 }, // This campaign belongs to user '1'
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignById).toEqual({
      id: CAMPAIGN_UUID_1,
      type: 'POST',
      state: 'ACTIVE',
      createdAt: new Date('2023-01-01').toISOString(),
      endedAt: new Date('2023-12-31').toISOString(),
      flags: {
        budget: 1000,
        spend: 250,
        users: 50,
        clicks: 100,
        impressions: 5000,
      }, // Full sensitive data for owners
      post: {
        id: 'p1',
        title: 'P1',
        url: 'http://p1.com',
      },
      source: null,
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

  it('should allow non-owners to access campaign but without sensitive flags data', async () => {
    loggedUser = '2'; // User 2 accessing User 1's campaign

    const res = await client.query(CAMPAIGN_BY_ID_QUERY, {
      variables: { id: CAMPAIGN_UUID_1 }, // This campaign belongs to user '1'
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignById).toEqual({
      id: CAMPAIGN_UUID_1,
      type: 'POST',
      state: null,
      createdAt: null,
      endedAt: new Date('2023-12-31').toISOString(),
      flags: {
        budget: null,
        clicks: null,
        impressions: null,
        spend: null,
        users: null,
      },
      post: {
        id: 'p1',
        title: 'P1',
        url: 'http://p1.com',
      },
      source: null,
    });
  });

  it('should allow unauthenticated users to access campaigns but without sensitive flags data', async () => {
    loggedUser = null;

    const res = await client.query(CAMPAIGN_BY_ID_QUERY, {
      variables: { id: CAMPAIGN_UUID_1 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignById).toEqual({
      id: CAMPAIGN_UUID_1,
      type: 'POST',
      state: null,
      createdAt: null,
      endedAt: new Date('2023-12-31').toISOString(),
      flags: {
        budget: null,
        clicks: null,
        impressions: null,
        spend: null,
        users: null,
      }, // No sensitive data for unauthenticated users
      post: {
        id: 'p1',
        title: 'P1',
        url: 'http://p1.com',
      },
      source: null,
    });
  });
});

describe('query campaignsList', () => {
  const CAMPAIGNS_LIST_QUERY = /* GraphQL */ `
    query CampaignsList($first: Int, $after: String, $entityId: ID) {
      campaignsList(first: $first, after: $after, entityId: $entityId) {
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
        referenceId: 'p1',
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
        referenceId: 'p2',
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
        referenceId: 'p3',
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
        referenceId: 'p4',
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
  });

  it('should return campaigns list ordered by state and creation date', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(3);

    // Should be ordered: Active campaigns first (by createdAt DESC), then others
    const campaigns = res.data.campaignsList.edges.map((edge) => edge.node);

    // First two should be active campaigns, ordered by createdAt DESC
    expect(campaigns[0].id).toBe(CAMPAIGN_UUID_1); // Most recent active
    expect(campaigns[0].state).toBe('ACTIVE');
    expect(campaigns[1].id).toBe(CAMPAIGN_UUID_3); // Older active
    expect(campaigns[1].state).toBe('ACTIVE');

    // Then non-active campaigns by createdAt DESC
    expect(campaigns[2].id).toBe(CAMPAIGN_UUID_2); // Completed
    expect(campaigns[2].state).toBe('COMPLETED');
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
    expect(secondPage.data.campaignsList.edges).toHaveLength(1);
    expect(secondPage.data.campaignsList.pageInfo.hasPreviousPage).toBe(true);

    // Should leftover campaign
    expect(secondPage.data.campaignsList.edges[0].node.id).toBe(
      CAMPAIGN_UUID_2,
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

  it('should return campaigns for entity', async () => {
    loggedUser = '1';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10, entityId: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(1);

    expect(res.data.campaignsList.edges[0].node.id).toBe(CAMPAIGN_UUID_1);
  });

  it('should return campaigns for entity from other user', async () => {
    loggedUser = '2';

    const res = await client.query(CAMPAIGNS_LIST_QUERY, {
      variables: { first: 10, entityId: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.campaignsList.edges).toHaveLength(0);
  });
});

describe('mutation startCampaign', () => {
  const MUTATION = /* GraphQL */ `
    mutation StartCampaign(
      $type: CampaignType!
      $value: ID!
      $duration: Int!
      $budget: Int!
    ) {
      startCampaign(
        type: $type
        value: $value
        duration: $duration
        budget: $budget
      ) {
        transactionId
        referenceId
        balance {
          amount
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'POST', value: 'p1', duration: 7, budget: 5000 },
      },
      'UNAUTHENTICATED',
    ));

  it('should return an error if duration is less than 1', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'POST', value: 'p1', duration: 0, budget: 5000 },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if duration is greater than 30', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'POST', value: 'p1', duration: 31, budget: 5000 },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if budget is less than 1000', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'POST', value: 'p1', duration: 7, budget: 999 },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if budget is greater than 100000', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'POST', value: 'p1', duration: 7, budget: 100001 },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if budget is not divisible by 1000', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { type: 'POST', value: 'p1', duration: 7, budget: 1500 },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should handle skadi integration failure gracefully', async () => {
    loggedUser = '1';
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { flags: updateFlagsStatement<Post>({ campaignId: null }) },
      );

    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/create', (body) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        return (
          body.advertiser_id === getAdvertiserId('1') &&
          uuidRegex.test(body.campaign_id) &&
          body.budget === 10 &&
          Array.isArray(body.creatives) &&
          body.creatives.length === 1 &&
          body.creatives[0].type === 'POST' &&
          body.creatives[0].value.post.id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .replyWithError('Skadi API is down');

    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { senderId: '1', referenceType: 'PostBoost' } });

    const res = await client.mutate(MUTATION, {
      variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
    });

    expect(res.errors).toBeTruthy();
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { senderId: '1', referenceType: 'PostBoost' } });
    expect(finalTransactionCount).toBe(initialTransactionCount);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should handle skadi 400 status response gracefully', async () => {
    loggedUser = '1';
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { flags: updateFlagsStatement<Post>({ campaignId: null }) },
      );

    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/create', (body) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        return (
          body.advertiser_id === getAdvertiserId('1') &&
          uuidRegex.test(body.campaign_id) &&
          body.budget === 10 &&
          Array.isArray(body.creatives) &&
          body.creatives.length === 1 &&
          body.creatives[0].type === 'POST' &&
          body.creatives[0].value.post.id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(400, 'Invalid campaign parameters'); // 400 status with text response

    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { senderId: '1', referenceType: 'PostBoost' } });

    const res = await client.mutate(MUTATION, {
      variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
    });

    expect(res.errors).toBeTruthy();
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { senderId: '1', referenceType: 'PostBoost' } });
    expect(finalTransactionCount).toBe(initialTransactionCount);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should handle transfer failure gracefully', async () => {
    loggedUser = '1';
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/create', (body) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        return (
          body.advertiser_id === getAdvertiserId('1') &&
          uuidRegex.test(body.campaign_id) &&
          body.budget === 10 &&
          Array.isArray(body.creatives) &&
          body.creatives[0].type === 'POST' &&
          body.creatives[0].value.post.id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, ''); // Successful response with empty string

    const errorTransport = createMockNjordErrorTransport({
      errorStatus: 2,
      errorMessage: 'Transfer failed',
    });
    const testNjordClient = createClient(Credits, errorTransport);
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-transfer-failure-campaign',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000,
        },
      ],
    });
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { senderId: '1', referenceType: 'PostBoost' } });

    const res = await client.mutate(MUTATION, {
      variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
    });
    expect(res.errors).toBeTruthy();

    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { senderId: '1', referenceType: 'PostBoost' } });
    expect(finalTransactionCount).toBe(initialTransactionCount);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  describe('post campaigns', () => {
    it('should return an error if post is already boosted', async () => {
      loggedUser = '1';
      await con
        .getRepository(Post)
        .update(
          { id: 'p1' },
          { flags: updateFlagsStatement<Post>({ campaignId: 'mock-id' }) },
        );

      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { type: 'POST', value: 'p1', duration: 7, budget: 5000 },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should return an error if post does not exist', async () => {
      loggedUser = '1';
      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: {
            type: 'POST',
            value: 'nonexistent',
            duration: 7,
            budget: 5000,
          },
        },
        'NOT_FOUND',
      );
    });

    it('should return an error if user is not the author or scout of the post', async () => {
      loggedUser = '2';
      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { type: 'POST', value: 'p1', duration: 7, budget: 5000 },
        },
        'NOT_FOUND',
      );
    });

    it('should successfully start post campaign', async () => {
      loggedUser = '1';
      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('1') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'POST' &&
            body.creatives[0].value.post.id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(200, ''); // Successful response with empty string (Skadi returns nothing on success)

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-start-campaign',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '1', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.startCampaign.transactionId).toBeDefined();
      expect(res.data.startCampaign.balance.amount).toBe(9000);

      const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
      expect(post?.flags?.campaignId).toEqual(
        res.data.startCampaign.referenceId,
      );
    });

    it('should handle skadi success response with JSON but no error field', async () => {
      loggedUser = '1';
      await con
        .getRepository(Post)
        .update(
          { id: 'p1' },
          { flags: updateFlagsStatement<Post>({ campaignId: null }) },
        );

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('1') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives.length === 1 &&
            body.creatives[0].type === 'POST' &&
            body.creatives[0].value.post.id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(200, { status: 'created' }); // 200 OK with JSON but no error field

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-success-json-no-error',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '1', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.startCampaign.transactionId).toBeDefined();
      expect(res.data.startCampaign.balance.amount).toBe(9000);

      const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
      expect(post?.flags?.campaignId).toEqual(
        res.data.startCampaign.referenceId,
      );
    });

    it('should handle skadi success response with error field containing message', async () => {
      loggedUser = '1';
      await con
        .getRepository(Post)
        .update(
          { id: 'p1' },
          { flags: updateFlagsStatement<Post>({ campaignId: null }) },
        );

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('1') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives.length === 1 &&
            body.creatives[0].type === 'POST' &&
            body.creatives[0].value.post.id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(200, { error: 'Campaign already exists' }); // 200 OK but with error field in JSON

      const initialTransactionCount = await con
        .getRepository(UserTransaction)
        .count({ where: { senderId: '1', referenceType: 'PostBoost' } });

      const res = await client.mutate(MUTATION, {
        variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeTruthy();
      const finalTransactionCount = await con
        .getRepository(UserTransaction)
        .count({ where: { senderId: '1', referenceType: 'PostBoost' } });
      expect(finalTransactionCount).toBe(initialTransactionCount);
      const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
      expect(post?.flags?.campaignId).toBeFalsy();
    });

    it('should handle skadi 500 status response gracefully', async () => {
      loggedUser = '1';
      await con
        .getRepository(Post)
        .update(
          { id: 'p1' },
          { flags: updateFlagsStatement<Post>({ campaignId: null }) },
        );

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('1') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives.length === 1 &&
            body.creatives[0].type === 'POST' &&
            body.creatives[0].value.post.id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(500, 'Internal Server Error'); // 500 status with text response

      const initialTransactionCount = await con
        .getRepository(UserTransaction)
        .count({ where: { senderId: '1', referenceType: 'PostBoost' } });

      const res = await client.mutate(MUTATION, {
        variables: { type: 'POST', value: 'p1', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeTruthy();
      const finalTransactionCount = await con
        .getRepository(UserTransaction)
        .count({ where: { senderId: '1', referenceType: 'PostBoost' } });
      expect(finalTransactionCount).toBe(initialTransactionCount);
      const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
      expect(post?.flags?.campaignId).toBeFalsy();
    });
  });

  describe('source campaigns', () => {
    it('should return an error if user lacks permissions to boost source', async () => {
      loggedUser = '4'; // member in 'm', not moderator
      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { type: 'SQUAD', value: 'm', duration: 7, budget: 5000 },
        },
        'FORBIDDEN',
      );
    });

    it('should return an error if source already boosted', async () => {
      loggedUser = '3'; // moderator in 'm'
      await con
        .getRepository(Source)
        .update(
          { id: 'm' },
          { flags: updateFlagsStatement<Source>({ campaignId: 'mock-id' }) },
        );

      return testMutationErrorCode(
        client,
        {
          mutation: MUTATION,
          variables: { type: 'SQUAD', value: 'm', duration: 7, budget: 5000 },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should successfully start source campaign', async () => {
      loggedUser = '3'; // moderator in 'm'
      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('3') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'SQUAD' &&
            body.creatives[0].value.squad.id === 'm' &&
            body?.targeting?.type === 'NONE'
          );
        })
        .reply(200, ''); // Successful response with empty string (Skadi returns nothing on success)

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-start-source-campaign',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '3', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'SQUAD', value: 'm', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.startCampaign.transactionId).toBeDefined();
      expect(res.data.startCampaign.balance.amount).toBe(9000);

      const source = await con.getRepository(Source).findOneBy({ id: 'm' });
      expect(source?.flags?.campaignId).toEqual(
        res.data.startCampaign.referenceId,
      );
    });

    it('should handle source campaign error responses gracefully', async () => {
      loggedUser = '3'; // moderator in 'm'

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('3') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'SQUAD' &&
            body.creatives[0].value.squad.id === 'm' &&
            body?.targeting?.type === 'NONE'
          );
        })
        .reply(400, 'Source campaign limit exceeded'); // 400 status with text response

      const initialTransactionCount = await con
        .getRepository(UserTransaction)
        .count({ where: { senderId: '3', referenceType: 'PostBoost' } });

      const res = await client.mutate(MUTATION, {
        variables: { type: 'SQUAD', value: 'm', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeTruthy();
      const finalTransactionCount = await con
        .getRepository(UserTransaction)
        .count({ where: { senderId: '3', referenceType: 'PostBoost' } });
      expect(finalTransactionCount).toBe(initialTransactionCount);
      const source = await con.getRepository(Source).findOneBy({ id: 'm' });
      expect(source?.flags?.campaignId).toBeFalsy();
    });

    it('should include recent squad tags when available for source campaign (>3 tags)', async () => {
      loggedUser = '3'; // moderator in 'm'

      // Insert a recent post in squad 'm' with tags so getSourceTags returns keywords
      await con.getRepository(Post).save({
        id: 'mp1',
        shortId: 'mp1',
        title: 'M Post 1',
        url: 'http://mp1.com',
        createdAt: new Date(),
        sourceId: 'm',
        type: PostType.Article,
        visible: true,
      });

      // First create the Keywords with allow status
      await con.getRepository(Keyword).save([
        { value: 'squadtag1', status: 'allow' },
        { value: 'squadtag2', status: 'allow' },
        { value: 'squadtag3', status: 'allow' },
        { value: 'squadtag4', status: 'allow' },
      ]);

      // Add keywords to PostKeyword table (status will be set by trigger)
      await con.getRepository(PostKeyword).save([
        { postId: 'mp1', keyword: 'squadtag1' },
        { postId: 'mp1', keyword: 'squadtag2' },
        { postId: 'mp1', keyword: 'squadtag3' },
        { postId: 'mp1', keyword: 'squadtag4' },
      ]);

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          const keywords = body?.targeting?.value?.boost?.keywords || [];
          return (
            body.advertiser_id === getAdvertiserId('3') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'SQUAD' &&
            body.creatives[0].value.squad.id === 'm' &&
            body?.targeting?.type === 'BOOST' &&
            Array.isArray(keywords) &&
            keywords.includes('squadtag1') &&
            keywords.includes('squadtag2') &&
            keywords.includes('squadtag3') &&
            keywords.includes('squadtag4')
          );
        })
        .reply(200, ''); // Successful response with empty string

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-start-source-campaign-with-tags',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '3', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'SQUAD', value: 'm', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
      const source = await con.getRepository(Source).findOneBy({ id: 'm' });
      expect(source?.flags?.campaignId).toEqual(
        res.data.startCampaign.referenceId,
      );
    });

    it('should not send keywords when squad has 3 or fewer tags', async () => {
      loggedUser = '3';

      await con.getRepository(Post).save({
        id: 'mp2',
        shortId: 'mp2',
        title: 'M Post 2',
        url: 'http://mp2.com',
        createdAt: new Date(),
        sourceId: 'm',
        type: PostType.Article,
        visible: true,
      });

      // First create the Keywords with allow status
      await con.getRepository(Keyword).save([
        { value: 'one', status: 'allow' },
        { value: 'two', status: 'allow' },
        { value: 'three', status: 'allow' },
      ]);

      // Add keywords to PostKeyword table (3 or fewer tags, status set by trigger)
      await con.getRepository(PostKeyword).save([
        { postId: 'mp2', keyword: 'one' },
        { postId: 'mp2', keyword: 'two' },
        { postId: 'mp2', keyword: 'three' },
      ]);

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          return (
            body.advertiser_id === getAdvertiserId('3') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'SQUAD' &&
            body.creatives[0].value.squad.id === 'm' &&
            body?.targeting?.type === 'NONE'
          );
        })
        .reply(200, ''); // Successful response with empty string

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-start-source-campaign-with-3-tags',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '3', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'SQUAD', value: 'm', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
    });

    it('should limit keywords to maximum of 30 tags for source campaign', async () => {
      loggedUser = '3'; // moderator in 'm'

      // Insert a recent post in squad 'm' with many tags
      await con.getRepository(Post).save({
        id: 'mp3',
        shortId: 'mp3',
        title: 'M Post 3',
        url: 'http://mp3.com',
        createdAt: new Date(),
        sourceId: 'm',
        type: PostType.Article,
        visible: true,
      });

      // First create the Keywords with allow status (35 tags)
      const keywordEntities = Array.from({ length: 35 }, (_, i) => ({
        value: `tag${i + 1}`,
        status: 'allow' as const,
      }));
      await con.getRepository(Keyword).save(keywordEntities);

      // Add more than 30 keywords to PostKeyword table (status set by trigger)
      const keywords = Array.from({ length: 35 }, (_, i) => ({
        postId: 'mp3',
        keyword: `tag${i + 1}`,
      }));
      await con.getRepository(PostKeyword).save(keywords);

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          const requestKeywords = body?.targeting?.value?.boost?.keywords || [];
          return (
            body.advertiser_id === getAdvertiserId('3') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'SQUAD' &&
            body.creatives[0].value.squad.id === 'm' &&
            body?.targeting?.type === 'BOOST' &&
            Array.isArray(requestKeywords) &&
            requestKeywords.length === 30 // Should be limited to 30
          );
        })
        .reply(200, ''); // Successful response with empty string

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-start-source-campaign-with-max-tags',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '3', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'SQUAD', value: 'm', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
      const source = await con.getRepository(Source).findOneBy({ id: 'm' });
      expect(source?.flags?.campaignId).toEqual(
        res.data.startCampaign.referenceId,
      );
    });

    it('should only send active keywords to skadi client v2', async () => {
      loggedUser = '3'; // moderator in 'm'

      // Insert a recent post in squad 'm'
      await con.getRepository(Post).save({
        id: 'mp5',
        shortId: 'mp5',
        title: 'M Post 5',
        url: 'http://mp5.com',
        createdAt: new Date(),
        sourceId: 'm',
        type: PostType.Article,
        visible: true,
      });

      // First create Keywords - some with allow status, some with deny status
      const allowedKeywordEntities = Array.from({ length: 5 }, (_, i) => ({
        value: `active_tag${i + 1}`,
        status: 'allow' as const,
      }));
      const deniedKeywordEntities = Array.from({ length: 3 }, (_, i) => ({
        value: `inactive_tag${i + 1}`,
        status: 'deny' as const,
      }));

      await con
        .getRepository(Keyword)
        .save([...allowedKeywordEntities, ...deniedKeywordEntities]);

      // Add PostKeywords (status will be set by trigger based on Keyword status)
      const postKeywords = [
        ...Array.from({ length: 5 }, (_, i) => ({
          postId: 'mp5',
          keyword: `active_tag${i + 1}`,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          postId: 'mp5',
          keyword: `inactive_tag${i + 1}`,
        })),
      ];

      await con.getRepository(PostKeyword).save(postKeywords);

      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/campaign/create', (body) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
          const requestKeywords = body?.targeting?.value?.boost?.keywords || [];

          // Verify that only active keywords are sent
          const expectedActiveKeywords = [
            'active_tag1',
            'active_tag2',
            'active_tag3',
            'active_tag4',
            'active_tag5',
          ];
          const keywordsMatch =
            requestKeywords.every((keyword: string) =>
              expectedActiveKeywords.includes(keyword),
            ) && requestKeywords.length === expectedActiveKeywords.length;

          return (
            body.advertiser_id === getAdvertiserId('3') &&
            uuidRegex.test(body.campaign_id) &&
            body.budget === 10 &&
            Array.isArray(body.creatives) &&
            body.creatives[0].type === 'SQUAD' &&
            body.creatives[0].value.squad.id === 'm' &&
            body?.targeting?.type === 'BOOST' &&
            keywordsMatch
          );
        })
        .reply(200, ''); // Successful response

      const testNjordClient = njordCommon.getNjordClient();
      await testNjordClient.transfer({
        idempotencyKey: 'initial-balance-start-campaign-active-keywords',
        transfers: [
          {
            sender: { id: 'system', type: EntityType.SYSTEM },
            receiver: { id: '3', type: EntityType.USER },
            amount: 10000,
          },
        ],
      });
      jest
        .spyOn(njordCommon, 'getNjordClient')
        .mockImplementation(() => testNjordClient);

      const res = await client.mutate(MUTATION, {
        variables: { type: 'SQUAD', value: 'm', duration: 1, budget: 1000 },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.startCampaign.transactionId).toBeDefined();
    });
  });
});

describe('mutation stopCampaign', () => {
  const MUTATION = /* GraphQL */ `
    mutation StopCampaign($campaignId: ID!) {
      stopCampaign(campaignId: $campaignId) {
        transactionId
        referenceId
        balance {
          amount
        }
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { campaignId: 'some-id' } },
      'UNAUTHENTICATED',
    ));

  it('should return not found when campaign does not belong to user', async () => {
    loggedUser = '1';
    // Create campaign for another user
    await con.getRepository(CampaignPost).save({
      id: CAMPAIGN_UUID_4,
      referenceId: 'p4',
      userId: '2',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date(),
      endedAt: new Date(),
      flags: { budget: 1000, spend: 0, users: 0, clicks: 0, impressions: 0 },
      postId: 'p4',
    });

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { campaignId: CAMPAIGN_UUID_4 } },
      'NOT_FOUND',
    );
  });

  it('should successfully cancel post campaign', async () => {
    loggedUser = '1';
    // Create campaign for user 1 and set boosted flag
    await con.getRepository(CampaignPost).save({
      id: CAMPAIGN_UUID_1,
      referenceId: 'p1',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date(),
      endedAt: new Date(),
      flags: { budget: 1000, spend: 0, users: 0, clicks: 0, impressions: 0 },
      postId: 'p1',
    });
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { flags: updateFlagsStatement<Post>({ campaignId: CAMPAIGN_UUID_1 }) },
      );

    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel', (body) => {
        return (
          body?.campaign_id === CAMPAIGN_UUID_1 &&
          body?.advertiser_id === getAdvertiserId('1')
        );
      })
      .reply(200, { budget: '5.5' });

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-cancel-campaign',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000,
        },
      ],
    });
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: { campaignId: CAMPAIGN_UUID_1 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.stopCampaign.transactionId).toBeDefined();
    expect(res.data.stopCampaign.referenceId).toBe(CAMPAIGN_UUID_1);
    expect(res.data.stopCampaign.balance.amount).toBe(10550);

    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();

    // Verify campaign state is updated to cancelled
    const campaign = await con
      .getRepository(CampaignPost)
      .findOneBy({ id: CAMPAIGN_UUID_1 });
    expect(campaign?.state).toBe(CampaignState.Cancelled);
  });

  it('should successfully cancel source campaign', async () => {
    loggedUser = '3'; // moderator of source 'm'
    await con.getRepository(CampaignSource).save({
      id: CAMPAIGN_UUID_3,
      referenceId: 'm',
      userId: '3',
      type: CampaignType.Squad,
      state: CampaignState.Active,
      createdAt: new Date(),
      endedAt: new Date(),
      flags: { budget: 1000, spend: 0, users: 0, clicks: 0, impressions: 0 },
      sourceId: 'm',
    });
    await con.getRepository(Source).update(
      { id: 'm' },
      {
        flags: updateFlagsStatement<Source>({ campaignId: CAMPAIGN_UUID_3 }),
      },
    );

    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel', (body) => {
        return (
          body?.campaign_id === CAMPAIGN_UUID_3 &&
          body?.advertiser_id === getAdvertiserId('3')
        );
      })
      .reply(200, { budget: '3.25' });

    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-cancel-source-campaign',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '3', type: EntityType.USER },
          amount: 10000,
        },
      ],
    });
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: { campaignId: CAMPAIGN_UUID_3 },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.stopCampaign.balance.amount).toBe(10325);

    const source = await con.getRepository(Source).findOneBy({ id: 'm' });
    expect(source?.flags?.campaignId).toBeFalsy();

    // Verify campaign state is updated to cancelled
    const campaign = await con
      .getRepository(CampaignSource)
      .findOneBy({ id: CAMPAIGN_UUID_3 });
    expect(campaign?.state).toBe(CampaignState.Cancelled);
  });

  it('should handle skadi integration failure gracefully', async () => {
    loggedUser = '1';
    await con.getRepository(CampaignPost).save({
      id: CAMPAIGN_UUID_2,
      referenceId: 'p2',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date(),
      endedAt: new Date(),
      flags: { budget: 1000, spend: 0, users: 0, clicks: 0, impressions: 0 },
      postId: 'p2',
    });
    await con
      .getRepository(Post)
      .update(
        { id: 'p2' },
        { flags: updateFlagsStatement<Post>({ campaignId: CAMPAIGN_UUID_2 }) },
      );

    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel', (body) => {
        return (
          body?.campaign_id === CAMPAIGN_UUID_2 &&
          body?.advertiser_id === getAdvertiserId('1')
        );
      })
      .reply(200, { error: 'Skadi service unavailable' });

    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { receiverId: '1', referenceType: 'PostBoost' } });

    const res = await client.mutate(MUTATION, {
      variables: { campaignId: CAMPAIGN_UUID_2 },
    });
    expect(res.errors).toBeTruthy();

    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { receiverId: '1', referenceType: 'PostBoost' } });
    expect(finalTransactionCount).toBe(initialTransactionCount);
    const post = await con.getRepository(Post).findOneBy({ id: 'p2' });
    expect(post?.flags?.campaignId).toBe(CAMPAIGN_UUID_2);

    // Verify campaign state remains active when cancellation fails
    const campaign = await con
      .getRepository(CampaignPost)
      .findOneBy({ id: CAMPAIGN_UUID_2 });
    expect(campaign?.state).toBe(CampaignState.Active);
  });

  it('should handle transfer failure gracefully', async () => {
    loggedUser = '1';
    await con.getRepository(CampaignPost).save({
      id: CAMPAIGN_UUID_5,
      referenceId: 'p1',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date(),
      endedAt: new Date(),
      flags: { budget: 1000, spend: 0, users: 0, clicks: 0, impressions: 0 },
      postId: 'p1',
    });
    await con
      .getRepository(Post)
      .update(
        { id: 'p1' },
        { flags: updateFlagsStatement<Post>({ campaignId: CAMPAIGN_UUID_5 }) },
      );

    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel', (body) => {
        return (
          body?.campaign_id === CAMPAIGN_UUID_5 &&
          body?.advertiser_id === getAdvertiserId('1')
        );
      })
      .reply(200, { budget: '5.5' });

    const errorTransport = createMockNjordErrorTransport({
      errorStatus: 2,
      errorMessage: 'Transfer failed',
    });
    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, errorTransport));

    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { receiverId: '1', referenceType: 'PostBoost' } });

    const res = await client.mutate(MUTATION, {
      variables: { campaignId: CAMPAIGN_UUID_5 },
    });
    expect(res.errors).toBeTruthy();

    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({ where: { receiverId: '1', referenceType: 'PostBoost' } });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe(CAMPAIGN_UUID_5);

    // Verify campaign state remains active when transfer fails
    const campaign = await con
      .getRepository(CampaignPost)
      .findOneBy({ id: CAMPAIGN_UUID_5 });
    expect(campaign?.state).toBe(CampaignState.Active);
  });
});

describe('query userCampaignStats', () => {
  const USER_CAMPAIGN_STATS_QUERY = /* GraphQL */ `
    query UserCampaignStats {
      userCampaignStats {
        impressions
        clicks
        users
        spend
      }
    }
  `;

  beforeEach(async () => {
    // Create multiple campaigns with different stats for user 1
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
        postId: 'p1',
      },
      {
        id: CAMPAIGN_UUID_2,
        referenceId: 'ref2',
        userId: '1',
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
        postId: 'p2',
      },
      {
        id: CAMPAIGN_UUID_3,
        referenceId: 'ref3',
        userId: '1',
        type: CampaignType.Post,
        state: CampaignState.Cancelled,
        createdAt: new Date('2023-03-01'),
        endedAt: new Date('2023-12-31'),
        flags: {
          budget: 2000,
          spend: 150,
          users: 30,
          clicks: 60,
          impressions: 3000,
        },
        postId: 'p3',
      },
      {
        id: CAMPAIGN_UUID_4,
        referenceId: 'ref4',
        userId: '2', // Different user
        type: CampaignType.Post,
        state: CampaignState.Active,
        createdAt: new Date('2023-04-01'),
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
  });

  it('should return aggregated campaign statistics for authenticated user', async () => {
    loggedUser = '1';

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userCampaignStats).toEqual({
      clicks: 235, // 100 + 75 + 60
      impressions: 10500, // 5000 + 2500 + 3000
      users: 105, // 50 + 25 + 30
      spend: 900, // 250 + 500 + 150
    });
  });

  it('should return zero stats when user has no campaigns', async () => {
    loggedUser = '3'; // User with no campaigns

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userCampaignStats).toEqual({
      clicks: 0,
      impressions: 0,
      users: 0,
      spend: 0,
    });
  });

  it('should only return stats for the authenticated user', async () => {
    loggedUser = '2'; // User 2 has only one campaign

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeFalsy();
    expect(res.data.userCampaignStats).toEqual({
      clicks: 150,
      impressions: 7500,
      users: 75,
      spend: 300,
    });
  });

  it('should include campaigns in all states', async () => {
    loggedUser = '1';

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeFalsy();
    // Should include Active, Completed, and Cancelled campaigns
    expect(res.data.userCampaignStats.clicks).toBe(235); // All campaigns counted
  });

  it('should handle null flags gracefully', async () => {
    loggedUser = '1';

    // Add a campaign with null flags
    await con.getRepository(CampaignPost).save({
      id: CAMPAIGN_UUID_5,
      referenceId: 'ref5',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date('2023-05-01'),
      endedAt: new Date('2023-12-31'),
      flags: undefined, // Undefined flags
      postId: 'p1',
    });

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeFalsy();
    // Should still return the aggregated stats, treating null flags as 0
    expect(res.data.userCampaignStats).toEqual({
      clicks: 235, // Same as before, null flags contribute 0
      impressions: 10500,
      users: 105,
      spend: 900,
    });
  });

  it('should handle missing flag fields gracefully', async () => {
    loggedUser = '1';

    // Add a campaign with incomplete flags
    await con.getRepository(CampaignPost).save({
      id: CAMPAIGN_UUID_5,
      referenceId: 'ref5',
      userId: '1',
      type: CampaignType.Post,
      state: CampaignState.Active,
      createdAt: new Date('2023-05-01'),
      endedAt: new Date('2023-12-31'),
      flags: {
        budget: 1000,
        spend: 100,
        // Missing clicks, impressions, users
      },
      postId: 'p1',
    });

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeFalsy();
    // Should handle missing fields gracefully
    expect(res.data.userCampaignStats).toEqual({
      clicks: 235, // Same as before, missing fields contribute 0
      impressions: 10500,
      users: 105,
      spend: 1000, // 900 + 100
    });
  });

  it('should throw error when user is not authenticated', async () => {
    loggedUser = null;

    const res = await client.query(USER_CAMPAIGN_STATS_QUERY);

    expect(res.errors).toBeTruthy();
    expect(res.errors?.[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});

describe('query dailyCampaignReachEstimate', () => {
  const QUERY = `
    query DailyCampaignReachEstimate(
      $type: CampaignType!
      $value: ID!
      $budget: Int!
    ) {
      dailyCampaignReachEstimate(
        type: $type
        value: $value
        budget: $budget
      ) {
        min
        max
      }
    }
  `;

  const postParams = { type: 'POST', value: 'p1' };
  const sourceParams = { type: 'SQUAD', value: 'm' };

  beforeEach(async () => {
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { ...postParams, budget: 5000 } },
      'UNAUTHENTICATED',
    ));

  it('should return an error if post does not exist', async () => {
    loggedUser = '1';

    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          type: 'POST',
          value: 'nonexistent',
          budget: 5000,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should return an error if source does not exist', async () => {
    loggedUser = '3';

    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: {
          type: 'SQUAD',
          value: 'nonexistent',
          budget: 5000,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should return an error if user is not the author or scout of the post', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { ...postParams, budget: 5000 } },
      'NOT_FOUND',
    );
  });

  it('should return an error if user is not a moderator of the source', async () => {
    loggedUser = '4'; // User 4 is a member but not a moderator of source 'm'

    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { ...sourceParams, budget: 5000 },
      },
      'FORBIDDEN',
    );
  });

  it('should not return an error if post is already boosted', async () => {
    loggedUser = '1';
    // Set the post as already boosted
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: 'mock-id' }),
      },
    );

    // Mock the HTTP response using nock
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        return (
          body.daily_budget === 50 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, {
        reach: {
          impressions: 100,
          clicks: 5,
          users: 50,
          min_impressions: 45,
          max_impressions: 55,
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...postParams, budget: 5000 },
    });

    expect(res.errors).toBeFalsy();
  });

  it('should return an error if source is already boosted', async () => {
    loggedUser = '3'; // moderator in 'm'
    // Set the source as already boosted
    await con.getRepository(Source).update(
      { id: 'm' },
      {
        flags: updateFlagsStatement<Source>({ campaignId: 'mock-id' }),
      },
    );

    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { ...sourceParams, budget: 5000 },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if user lacks permissions to boost source', async () => {
    loggedUser = '4'; // member in 'm', not moderator
    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { ...sourceParams, budget: 5000, duration: 7 },
      },
      'FORBIDDEN',
    );
  });

  describe('budget validation', () => {
    beforeEach(() => {
      loggedUser = '1';
    });

    it('should return an error if budget is less than 1000', async () => {
      return testQueryErrorCode(
        client,
        {
          query: QUERY,
          variables: { ...postParams, budget: 999 },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should return an error if budget is greater than 100000', async () => {
      return testQueryErrorCode(
        client,
        {
          query: QUERY,
          variables: { ...postParams, budget: 100001 },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should return an error if budget is not divisible by 1000', async () => {
      return testQueryErrorCode(
        client,
        {
          query: QUERY,
          variables: { ...postParams, budget: 1500 },
        },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should accept valid budget values and make correct HTTP call', async () => {
      // Mock the HTTP response using nock
      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/reach', (body) => {
          return (
            body.daily_budget === 20 &&
            body.targeting?.type === 'BOOST' &&
            body.targeting?.value?.boost?.post_id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(200, {
          reach: {
            impressions: 100,
            clicks: 5,
            users: 50,
            min_impressions: 45,
            max_impressions: 55,
          },
        });

      const res = await client.query(QUERY, {
        variables: { ...postParams, budget: 2000 }, // Valid budget
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.dailyCampaignReachEstimate).toEqual({
        min: 45,
        max: 55,
      });
    });

    it('should handle minimum budget value (1000 cores)', async () => {
      // Mock the HTTP response using nock
      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/reach', (body) => {
          return (
            body.daily_budget === 10 &&
            body.targeting?.type === 'BOOST' &&
            body.targeting?.value?.boost?.post_id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(200, {
          reach: {
            impressions: 50,
            clicks: 3,
            users: 25,
            min_impressions: 23,
            max_impressions: 27,
          },
        });

      const res = await client.query(QUERY, {
        variables: { ...postParams, budget: 1000 }, // 1000 cores = 10 USD
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.dailyCampaignReachEstimate).toEqual({
        min: 23,
        max: 27,
      });
    });

    it('should handle maximum budget value (100000 cores)', async () => {
      // Mock the HTTP response using nock
      nock(process.env.SKADI_API_ORIGIN_V2)
        .post('/api/reach', (body) => {
          return (
            body.daily_budget === 1000 &&
            body.targeting?.type === 'BOOST' &&
            body.targeting?.value?.boost?.post_id === 'p1' &&
            body.targeting?.value?.boost?.keywords === undefined
          );
        })
        .reply(200, {
          reach: {
            impressions: 50000,
            clicks: 2500,
            users: 15000,
            min_impressions: 13800,
            max_impressions: 16200,
          },
        });

      const res = await client.query(QUERY, {
        variables: { ...postParams, budget: 100000 }, // 100000 cores = 1000 USD
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.dailyCampaignReachEstimate).toEqual({
        min: 13800,
        max: 16200,
      });
    });
  });

  it('should handle API errors gracefully', async () => {
    loggedUser = '1';

    // Mock the HTTP response with error
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        return (
          body.daily_budget === 20 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, {
        error: 'Skadi service unavailable',
      });

    const res = await client.query(QUERY, {
      variables: { ...postParams, budget: 2000 },
    });

    expect(res.errors).toBeTruthy();
    expect(res.errors[0].message).toContain('Unexpected error');
  });

  it('should return estimated reach with budget and duration parameters', async () => {
    loggedUser = '1';

    // Mock the HTTP response using nock
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        return (
          body.daily_budget === 100 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, {
        reach: {
          impressions: 500,
          clicks: 40,
          users: 180,
          min_impressions: 166,
          max_impressions: 194,
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...postParams, budget: 10000 }, // 10000 cores = 100 USD
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyCampaignReachEstimate).toEqual({
      min: 166,
      max: 194,
    });
  });

  it('should work for post scout as well as author', async () => {
    loggedUser = '1';

    // Set user as scout instead of author
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '2', // Different author
        scoutId: '1', // Current user is scout
      },
    );

    // Mock the HTTP response using nock
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        return (
          body.daily_budget === 30 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, {
        reach: {
          impressions: 150,
          clicks: 10,
          users: 65,
          min_impressions: 60,
          max_impressions: 70,
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...postParams, budget: 3000 }, // 3000 cores = 30 USD
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyCampaignReachEstimate).toEqual({
      min: 60,
      max: 70,
    });
  });

  it('should work for source moderator', async () => {
    loggedUser = '3'; // moderator in 'm'

    // Mock the HTTP response using nock
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        const keywords = body?.targeting?.value?.boost?.keywords || [];
        return (
          body.daily_budget === 30 &&
          body.targeting?.type === 'NONE' &&
          body.targeting?.value?.boost?.post_id === undefined &&
          Array.isArray(keywords) &&
          keywords.length === 0
        );
      })
      .reply(200, {
        reach: {
          impressions: 200,
          clicks: 12,
          users: 90,
          min_impressions: 83,
          max_impressions: 97,
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...sourceParams, budget: 3000 }, // 3000 cores = 30 USD
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyCampaignReachEstimate).toEqual({
      min: 83,
      max: 97,
    });
  });

  it('should fall back to getAdjustedReach when min and max impressions are equal', async () => {
    loggedUser = '1';

    // Mock the HTTP response where min and max impressions are the same
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        return (
          body.daily_budget === 40 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, {
        reach: {
          impressions: 200,
          clicks: 15,
          users: 100,
          min_impressions: 75, // Same value
          max_impressions: 75, // Same value
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...postParams, budget: 4000 }, // 4000 cores = 40 USD
    });

    expect(res.errors).toBeFalsy();
    // When min_impressions === max_impressions, it should use getAdjustedReach(maxImpressions)
    // getAdjustedReach applies ±8% calculation: 75 ± Math.floor(75 * 0.08) = 75 ± 6
    expect(res.data.dailyCampaignReachEstimate).toEqual({
      min: 69, // 75 - Math.floor(75 * 0.08) = 75 - 6 = 69
      max: 81, // 75 + Math.floor(75 * 0.08) = 75 + 6 = 81
    });
  });

  it('should work correctly for both post and source campaign types', async () => {
    // Test post campaign
    loggedUser = '1';
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        return (
          body.daily_budget === 30 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === 'p1' &&
          body.targeting?.value?.boost?.keywords === undefined
        );
      })
      .reply(200, {
        reach: {
          impressions: 150,
          clicks: 8,
          users: 75,
          min_impressions: 69,
          max_impressions: 81,
        },
      });

    const postRes = await client.query(QUERY, {
      variables: { ...postParams, budget: 3000 },
    });

    expect(postRes.errors).toBeFalsy();
    expect(postRes.data.dailyCampaignReachEstimate).toEqual({
      min: 69,
      max: 81,
    });

    // Test source campaign
    loggedUser = '3';
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        const keywords = body?.targeting?.value?.boost?.keywords || [];
        return (
          body.daily_budget === 30 &&
          body.targeting?.type === 'NONE' &&
          body.targeting?.value?.boost?.post_id === undefined &&
          Array.isArray(keywords) &&
          keywords.length === 0
        );
      })
      .reply(200, {
        reach: {
          impressions: 200,
          clicks: 12,
          users: 100,
          min_impressions: 92,
          max_impressions: 108,
        },
      });

    const sourceRes = await client.query(QUERY, {
      variables: { ...sourceParams, budget: 3000 },
    });

    expect(sourceRes.errors).toBeFalsy();
    expect(sourceRes.data.dailyCampaignReachEstimate).toEqual({
      min: 92,
      max: 108,
    });
  });

  it('should limit keywords to maximum of 30 tags for reach estimate', async () => {
    loggedUser = '3'; // moderator in 'm'

    // Insert a recent post in squad 'm' with many tags
    await con.getRepository(Post).save({
      id: 'mp4',
      shortId: 'mp4',
      title: 'M Post 4',
      url: 'http://mp4.com',
      createdAt: new Date(),
      sourceId: 'm',
      type: PostType.Article,
      visible: true,
    });

    // First create the Keywords with allow status (40 tags)
    const keywordEntities = Array.from({ length: 40 }, (_, i) => ({
      value: `reachtag${i + 1}`,
      status: 'allow' as const,
    }));
    await con.getRepository(Keyword).save(keywordEntities);

    // Add more than 30 keywords to PostKeyword table (status set by trigger)
    const keywords = Array.from({ length: 40 }, (_, i) => ({
      postId: 'mp4',
      keyword: `reachtag${i + 1}`,
    }));
    await con.getRepository(PostKeyword).save(keywords);

    // Mock the HTTP response using nock
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        const requestKeywords = body?.targeting?.value?.boost?.keywords || [];
        return (
          body.daily_budget === 30 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === undefined &&
          Array.isArray(requestKeywords) &&
          requestKeywords.length === 30 // Should be limited to 30
        );
      })
      .reply(200, {
        reach: {
          impressions: 180,
          clicks: 12,
          users: 85,
          min_impressions: 78,
          max_impressions: 92,
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...sourceParams, budget: 3000 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyCampaignReachEstimate).toEqual({
      min: 78,
      max: 92,
    });
  });

  it('should only use active keywords for reach estimation', async () => {
    loggedUser = '3'; // moderator in 'm'

    // Insert a recent post in squad 'm'
    await con.getRepository(Post).save({
      id: 'mp6',
      shortId: 'mp6',
      title: 'M Post 6',
      url: 'http://mp6.com',
      createdAt: new Date(),
      sourceId: 'm',
      type: PostType.Article,
      visible: true,
    });

    // First create Keywords - some with allow status, some with deny status
    const allowedKeywordEntities = Array.from({ length: 6 }, (_, i) => ({
      value: `reach_active_tag${i + 1}`,
      status: 'allow' as const,
    }));
    const deniedKeywordEntities = Array.from({ length: 4 }, (_, i) => ({
      value: `reach_inactive_tag${i + 1}`,
      status: 'deny' as const,
    }));

    await con
      .getRepository(Keyword)
      .save([...allowedKeywordEntities, ...deniedKeywordEntities]);

    // Add PostKeywords (status will be set by trigger based on Keyword status)
    const postKeywords = [
      ...Array.from({ length: 6 }, (_, i) => ({
        postId: 'mp6',
        keyword: `reach_active_tag${i + 1}`,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        postId: 'mp6',
        keyword: `reach_inactive_tag${i + 1}`,
      })),
    ];

    await con.getRepository(PostKeyword).save(postKeywords);

    // Mock the HTTP response using nock - verify only active keywords are sent
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/reach', (body) => {
        const requestKeywords = body?.targeting?.value?.boost?.keywords || [];

        // Should only include the 6 active keywords
        const expectedActiveKeywords = [
          'reach_active_tag1',
          'reach_active_tag2',
          'reach_active_tag3',
          'reach_active_tag4',
          'reach_active_tag5',
          'reach_active_tag6',
        ];

        const keywordsMatch =
          requestKeywords.every((keyword: string) =>
            expectedActiveKeywords.includes(keyword),
          ) && requestKeywords.length === expectedActiveKeywords.length;

        return (
          body.daily_budget === 30 &&
          body.targeting?.type === 'BOOST' &&
          body.targeting?.value?.boost?.post_id === undefined &&
          Array.isArray(requestKeywords) &&
          keywordsMatch
        );
      })
      .reply(200, {
        reach: {
          impressions: 160,
          clicks: 10,
          users: 80,
          min_impressions: 74,
          max_impressions: 86,
        },
      });

    const res = await client.query(QUERY, {
      variables: { ...sourceParams, budget: 3000 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.dailyCampaignReachEstimate).toEqual({
      min: 74,
      max: 86,
    });
  });
});
