import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testQueryErrorCode,
} from '../../helpers';
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
} from '../../../src/entity';
import { Roles, SourceMemberRoles, sourceRoleRank } from '../../../src/roles';
import { sourcesFixture } from '../../fixture/source';
import {
  postsFixture,
  postTagsFixture,
  videoPostsFixture,
} from '../../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';

import { randomUUID } from 'crypto';
import { deleteKeysByPattern, ioRedisPool } from '../../../src/redis';
import { rateLimiterName } from '../../../src/directive/rateLimit';
import { badUsersFixture } from '../../fixture/user';

jest.mock('../../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../../src/common/pubsub') as Record<
    string,
    unknown
  >),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null!;
let isTeamMember = false;
let isPlus = false;
let roles: Roles[] = [];

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    (req) => new MockContext(con, loggedUser, roles, req, isTeamMember, isPlus),
  );
  client = state.client;
});

beforeEach(async () => {
  loggedUser = null!;
  isTeamMember = false;
  isPlus = false;
  roles = [];
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
});

afterAll(() => disposeGraphQLTesting(state));

describe('query postCampaignById', () => {
  const QUERY = `
    query PostCampaignById($id: ID!) {
      postCampaignById(id: $id) {
        post {
          id
          title
          image
        }
        campaign {
          campaignId
          postId
          status
          budget
          currentBudget
          impressions
          clicks
        }
      }
    }
  `;

  const params = { id: 'sample' };

  beforeEach(async () => {
    isTeamMember = true; // TODO: remove when we are about to run production
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if post is not found', async () => {
    loggedUser = '1';
    // Set the post as already boosted
    await con.getRepository(Post).delete({ id: 'p1' });

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: params },
      'NOT_FOUND',
    );
  });

  it('should the response returned by skadi client', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, { variables: params });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaignById).toEqual({
      campaign: {
        budget: 'mock-budget',
        campaignId: 'mock-campaign-id',
        clicks: 92,
        currentBudget: 'mock-current-budget',
        impressions: 100,
        postId: 'p1',
        status: 'mock-status',
      },
      post: {
        id: 'p1',
        image: 'https://daily.dev/image.jpg',
        title: 'P1',
      },
    });
  });
});
