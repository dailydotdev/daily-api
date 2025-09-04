import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
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
  SharePost,
  FreeformPost,
  WelcomePost,
  CollectionPost,
  PostType,
  Campaign,
  CampaignPost,
  CampaignState,
  CampaignType,
} from '../../../src/entity';
import { SourceMemberRoles, sourceRoleRank } from '../../../src/roles';
import { sourcesFixture } from '../../fixture/source';
import {
  postsFixture,
  postTagsFixture,
  videoPostsFixture,
} from '../../fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import { Context } from '../../../src/Context';

import { randomUUID } from 'crypto';
import { deleteKeysByPattern, ioRedisPool } from '../../../src/redis';
import { rateLimiterName } from '../../../src/directive/rateLimit';
import { badUsersFixture } from '../../fixture/user';
import { pickImageUrl } from '../../../src/common/post';
import { updateFlagsStatement } from '../../../src/common';
import { UserTransaction } from '../../../src/entity/user/UserTransaction';
import {
  createMockNjordTransport,
  createMockNjordErrorTransport,
} from '../../helpers';
import { createClient } from '@connectrpc/connect';
import { Credits, EntityType } from '@dailydotdev/schema';
import * as njordCommon from '../../../src/common/njord';
import { fetchParse } from '../../../src/integrations/retry';
import { ONE_DAY_IN_SECONDS } from '../../../src/common';
import nock from 'nock';
import { getAdvertiserId } from '../../../src/integrations/skadi/api/v2/clients';

jest.mock('../../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../../src/common/pubsub') as Record<
    string,
    unknown
  >),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

// Mock fetchParse to test actual HTTP calls
jest.mock('../../../src/integrations/retry', () => ({
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

describe('query postCampaignById', () => {
  const QUERY = `
    query PostCampaignById($id: ID!) {
      postCampaignById(id: $id) {
        post {
          id
          title
          image
          shortId
          permalink
          engagements
        }
        campaign {
          campaignId
          postId
          status
          spend
          impressions
          clicks
          users
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
        views: 150,
        upvotes: 75,
        comments: 25,
      },
    );
  });

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: randomUUID() } },
      'UNAUTHENTICATED',
    ));

  it('should return an error if campaign is not found', async () => {
    loggedUser = '1';

    // Use a non-existent campaign ID
    const nonExistentCampaignId = randomUUID();

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: nonExistentCampaignId } },
      'NOT_FOUND',
    );
  });

  it('should the response returned by database', async () => {
    loggedUser = '1';

    // Create campaign in database
    const campaignId = randomUUID();
    await con.getRepository(CampaignPost).save({
      id: campaignId,
      creativeId: randomUUID(),
      flags: {
        budget: 2000,
        spend: 1000,
        users: 25,
        clicks: 10,
        impressions: 50,
      },
      userId: '1',
      referenceId: 'p1',
      state: CampaignState.Active,
      postId: 'p1',
      type: CampaignType.Post,
      createdAt: new Date('2024-01-01'),
      endedAt: new Date('2024-01-08'),
    });

    const res = await client.query(QUERY, { variables: { id: campaignId } });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaignById).toEqual({
      campaign: {
        spend: 1000,
        campaignId: campaignId,
        clicks: 10,
        impressions: 50,
        postId: 'p1',
        status: 'ACTIVE',
        users: 25,
      },
      post: {
        id: 'p1',
        image: 'https://daily.dev/image.jpg',
        title: 'P1',
        shortId: 'sp1',
        permalink: 'http://localhost:4000/r/sp1',
        engagements: 0, // Not used anymore
      },
    });
  });

  describe('post type handling in getFormattedBoostedPost', () => {
    beforeEach(async () => {
      loggedUser = '1';
      isTeamMember = true;
    });

    describe('Share posts', () => {
      it('should use shared post image and title when share post has no title', async () => {
        // Create a shared post (p1) that will be referenced - using existing fixture post
        const sharedPostId1 = randomUUID();
        await con.getRepository(ArticlePost).save({
          id: sharedPostId1,
          shortId: 'shared1',
          title: 'Shared Post Title',
          image: 'https://shared-post-image.jpg',
          url: 'http://shared-post.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          views: 200,
          upvotes: 100,
          comments: 30,
        });

        // Create a share post that references the shared post
        const sharePostId1 = randomUUID();
        await con.getRepository(SharePost).save({
          id: sharePostId1,
          shortId: 'share1',
          title: null, // No title on share post
          sharedPostId: sharedPostId1,
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
          views: 80,
          upvotes: 40,
          comments: 15,
        });

        // Create campaign in database
        const shareCampaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: shareCampaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: sharePostId1,
          state: CampaignState.Active,
          postId: sharePostId1,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: shareCampaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: sharePostId1,
          image: 'https://shared-post-image.jpg', // From shared post
          title: 'Shared Post Title', // From shared post
          shortId: 'share1',
          permalink: 'http://localhost:4000/r/share1',
          engagements: 0, // Not used anymore
        });
      });

      it('should use share post title when available, fallback to shared post title', async () => {
        // Create a shared post
        const sharedPostId = randomUUID();
        await con.getRepository(ArticlePost).save({
          id: sharedPostId,
          shortId: 'shared2',
          title: 'Original Shared Post Title',
          image: 'https://shared-post-2-image.jpg',
          url: 'http://shared-post-2.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          views: 120,
          upvotes: 60,
          comments: 20,
        });

        // Create a share post with its own title
        const sharePostId = randomUUID();
        await con.getRepository(SharePost).save({
          id: sharePostId,
          shortId: 'share2',
          title: 'Share Post Custom Title', // Has its own title
          sharedPostId: sharedPostId,
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
          views: 90,
          upvotes: 45,
          comments: 18,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: sharePostId,
          state: CampaignState.Active,
          postId: sharePostId,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: sharePostId,
          image: 'https://shared-post-2-image.jpg', // From shared post
          title: 'Share Post Custom Title', // From share post (not shared post)
          shortId: 'share2',
          permalink: 'http://localhost:4000/r/share2',
          engagements: 0, // Not used anymore
        });
      });

      it('should handle share post with empty title string', async () => {
        // Create a shared post
        const sharedPostId = randomUUID();
        await con.getRepository(ArticlePost).save({
          id: sharedPostId,
          shortId: 'shared3',
          title: 'Shared Post Title for Empty',
          image: 'https://shared-post-3-image.jpg',
          url: 'http://shared-post-3.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          views: 180,
          upvotes: 90,
          comments: 35,
        });

        // Create a share post with empty title
        const sharePostId = randomUUID();
        await con.getRepository(SharePost).save({
          id: sharePostId,
          shortId: 'share3',
          title: '', // Empty string title
          sharedPostId: sharedPostId,
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
          views: 70,
          upvotes: 35,
          comments: 12,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: sharePostId,
          state: CampaignState.Active,
          postId: sharePostId,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: sharePostId,
          image: 'https://shared-post-3-image.jpg', // From shared post
          title: 'Shared Post Title for Empty', // From shared post (empty string is falsy)
          shortId: 'share3',
          permalink: 'http://localhost:4000/r/share3',
          engagements: 0, // Not used anymore
        });
      });
    });

    describe('Freeform posts', () => {
      it('should use freeform post image directly', async () => {
        // Create a freeform post
        const freeformPostId = randomUUID();
        const freeformPost = await con.getRepository(FreeformPost).save({
          id: freeformPostId,
          shortId: 'freeform1',
          title: 'Freeform Post Title',
          image: 'https://freeform-post-image.jpg',
          content: 'Freeform post content',
          sourceId: 'a',
          type: PostType.Freeform,
          createdAt: new Date(),
          authorId: '1',
          views: 250,
          upvotes: 125,
          comments: 45,
        } as unknown as Partial<FreeformPost>);

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: freeformPost.id,
          state: CampaignState.Active,
          postId: freeformPost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: freeformPost.id,
          image: 'https://freeform-post-image.jpg', // Direct from freeform post
          title: 'Freeform Post Title',
          shortId: 'freeform1',
          permalink: 'http://localhost:4000/r/freeform1',
          engagements: 0, // Not used anymore
        });
      });

      it('should handle freeform post with no image', async () => {
        // Create a freeform post without image
        const createdAt = new Date();
        const freeformPostId = randomUUID();
        const freeformPost = await con.getRepository(FreeformPost).save({
          id: freeformPostId,
          shortId: 'freeform2',
          title: 'Freeform Post No Image',
          image: null, // No image
          content: 'Freeform post content',
          sourceId: 'a',
          type: PostType.Freeform,
          createdAt,
          authorId: '1',
          views: 95,
          upvotes: 48,
          comments: 22,
        } as unknown as Partial<FreeformPost>);

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: freeformPost.id,
          state: CampaignState.Active,
          postId: freeformPost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        const post = JSON.parse(
          JSON.stringify({ ...res.data.postCampaignById.post }),
        );
        delete post.image;
        expect(post).toEqual({
          id: freeformPost.id,
          title: 'Freeform Post No Image',
          shortId: 'freeform2',
          permalink: 'http://localhost:4000/r/freeform2',
          engagements: 0, // Not used anymore
        });
        const image = res.data.postCampaignById.post.image;
        const fallback = pickImageUrl({ createdAt });
        const isImageFallback = image.startsWith(
          fallback.substring(0, fallback.length - 2),
        );
        expect(isImageFallback).toBeTruthy();
      });
    });

    describe('Article posts', () => {
      it('should use article post image directly', async () => {
        // Create an article post
        const articlePostId = randomUUID();
        const articlePost = await con.getRepository(ArticlePost).save({
          id: articlePostId,
          shortId: 'article1',
          title: 'Article Post Title',
          image: 'https://article-post-image.jpg',
          url: 'http://article-post.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          authorId: '1',
          views: 300,
          upvotes: 150,
          comments: 60,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: articlePost.id,
          state: CampaignState.Active,
          postId: articlePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: articlePost.id,
          image: 'https://article-post-image.jpg', // Direct from article post
          title: 'Article Post Title',
          shortId: 'article1',
          permalink: 'http://localhost:4000/r/article1',
          engagements: 0, // Not used anymore
        });
      });

      it('should handle article post with no image', async () => {
        // Create an article post without image
        const createdAt = new Date();
        const articlePostId = randomUUID();
        const articlePost = await con.getRepository(ArticlePost).save({
          id: articlePostId,
          shortId: 'article2',
          title: 'Article Post No Image',
          image: null, // No image
          url: 'http://article-post-2.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt,
          authorId: '1',
          views: 110,
          upvotes: 55,
          comments: 28,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: articlePost.id,
          state: CampaignState.Active,
          postId: articlePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        const post = JSON.parse(
          JSON.stringify({ ...res.data.postCampaignById.post }),
        );
        delete post.image;
        expect(post).toEqual({
          id: articlePost.id,
          title: 'Article Post No Image',
          shortId: 'article2',
          permalink: 'http://localhost:4000/r/article2',
          engagements: 0, // Not used anymore
        });
        const image = res.data.postCampaignById.post.image;
        const fallback = pickImageUrl({ createdAt });
        const isImageFallback = image.startsWith(
          fallback.substring(0, fallback.length - 2),
        );
        expect(isImageFallback).toBeTruthy();
      });
    });

    describe('Welcome posts', () => {
      it('should use welcome post image directly', async () => {
        // Create a welcome post
        const welcomePostId = randomUUID();
        const welcomePost = await con.getRepository(WelcomePost).save({
          id: welcomePostId,
          shortId: 'welcome1',
          title: 'Welcome Post Title',
          image: 'https://welcome-post-image.jpg',
          content: 'Welcome post content',
          sourceId: 'a',
          type: PostType.Welcome,
          createdAt: new Date(),
          authorId: '1',
          views: 85,
          upvotes: 42,
          comments: 18,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: welcomePost.id,
          state: CampaignState.Active,
          postId: welcomePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: welcomePost.id,
          image: 'https://welcome-post-image.jpg', // Direct from welcome post
          title: 'Welcome Post Title',
          shortId: 'welcome1',
          permalink: 'http://localhost:4000/r/welcome1',
          engagements: 0, // Not used anymore
        });
      });
    });

    describe('Collection posts', () => {
      it('should use collection post image directly', async () => {
        // Create a collection post
        const collectionPostId = randomUUID();
        const collectionPost = await con.getRepository(CollectionPost).save({
          id: collectionPostId,
          shortId: 'collect1',
          title: 'Collection Post Title',
          image: 'https://collection-post-image.jpg',
          content: 'Collection post content',
          sourceId: 'a',
          type: PostType.Collection,
          createdAt: new Date(),
          authorId: '1',
          views: 160,
          upvotes: 80,
          comments: 32,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: collectionPost.id,
          state: CampaignState.Active,
          postId: collectionPost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: collectionPost.id,
          image: 'https://collection-post-image.jpg', // Direct from collection post
          title: 'Collection Post Title',
          shortId: 'collect1',
          permalink: 'http://localhost:4000/r/collect1',
          engagements: 0, // Not used anymore
        });
      });
    });

    describe('YouTube video posts', () => {
      it('should use YouTube post image directly', async () => {
        // Create a YouTube post
        const youtubePostId = randomUUID();
        const youtubePost = await con.getRepository(YouTubePost).save({
          id: youtubePostId,
          shortId: 'youtube1',
          title: 'YouTube Post Title',
          image: 'https://youtube-post-image.jpg',
          url: 'https://youtu.be/example',
          videoId: 'example',
          sourceId: 'a',
          type: PostType.VideoYouTube,
          createdAt: new Date(),
          authorId: '1',
          views: 220,
          upvotes: 110,
          comments: 38,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: youtubePost.id,
          state: CampaignState.Active,
          postId: youtubePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: youtubePost.id,
          image: 'https://youtube-post-image.jpg', // Direct from YouTube post
          title: 'YouTube Post Title',
          shortId: 'youtube1',
          permalink: 'http://localhost:4000/r/youtube1',
          engagements: 0, // Not used anymore
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle share post with shared post that has no image', async () => {
        // Create a shared post with no image
        const createdAt = new Date();
        const sharedPostNoImageId = randomUUID();
        await con.getRepository(ArticlePost).save({
          id: sharedPostNoImageId,
          shortId: 'sharednoimg',
          title: 'Shared Post No Image',
          image: null, // No image
          url: 'http://shared-post-no-image.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt,
          views: 75,
          upvotes: 38,
          comments: 15,
        });

        // Create a share post that references the shared post
        const sharePostId = randomUUID();
        const sharePost = await con.getRepository(SharePost).save({
          id: sharePostId,
          shortId: 'sharenoimg',
          title: 'Share Post with Shared Post No Image',
          sharedPostId: sharedPostNoImageId,
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
          views: 65,
          upvotes: 32,
          comments: 14,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: sharePost.id,
          state: CampaignState.Active,
          postId: sharePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        const post = JSON.parse(
          JSON.stringify({ ...res.data.postCampaignById.post }),
        );
        delete post.image;
        expect(post).toEqual({
          id: sharePost.id,
          title: 'Share Post with Shared Post No Image', // Uses share post title
          shortId: 'sharenoimg',
          permalink: 'http://localhost:4000/r/sharenoimg',
          engagements: 0, // Not used anymore
        });
        const image = res.data.postCampaignById.post.image;
        const fallback = pickImageUrl({ createdAt });
        const isImageFallback = image.startsWith(
          fallback.substring(0, fallback.length - 2),
        );
        expect(isImageFallback).toBeTruthy();
      });

      it('should handle post with null title', async () => {
        // Create a post with null title
        const nullTitlePostId = randomUUID();
        const nullTitlePost = await con.getRepository(ArticlePost).save({
          id: nullTitlePostId,
          shortId: 'nulltitle',
          title: null, // Null title
          image: 'https://null-title-image.jpg',
          url: 'http://null-title.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          authorId: '1',
          views: 45,
          upvotes: 22,
          comments: 8,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: nullTitlePost.id,
          state: CampaignState.Active,
          postId: nullTitlePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: nullTitlePost.id,
          image: 'https://null-title-image.jpg',
          title: null, // Preserves null title
          shortId: 'nulltitle',
          permalink: 'http://localhost:4000/r/nulltitle',
          engagements: 0, // Not used anymore
        });
      });

      it('should handle post with undefined title', async () => {
        // Create a post with undefined title
        const undefinedTitlePostId = randomUUID();
        const undefinedTitlePost = await con.getRepository(ArticlePost).save({
          id: undefinedTitlePostId,
          shortId: 'undeftitle',
          title: undefined, // Undefined title
          image: 'https://undefined-title-image.jpg',
          url: 'http://undefined-title.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          authorId: '1',
          views: 55,
          upvotes: 28,
          comments: 12,
        });

        // Create campaign in database
        const campaignId = randomUUID();
        await con.getRepository(CampaignPost).save({
          id: campaignId,
          creativeId: randomUUID(),
          flags: {
            budget: 2000,
            spend: 1000,
            users: 25,
            clicks: 10,
            impressions: 50,
          },
          userId: '1',
          referenceId: undefinedTitlePost.id,
          state: CampaignState.Active,
          postId: undefinedTitlePost.id,
          type: CampaignType.Post,
          createdAt: new Date('2024-01-01'),
          endedAt: new Date('2024-01-08'),
        });

        const res = await client.query(QUERY, {
          variables: { id: campaignId },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: undefinedTitlePost.id,
          image: 'https://undefined-title-image.jpg',
          title: null, // Preserves undefined title
          shortId: 'undeftitle',
          permalink: 'http://localhost:4000/r/undeftitle',
          engagements: 0, // Not used anymore
        });
      });
    });
  });
});

describe('query postCampaigns', () => {
  const QUERY = `
    query PostCampaigns($first: Int, $after: String) {
      postCampaigns(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        edges {
          cursor
          node {
            post {
              id
              title
              image
              shortId
              permalink
              engagements
            }
            campaign {
              campaignId
              postId
              status
              spend
              impressions
              clicks
              users
            }
          }
        }
        stats {
          users
          impressions
          clicks
          totalSpend
          engagements
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { first: 10 } },
      'UNAUTHENTICATED',
    ));

  it('should return empty connection when no campaigns exist', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaigns).toEqual({
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null,
      },
      edges: [],
      stats: {
        impressions: 0,
        clicks: 0,
        totalSpend: 0,
        engagements: 0,
        users: 0,
      },
    });
  });

  it('should return campaigns with posts and stats on first request', async () => {
    loggedUser = '1';

    // Create test posts
    await con.getRepository(ArticlePost).save([
      {
        id: 'post-1',
        shortId: 'p1',
        title: 'Test Post 1',
        image: 'https://test-post-1.jpg',
        url: 'http://test-post-1.com',
        sourceId: 'a',
        type: PostType.Article,
        createdAt: new Date(),
        authorId: '1',
        views: 100,
        upvotes: 50,
        comments: 25,
      },
      {
        id: 'post-2',
        shortId: 'p2',
        title: 'Test Post 2',
        image: 'https://test-post-2.jpg',
        url: 'http://test-post-2.com',
        sourceId: 'a',
        type: PostType.Article,
        createdAt: new Date(),
        authorId: '1',
        views: 200,
        upvotes: 75,
        comments: 30,
      },
    ]);

    // Create campaigns in database
    const campaign1Id = randomUUID();
    const campaign2Id = randomUUID();
    await con.getRepository(CampaignPost).save([
      {
        id: campaign1Id,
        creativeId: randomUUID(),
        flags: {
          budget: 1050,
          spend: 500,
          users: 500,
          clicks: 50,
          impressions: 1000,
        },
        userId: '1',
        referenceId: 'post-1',
        state: CampaignState.Active,
        postId: 'post-1',
        type: CampaignType.Post,
        createdAt: new Date('2024-01-01'),
        endedAt: new Date('2024-01-08'),
      },
      {
        id: campaign2Id,
        creativeId: randomUUID(),
        flags: {
          budget: 2000,
          spend: 800,
          users: 800,
          clicks: 100,
          impressions: 2000,
        },
        userId: '1',
        referenceId: 'post-2',
        state: CampaignState.Active,
        postId: 'post-2',
        type: CampaignType.Post,
        createdAt: new Date('2024-01-02'),
        endedAt: new Date('2024-01-09'),
      },
    ]);

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaigns.pageInfo).toEqual({
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: 'YXJyYXljb25uZWN0aW9uOjE=',
      endCursor: 'YXJyYXljb25uZWN0aW9uOjI=',
    });
    expect(res.data.postCampaigns.edges).toHaveLength(2);
    // Campaign2 comes first (newer: 2024-01-02)
    expect(res.data.postCampaigns.edges[0]).toEqual({
      cursor: 'YXJyYXljb25uZWN0aW9uOjE=',
      node: {
        post: {
          id: 'post-2',
          title: 'Test Post 2',
          image: 'https://test-post-2.jpg',
          shortId: 'p2',
          permalink: 'http://localhost:4000/r/p2',
          engagements: 0, // Not used anymore
        },
        campaign: {
          spend: 800,
          campaignId: campaign2Id,
          clicks: 100,
          impressions: 2000,
          postId: 'post-2',
          status: 'ACTIVE',
          users: 800,
        },
      },
    });
    // Campaign1 comes second (older: 2024-01-01)
    expect(res.data.postCampaigns.edges[1]).toEqual({
      cursor: 'YXJyYXljb25uZWN0aW9uOjI=',
      node: {
        post: {
          id: 'post-1',
          title: 'Test Post 1',
          image: 'https://test-post-1.jpg',
          shortId: 'p1',
          permalink: 'http://localhost:4000/r/p1',
          engagements: 0, // Not used anymore
        },
        campaign: {
          spend: 500,
          campaignId: campaign1Id,
          clicks: 50,
          impressions: 1000,
          postId: 'post-1',
          status: 'ACTIVE',
          users: 500,
        },
      },
    });
    expect(res.data.postCampaigns.stats).toEqual({
      impressions: 3000, // 1000 + 2000
      clicks: 150, // 50 + 100
      users: 1300, // 500 + 800
      totalSpend: 1300, // 500 + 800
      engagements: 0, // Not used anymore
    });
  });

  it('should not include stats on subsequent requests (with after cursor)', async () => {
    loggedUser = '1';

    // Create test post
    await con.getRepository(ArticlePost).save({
      id: 'post-3',
      shortId: 'p3',
      title: 'Test Post 3',
      image: 'https://test-post-3.jpg',
      url: 'http://test-postm,kl.-3.com',
      sourceId: 'a',
      type: PostType.Article,
      createdAt: new Date(),
      authorId: '1',
      views: 85,
      upvotes: 42,
      comments: 18,
    });

    // Create campaign in database
    const campaign3Id = randomUUID();
    await con.getRepository(CampaignPost).save({
      id: campaign3Id,
      creativeId: randomUUID(),
      flags: {
        budget: 1500,
        spend: 750,
        users: 900,
        clicks: 75,
        impressions: 1500,
      },
      userId: '1',
      referenceId: 'post-3',
      state: CampaignState.Active,
      postId: 'post-3',
      type: CampaignType.Post,
      createdAt: new Date('2024-01-03'),
      endedAt: new Date('2024-01-10'),
    });

    const res = await client.query(QUERY, {
      variables: { first: 10, after: '2' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaigns.stats).toBeNull();
    expect(res.data.postCampaigns.edges).toHaveLength(1);
    expect(res.data.postCampaigns.edges[0].cursor).toBe(
      'YXJyYXljb25uZWN0aW9uOk5hTg==',
    );
  });

  it('should handle pagination correctly', async () => {
    loggedUser = '1';

    // Create multiple test posts
    const posts: Array<{
      id: string;
      shortId: string;
      title: string;
      image: string;
      url: string;
      sourceId: string;
      type: PostType;
      createdAt: Date;
      authorId: string;
      views: number;
      upvotes: number;
      comments: number;
    }> = [];
    for (let i = 1; i <= 5; i++) {
      posts.push({
        id: `post-${i}`,
        shortId: `p${i}`,
        title: `Test Post ${i}`,
        image: `https://test-post-${i}.jpg`,
        url: `http://test-post-${i}.com`,
        sourceId: 'a',
        type: PostType.Article,
        createdAt: new Date(),
        authorId: '1',
        views: 50 + i * 10,
        upvotes: 25 + i * 5,
        comments: 10 + i * 2,
      });
    }
    await con.getRepository(ArticlePost).save(posts);

    // Create campaigns in database
    const campaigns = posts.map((post, index) => ({
      id: randomUUID(),
      creativeId: randomUUID(),
      flags: {
        budget: 1000 + index * 100,
        spend: 500 + index * 50,
        users: 600 + index * 50,
        clicks: 50 + index * 10,
        impressions: 1000 + index * 100,
      },
      userId: '1',
      referenceId: post.id,
      state: CampaignState.Active,
      postId: post.id,
      type: CampaignType.Post,
      createdAt: new Date(`2024-01-0${index + 1}`),
      endedAt: new Date(`2024-01-${10 + index}`),
    }));
    await con.getRepository(CampaignPost).save(campaigns);

    // First request - limit to 2
    const res1 = await client.query(QUERY, { variables: { first: 2 } });

    expect(res1.errors).toBeFalsy();
    expect(res1.data.postCampaigns.edges).toHaveLength(2);
    expect(res1.data.postCampaigns.pageInfo.hasNextPage).toBe(true);
    expect(res1.data.postCampaigns.pageInfo.endCursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjI=',
    );
    expect(res1.data.postCampaigns.stats).toEqual({
      impressions: 6000, // 1000+1100+1200+1300+1400
      clicks: 350, // 50+60+70+80+90
      users: 3500, // 600+650+700+750+800
      totalSpend: 3000, // 500+550+600+650+700
      engagements: 0, // Not used anymore
    });

    // Second request - get next 2 (offset 2)
    const res2 = await client.query(QUERY, {
      variables: { first: 2, after: 'YXJyYXljb25uZWN0aW9uOjI=' },
    });

    expect(res2.errors).toBeFalsy();
    expect(res2.data.postCampaigns.edges).toHaveLength(2);
    expect(res2.data.postCampaigns.pageInfo.hasNextPage).toBe(true);
    expect(res2.data.postCampaigns.pageInfo.startCursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjM=',
    );
    expect(res2.data.postCampaigns.pageInfo.endCursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjQ=',
    );
    expect(res2.data.postCampaigns.stats).toBeNull(); // No stats on subsequent requests
  });

  it('should handle different post types correctly', async () => {
    loggedUser = '1';

    // Create different types of posts
    await con.getRepository(ArticlePost).save({
      id: 'article-post',
      shortId: 'ap',
      title: 'Article Post',
      image: 'https://article-post.jpg',
      url: 'http://article-post.com',
      sourceId: 'a',
      type: PostType.Article,
      createdAt: new Date(),
      authorId: '1',
      views: 120,
      upvotes: 60,
      comments: 25,
    });

    await con.getRepository(FreeformPost).save({
      id: 'freeform-post',
      shortId: 'fp',
      title: 'Freeform Post',
      image: 'https://freeform-post.jpg',
      content: 'Freeform content',
      sourceId: 'a',
      type: PostType.Freeform,
      createdAt: new Date(),
      authorId: '1',
      views: 95,
      upvotes: 48,
      comments: 20,
    } as unknown as Partial<FreeformPost>);

    // Create a shared post for share post test
    await con.getRepository(ArticlePost).save({
      id: 'shared-post',
      shortId: 'sp',
      title: 'Shared Post Title',
      image: 'https://shared-post.jpg',
      url: 'http://shared-post.com',
      sourceId: 'a',
      type: PostType.Article,
      createdAt: new Date(),
      views: 180,
      upvotes: 90,
      comments: 35,
    });

    await con.getRepository(SharePost).save({
      id: 'share-post',
      shortId: 'share',
      title: 'Share Post Title',
      sharedPostId: 'shared-post',
      sourceId: 'a',
      type: PostType.Share,
      createdAt: new Date(),
      authorId: '1',
      views: 75,
      upvotes: 38,
      comments: 15,
    });

    // Create campaigns in database for different post types
    await con.getRepository(CampaignPost).save([
      {
        id: randomUUID(),
        creativeId: randomUUID(),
        flags: {
          budget: 1000,
          spend: 400,
          users: 600,
          clicks: 50,
          impressions: 1000,
        },
        userId: '1',
        referenceId: 'article-post',
        state: CampaignState.Active,
        postId: 'article-post',
        type: CampaignType.Post,
        createdAt: new Date('2024-01-01'),
        endedAt: new Date('2024-01-08'),
      },
      {
        id: randomUUID(),
        creativeId: randomUUID(),
        flags: {
          budget: 1000,
          spend: 350,
          users: 650,
          clicks: 50,
          impressions: 1000,
        },
        userId: '1',
        referenceId: 'freeform-post',
        state: CampaignState.Active,
        postId: 'freeform-post',
        type: CampaignType.Post,
        createdAt: new Date('2024-01-02'),
        endedAt: new Date('2024-01-09'),
      },
      {
        id: randomUUID(),
        creativeId: randomUUID(),
        flags: {
          budget: 1000,
          spend: 300,
          users: 700,
          clicks: 50,
          impressions: 1000,
        },
        userId: '1',
        referenceId: 'share-post',
        state: CampaignState.Active,
        postId: 'share-post',
        type: CampaignType.Post,
        createdAt: new Date('2024-01-03'),
        endedAt: new Date('2024-01-10'),
      },
    ]);

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaigns.edges).toHaveLength(3);

    // Check share post (newest: 2024-01-03) - comes first
    expect(res.data.postCampaigns.edges[0].node.post).toEqual({
      id: 'share-post',
      title: 'Share Post Title',
      image: 'https://shared-post.jpg', // From shared post
      shortId: 'share',
      permalink: 'http://localhost:4000/r/share',
      engagements: 0, // Not used anymore
    });
    expect(res.data.postCampaigns.edges[0].cursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjE=',
    );

    // Check freeform post (middle: 2024-01-02) - comes second
    expect(res.data.postCampaigns.edges[1].node.post).toEqual({
      id: 'freeform-post',
      title: 'Freeform Post',
      image: 'https://freeform-post.jpg',
      shortId: 'fp',
      permalink: 'http://localhost:4000/r/fp',
      engagements: 0, // Not used anymore
    });
    expect(res.data.postCampaigns.edges[1].cursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjI=',
    );

    // Check article post (oldest: 2024-01-01) - comes third
    expect(res.data.postCampaigns.edges[2].node.post).toEqual({
      id: 'article-post',
      title: 'Article Post',
      image: 'https://article-post.jpg',
      shortId: 'ap',
      permalink: 'http://localhost:4000/r/ap',
      engagements: 0, // Not used anymore
    });
    expect(res.data.postCampaigns.edges[2].cursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjM=',
    );

    // Check stats
    expect(res.data.postCampaigns.stats).toEqual({
      impressions: 3000, // 1000 + 1000 + 1000
      clicks: 150, // 50 + 50 + 50
      totalSpend: 1050, // 400 + 350 + 300
      engagements: 0, // Not used anymore
      users: 1950, // 600 + 650 + 700
    });
  });

  it('should handle edge cases with zero values', async () => {
    loggedUser = '1';

    await con.getRepository(ArticlePost).save({
      id: 'zero-post',
      shortId: 'zp',
      title: 'Zero Post',
      image: 'https://zero-post.jpg',
      url: 'http://zero-post.com',
      sourceId: 'a',
      type: PostType.Article,
      createdAt: new Date(),
      authorId: '1',
      views: 0,
      upvotes: 0,
      comments: 0,
    });

    // Create campaign in database with zero values
    const campaignZeroId = randomUUID();
    await con.getRepository(CampaignPost).save({
      id: campaignZeroId,
      creativeId: randomUUID(),
      flags: {
        budget: 0,
        spend: 0,
        users: 0,
        clicks: 0,
        impressions: 0,
      },
      userId: '1',
      referenceId: 'zero-post',
      state: CampaignState.Active,
      postId: 'zero-post',
      type: CampaignType.Post,
      createdAt: new Date('2024-01-01'),
      endedAt: new Date('2024-01-08'),
    });

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaigns.edges).toHaveLength(1);
    expect(res.data.postCampaigns.edges[0].node.campaign).toEqual({
      campaignId: campaignZeroId,
      postId: 'zero-post',
      status: 'ACTIVE',
      spend: 0,
      impressions: 0,
      clicks: 0,
      users: 0,
    });
    expect(res.data.postCampaigns.edges[0].cursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjE=',
    );
    expect(res.data.postCampaigns.stats).toEqual({
      impressions: 0,
      clicks: 0,
      totalSpend: 0,
      engagements: 0, // 0+0+0+0+0 = 0
      users: 0, // 0
    });
  });

  it('should handle decimal amounts in campaign spend correctly', async () => {
    loggedUser = '1';

    await con.getRepository(ArticlePost).save({
      id: 'decimal-post',
      shortId: 'dp',
      title: 'Decimal Post',
      image: 'https://decimal-post.jpg',
      url: 'http://decimal-post.com',
      sourceId: 'a',
      type: PostType.Article,
      createdAt: new Date(),
      authorId: '1',
      views: 65,
      upvotes: 32,
      comments: 12,
    });

    // Create campaign in database with decimal amount in spend
    const campaignDecimalId = randomUUID();
    await con.getRepository(CampaignPost).save({
      id: campaignDecimalId,
      creativeId: randomUUID(),
      flags: {
        budget: 2000,
        spend: 1575, // 15.75 USD = 1575 cores
        users: 750,
        clicks: 50,
        impressions: 1000,
      },
      userId: '1',
      referenceId: 'decimal-post',
      state: CampaignState.Active,
      postId: 'decimal-post',
      type: CampaignType.Post,
      createdAt: new Date('2024-01-01'),
      endedAt: new Date('2024-01-08'),
    });

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaigns.edges).toHaveLength(1);
    expect(res.data.postCampaigns.edges[0].node.campaign).toEqual({
      campaignId: campaignDecimalId,
      postId: 'decimal-post',
      status: 'ACTIVE',
      spend: 1575,
      impressions: 1000,
      clicks: 50,
      users: 750,
    });
    expect(res.data.postCampaigns.edges[0].cursor).toBe(
      'YXJyYXljb25uZWN0aW9uOjE=',
    );
    expect(res.data.postCampaigns.stats).toEqual({
      impressions: 1000, // Single campaign value
      clicks: 50, // Single campaign value
      totalSpend: 1575, // Single campaign value
      engagements: 0, // Not used anymore
      users: 750, // Single campaign value
    });
  });
});

describe('mutation startPostBoost', () => {
  const MUTATION = `
    mutation StartPostBoost($postId: ID!, $duration: Int!, $budget: Int!) {
      startPostBoost(postId: $postId, duration: $duration, budget: $budget) {
        transactionId
        referenceId
        balance {
          amount
        }
      }
    }
  `;

  const params = { postId: 'p1', duration: 7, budget: 5000 };

  beforeEach(async () => {
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if duration is less than 1', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, duration: 0 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if duration is greater than 30', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, duration: 31 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if budget is less than 1000', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, budget: 999 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if budget is greater than 100000', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, budget: 100001 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if budget is not divisible by 1000', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, budget: 1500 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if post does not exist', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, postId: 'nonexistent' } },
      'NOT_FOUND',
    );
  });

  it('should return an error if user is not the author or scout of the post', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'NOT_FOUND',
    );
  });

  it('should return an error if post is already boosted', async () => {
    loggedUser = '1';
    // Set the post as already boosted
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: 'mock-id' }),
      },
    );

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should handle skadi integration failure gracefully', async () => {
    loggedUser = '1';

    // Ensure the post is not boosted initially
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    // Mock Skadi API v2 call to fail
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/create')
      .replyWithError('Skadi service unavailable');

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });

    // This test validates that the mutation handles external service failures
    // In a real scenario, this would test the error handling when skadi service is down
    const res = await client.mutate(MUTATION, {
      variables: { ...params, duration: 1, budget: 1000 },
    });

    // The mutation should fail due to external service issues
    // but the validation logic should pass
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag is still false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should handle transfer failure gracefully', async () => {
    loggedUser = '1';
    isTeamMember = false; // Set to false so transferCores is called

    // Ensure the post is not boosted initially
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    // Mock Skadi API v2 call to succeed but transfer will fail
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
          body.creatives[0].value.post.id === 'p1'
        );
      })
      .reply(200, '');

    // Use error transport to simulate transfer failure
    const errorTransport = createMockNjordErrorTransport({
      errorStatus: 2, // INSUFFICIENT_FUNDS
      errorMessage: 'Transfer failed',
    });

    // Set up initial balance for user '1' in the error transport
    const testNjordClient = createClient(Credits, errorTransport);
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-transfer-failure',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000, // Initial balance
        },
      ],
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });

    // This test validates that the mutation handles transfer failures
    // In a real scenario, this would test the error handling when transfer fails
    const res = await client.mutate(MUTATION, {
      variables: { ...params, duration: 1, budget: 1000 },
    });

    // The mutation should fail due to transfer issues
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag is still false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();

    // The HTTP call to Skadi API v2 was made but failed during transfer
    // No need to verify the call since nock handles that automatically
  });

  it('should verify no transactions are created when validation fails', async () => {
    loggedUser = '1';

    // Ensure the post is not boosted initially
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });

    // Try to boost with invalid parameters
    const res = await client.mutate(MUTATION, {
      variables: { ...params, duration: 0 }, // Invalid duration
    });

    // Should fail validation
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag is still false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should verify no transactions are created when post does not exist', async () => {
    loggedUser = '1';

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });

    // Try to boost a non-existent post
    const res = await client.mutate(MUTATION, {
      variables: { ...params, postId: 'nonexistent' },
    });

    // Should fail with not found error
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the original post's boosted flag is unchanged
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should verify no transactions are created when user is not authorized', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    // Ensure the post is not boosted initially
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    // Get initial transaction count for user 2
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '2', referenceType: 'PostBoost' },
      });

    // Try to boost without authorization
    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    // Should fail with not found error
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created for user 2
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '2', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag is still false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should verify no transactions are created when post is already boosted', async () => {
    loggedUser = '1';

    // Set the post as already boosted
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: 'mock-id' }),
      },
    );

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });

    // Try to boost an already boosted post
    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    // Should fail with validation error
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { senderId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag remains true (unchanged)
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe('mock-id');
  });

  it('should successfully start post boost campaign', async () => {
    loggedUser = '1';

    // Ensure the post is not boosted initially
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    // Mock Skadi API v2 call to succeed
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/create', (body) => {
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        return (
          body.advertiser_id === getAdvertiserId('1') &&
          uuidRegex.test(body.campaign_id) &&
          body.budget === 10 && // 1000 cores = 10 USD
          Array.isArray(body.creatives) &&
          body.creatives.length === 1 &&
          body.creatives[0].type === 'POST' &&
          body.creatives[0].value.post.id === 'p1'
        );
      })
      .reply(200, '');

    // Set up initial balance for user '1' in the mock transport
    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-start',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000, // Initial balance
        },
      ],
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: { ...params, duration: 1, budget: 1000 },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.startPostBoost.transactionId).toBeDefined();
    expect(res.data.startPostBoost.balance.amount).toBe(9000);

    // Get the campaign ID from the database
    const campaign = await con.getRepository(Campaign).findOneOrFail({
      where: { referenceId: 'p1', userId: '1', state: CampaignState.Active },
    });
    expect(res.data.startPostBoost.referenceId).toBe(campaign.id);

    // Verify the boosted flag is now set
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe(campaign.id);

    // Verify campaign was created in database
    expect(campaign.type).toBe(CampaignType.Post);
    expect(campaign.referenceId).toBe('p1');
    expect(campaign.userId).toBe('1');
    expect(campaign.state).toBe(CampaignState.Active);
  });
});

describe('mutation cancelPostBoost', () => {
  const MUTATION = `
    mutation CancelPostBoost($postId: ID!) {
      cancelPostBoost(postId: $postId) {
        transactionId
        referenceId
        balance {
          amount
        }
      }
    }
  `;

  const params = { postId: 'p1' };

  let testCampaignId: string;

  beforeEach(async () => {
    // Create a campaign entity in the database for testing
    const campaignId = randomUUID();
    testCampaignId = campaignId;

    await con.getRepository(CampaignPost).save(
      con.getRepository(CampaignPost).create({
        id: campaignId,
        creativeId: randomUUID(),
        flags: {
          budget: 1000,
          spend: 450, // Spent 450 cores so far
          users: 100,
          clicks: 10,
          impressions: 500,
        },
        userId: '1',
        referenceId: 'p1',
        state: CampaignState.Active,
        endedAt: new Date('2024-12-31'),
        postId: 'p1',
        type: CampaignType.Post,
      }),
    );

    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        authorId: '1',
        flags: updateFlagsStatement<Post>({ campaignId }),
      },
    );
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if post does not exist', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { postId: 'nonexistent' } },
      'NOT_FOUND',
    );
  });

  it('should return an error if user is not the author or scout of the post', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'NOT_FOUND',
    );
  });

  it('should return an error if post is not currently boosted', async () => {
    loggedUser = '1';
    // Ensure the post is not boosted
    await con.getRepository(Campaign).delete({ referenceId: 'p1' });
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'NOT_FOUND',
    );
  });

  it('should successfully cancel post boost when post is boosted', async () => {
    loggedUser = '1';

    // Mock Skadi API v2 call to succeed and return current budget
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel')
      .reply(200, { budget: '5.5' }); // 5.5 USD = 550 cores

    // Set up initial balance for user '1' in the mock transport
    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000, // Initial balance
        },
      ],
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.cancelPostBoost.transactionId).toBeDefined();
    expect(res.data.cancelPostBoost.referenceId).toBe(testCampaignId);
    expect(res.data.cancelPostBoost.balance.amount).toBe(10550); // 10000 + 550 refund

    // Verify the boosted flag is now false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();

    // Verify campaign state is now cancelled
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: testCampaignId });
    expect(campaign?.state).toBe(CampaignState.Cancelled);
  });

  it('should handle skadi integration failure gracefully', async () => {
    loggedUser = '1';

    // Mock Skadi API v2 call to fail
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel')
      .replyWithError('Skadi service unavailable');

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });

    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    // The mutation should fail due to external service issues
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag remains true (unchanged)
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe(testCampaignId);

    // Verify campaign state remains active
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: testCampaignId });
    expect(campaign?.state).toBe(CampaignState.Active);
  });

  it('should handle transfer failure gracefully', async () => {
    loggedUser = '1';

    // Mock Skadi API v2 call to succeed and return current budget
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel')
      .reply(200, { budget: '5.5' }); // 5.5 USD = 550 cores

    // Use error transport to simulate transfer failure
    const errorTransport = createMockNjordErrorTransport({
      errorStatus: 2, // INSUFFICIENT_FUNDS
      errorMessage: 'Transfer failed',
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => createClient(Credits, errorTransport));

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });

    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    // The mutation should fail due to transfer issues
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag remains true (unchanged)
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe(testCampaignId);

    // Verify campaign state remains active
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: testCampaignId });
    expect(campaign?.state).toBe(CampaignState.Active);
  });

  it('should verify no transactions are created when validation fails', async () => {
    loggedUser = '1';

    // Ensure the post is not boosted initially
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: null }),
      },
    );

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });

    // Try to cancel boost on a non-boosted post
    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    // Should fail validation
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag remains false (unchanged)
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();
  });

  it('should verify no transactions are created when post does not exist', async () => {
    loggedUser = '1';

    // Get initial transaction count
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });

    // Try to cancel boost on a non-existent post
    const res = await client.mutate(MUTATION, {
      variables: { postId: 'nonexistent' },
    });

    // Should fail with not found error
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '1', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the original post's boosted flag is unchanged
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe(testCampaignId);
  });

  it('should verify no transactions are created when user is not authorized', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    // Get initial transaction count for user 2
    const initialTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '2', referenceType: 'PostBoost' },
      });

    // Try to cancel boost without authorization
    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    // Should fail with not found error
    expect(res.errors).toBeTruthy();

    // Verify no new transactions were created for user 2
    const finalTransactionCount = await con
      .getRepository(UserTransaction)
      .count({
        where: { receiverId: '2', referenceType: 'PostBoost' },
      });
    expect(finalTransactionCount).toBe(initialTransactionCount);

    // Verify the boosted flag remains true (unchanged)
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBe(testCampaignId);
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

    // Mock Skadi API v2 call to succeed and return current budget
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel')
      .reply(200, { budget: '3.25' }); // 3.25 USD = 325 cores

    // Set up initial balance for user '1' in the mock transport
    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-scout',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000, // Initial balance
        },
      ],
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.cancelPostBoost.transactionId).toBeDefined();
    expect(res.data.cancelPostBoost.referenceId).toBe(testCampaignId);
    expect(res.data.cancelPostBoost.balance.amount).toBe(10325); // 10000 + 325 refund

    // Verify the boosted flag is now false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();

    // Verify campaign state is now cancelled
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: testCampaignId });
    expect(campaign?.state).toBe(CampaignState.Cancelled);
  });

  it('should handle decimal USD amounts correctly', async () => {
    loggedUser = '1';

    // Mock Skadi API v2 call to succeed and return decimal USD amount
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel')
      .reply(200, { budget: '7.875' }); // 7.875 USD = 787.5 cores

    // Set up initial balance for user '1' in the mock transport
    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-decimal',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000, // Initial balance
        },
      ],
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.cancelPostBoost.transactionId).toBeDefined();
    expect(res.data.cancelPostBoost.referenceId).toBe(testCampaignId);
    expect(res.data.cancelPostBoost.balance.amount).toBe(10787); // 10000 + 787 refund

    // Verify the boosted flag is now false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();

    // Verify campaign state is now cancelled
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: testCampaignId });
    expect(campaign?.state).toBe(CampaignState.Cancelled);
  });

  it('should handle zero USD refund amount', async () => {
    loggedUser = '1';

    // Mock Skadi API v2 call to succeed and return zero USD amount
    nock(process.env.SKADI_API_ORIGIN_V2)
      .post('/api/campaign/cancel')
      .reply(200, { budget: '0.0' }); // 0 USD = 0 cores

    // Set up initial balance for user '1' in the mock transport
    const testNjordClient = njordCommon.getNjordClient();
    await testNjordClient.transfer({
      idempotencyKey: 'initial-balance-zero',
      transfers: [
        {
          sender: { id: 'system', type: EntityType.SYSTEM },
          receiver: { id: '1', type: EntityType.USER },
          amount: 10000, // Initial balance
        },
      ],
    });

    jest
      .spyOn(njordCommon, 'getNjordClient')
      .mockImplementation(() => testNjordClient);

    const res = await client.mutate(MUTATION, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.cancelPostBoost.transactionId).toBeDefined();
    expect(res.data.cancelPostBoost.referenceId).toBe(testCampaignId);
    expect(res.data.cancelPostBoost.balance.amount).toBe(10000); // 10000 + 0 refund = 10000

    // Verify the boosted flag is now false
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags?.campaignId).toBeFalsy();

    // Verify campaign state is now cancelled
    const campaign = await con
      .getRepository(Campaign)
      .findOneBy({ id: testCampaignId });
    expect(campaign?.state).toBe(CampaignState.Cancelled);
  });
});

describe('query boostEstimatedReach', () => {
  const QUERY = `
    query BoostEstimatedReach($postId: ID!) {
      boostEstimatedReach(postId: $postId) {
        min
        max
      }
    }
  `;

  const params = { postId: 'p1' };

  beforeEach(async () => {
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if post does not exist', async () => {
    loggedUser = '1';

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { ...params, postId: 'nonexistent' } },
      'NOT_FOUND',
    );
  });

  it('should return an error if user is not the author or scout of the post', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: params },
      'NOT_FOUND',
    );
  });

  it('should return an error if post is already boosted', async () => {
    loggedUser = '1';
    // Set the post as already boosted
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: 'mock-id' }),
      },
    );

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: params },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return the estimated reach and make correct HTTP call', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 123,
      clicks: 7,
      users: 47,
    });

    const res = await client.query(QUERY, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReach).toEqual({
      max: 50, // 47 + Math.floor(47 * 0.08) = 47 + 3 = 50
      min: 44, // 47 - Math.floor(47 * 0.08) = 47 - 3 = 44
    });

    // Verify the HTTP call was made correctly without budget/duration
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          // No duration or budget parameters
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle large numbers and ensure integer values', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 1234567,
      clicks: 54321,
      users: 234567,
    });

    const res = await client.query(QUERY, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReach).toEqual({
      max: 253332, // 234567 + Math.floor(234567 * 0.08) = 234567 + 18765 = 253332
      min: 215802, // 234567 - Math.floor(234567 * 0.08) = 234567 - 18765 = 215802
    });

    // Verify that both min and max are integers (not floats)
    expect(Number.isInteger(res.data.boostEstimatedReach.min)).toBe(true);
    expect(Number.isInteger(res.data.boostEstimatedReach.max)).toBe(true);

    // Verify the HTTP call was made correctly
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle large numbers and ensure integer values', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 1234567,
      clicks: 54321,
      users: 234567,
    });

    const res = await client.query(QUERY, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReach).toEqual({
      max: 253332, // 234567 + Math.floor(234567 * 0.08) = 234567 + 18765 = 253332
      min: 215802, // 234567 - Math.floor(234567 * 0.08) = 234567 - 18765 = 215802
    });

    // Verify that both min and max are integers (not floats)
    expect(Number.isInteger(res.data.boostEstimatedReach.min)).toBe(true);
    expect(Number.isInteger(res.data.boostEstimatedReach.max)).toBe(true);

    // Verify the HTTP call was made correctly
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle edge case with very small users count', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 89,
      clicks: 3,
      users: 7,
    });

    const res = await client.query(QUERY, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReach).toEqual({
      max: 7, // 7 + Math.floor(7 * 0.08) = 7 + 0 = 7
      min: 7, // 7 - Math.floor(7 * 0.08) = 7 - 0 = 7
    });

    // Verify that both min and max are integers (not floats)
    expect(Number.isInteger(res.data.boostEstimatedReach.min)).toBe(true);
    expect(Number.isInteger(res.data.boostEstimatedReach.max)).toBe(true);

    // Verify the HTTP call was made correctly
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle zero users count', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 0,
      clicks: 0,
      users: 0,
    });

    const res = await client.query(QUERY, {
      variables: params,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReach).toEqual({
      max: 0, // 0 + Math.floor(0 * 0.08) = 0 + 0 = 0
      min: 0, // Math.max(0 - Math.floor(0 * 0.08), 0) = Math.max(0 - 0, 0) = 0
    });

    // Verify that both min and max are integers (not floats)
    expect(Number.isInteger(res.data.boostEstimatedReach.min)).toBe(true);
    expect(Number.isInteger(res.data.boostEstimatedReach.max)).toBe(true);

    // Verify the HTTP call was made correctly
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
        }),
        agent: expect.any(Function),
      },
    );
  });
});

describe('query boostEstimatedReachDaily', () => {
  const QUERY = `
    query BoostEstimatedReachDaily($postId: ID!, $budget: Int!, $duration: Int!) {
      boostEstimatedReachDaily(postId: $postId, budget: $budget, duration: $duration) {
        min
        max
      }
    }
  `;

  const params = { postId: 'p1' };

  beforeEach(async () => {
    await con.getRepository(Post).update({ id: 'p1' }, { authorId: '1' });
  });

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { ...params, budget: 5000, duration: 7 } },
      'UNAUTHENTICATED',
    ));

  it('should return an error if post does not exist', async () => {
    loggedUser = '1';

    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { postId: 'nonexistent', budget: 5000, duration: 7 },
      },
      'NOT_FOUND',
    );
  });

  it('should return an error if user is not the author or scout of the post', async () => {
    loggedUser = '2'; // User 2 is not the author or scout of post p1

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { ...params, budget: 5000, duration: 7 } },
      'NOT_FOUND',
    );
  });

  it('should return an error if post is already boosted', async () => {
    loggedUser = '1';
    // Set the post as already boosted
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({ campaignId: 'mock-id' }),
      },
    );

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { ...params, budget: 5000, duration: 7 } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  describe('budget validation', () => {
    beforeEach(() => {
      loggedUser = '1';
    });

    it('should return an error if budget is less than 1000', async () => {
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { ...params, budget: 999, duration: 7 } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should return an error if budget is greater than 100000', async () => {
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { ...params, budget: 100001, duration: 7 } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should return an error if budget is not divisible by 1000', async () => {
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { ...params, budget: 1500, duration: 7 } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should accept valid budget values and make correct HTTP call', async () => {
      // Mock the HTTP response
      const mockFetchParse = fetchParse as jest.Mock;
      mockFetchParse.mockResolvedValue({
        impressions: 100,
        clicks: 5,
        users: 50,
        min_impressions: 45,
        max_impressions: 55,
      });

      const res = await client.query(QUERY, {
        variables: { ...params, budget: 2000, duration: 5 }, // Valid budget
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.boostEstimatedReachDaily).toEqual({
        min: 45,
        max: 55,
      });

      // Verify the HTTP call was made with correct budget conversion
      expect(mockFetchParse).toHaveBeenCalledWith(
        `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: 'p1',
            user_id: '1',
            duration: 5 * ONE_DAY_IN_SECONDS,
            budget: 20, // 2000 cores = 20 USD
          }),
          agent: expect.any(Function),
        },
      );
    });
  });

  describe('duration validation', () => {
    beforeEach(() => {
      loggedUser = '1';
    });

    it('should return an error if duration is less than 1', async () => {
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { ...params, budget: 5000, duration: 0 } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should return an error if duration is greater than 30', async () => {
      return testQueryErrorCode(
        client,
        { query: QUERY, variables: { ...params, budget: 5000, duration: 31 } },
        'GRAPHQL_VALIDATION_FAILED',
      );
    });

    it('should accept valid duration values and make correct HTTP call', async () => {
      // Mock the HTTP response
      const mockFetchParse = fetchParse as jest.Mock;
      mockFetchParse.mockResolvedValue({
        impressions: 200,
        clicks: 10,
        users: 75,
        min_impressions: 68,
        max_impressions: 82,
      });

      const res = await client.query(QUERY, {
        variables: { ...params, budget: 3000, duration: 15 }, // Valid duration
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.boostEstimatedReachDaily).toEqual({
        min: 68,
        max: 82,
      });

      // Verify the HTTP call includes both parameters correctly
      expect(mockFetchParse).toHaveBeenCalledWith(
        `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post_id: 'p1',
            user_id: '1',
            duration: 15 * ONE_DAY_IN_SECONDS, // Duration converted to seconds
            budget: 30, // 3000 cores = 30 USD
          }),
          agent: expect.any(Function),
        },
      );
    });
  });

  it('should return estimated reach with budget and duration parameters', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 500,
      clicks: 40,
      users: 180,
      min_impressions: 166,
      max_impressions: 194,
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 10000, duration: 14 }, // 10000 cores = 100 USD, 14 days
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 166,
      max: 194,
    });

    // Verify the HTTP call was made correctly with both parameters
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 14 * ONE_DAY_IN_SECONDS, // Duration converted to seconds
          budget: 100, // Converted from cores to USD (10000 cores = 100 USD)
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle minimum budget value (1000 cores)', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 50,
      clicks: 3,
      users: 25,
      min_impressions: 23,
      max_impressions: 27,
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 1000, duration: 5 }, // 1000 cores = 10 USD
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 23,
      max: 27,
    });

    // Verify the HTTP call was made with minimum budget
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 5 * ONE_DAY_IN_SECONDS,
          budget: 10, // Converted from cores to USD (1000 cores = 10 USD)
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle maximum budget value (100000 cores)', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 50000,
      clicks: 2500,
      users: 15000,
      min_impressions: 13800,
      max_impressions: 16200,
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 100000, duration: 5 }, // 100000 cores = 1000 USD
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 13800,
      max: 16200,
    });

    // Verify the HTTP call was made with maximum budget
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 5 * ONE_DAY_IN_SECONDS,
          budget: 1000, // Converted from cores to USD (100000 cores = 1000 USD)
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle minimum duration value (1 day)', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 80,
      clicks: 5,
      users: 35,
      min_impressions: 33,
      max_impressions: 37,
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 2000, duration: 1 }, // 1 day
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 33,
      max: 37,
    });

    // Verify the HTTP call was made with minimum duration
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 1 * ONE_DAY_IN_SECONDS, // 1 day in seconds
          budget: 20, // 2000 cores = 20 USD
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should handle maximum duration value (30 days)', async () => {
    loggedUser = '1';

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 1200,
      clicks: 60,
      users: 450,
      min_impressions: 414,
      max_impressions: 486,
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 5000, duration: 30 }, // 30 days
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 414,
      max: 486,
    });

    // Verify the HTTP call was made with maximum duration
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 30 * ONE_DAY_IN_SECONDS, // 30 days in seconds
          budget: 50, // 5000 cores = 50 USD
        }),
        agent: expect.any(Function),
      },
    );
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

    // Mock the HTTP response
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 150,
      clicks: 10,
      users: 65,
      min_impressions: 60,
      max_impressions: 70,
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 3000, duration: 5 }, // 3000 cores = 30 USD, 5 days
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 60,
      max: 70,
    });

    // Verify the HTTP call was made with correct parameters
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 5 * ONE_DAY_IN_SECONDS,
          budget: 30, // Converted from cores to USD (3000 cores = 30 USD)
        }),
        agent: expect.any(Function),
      },
    );
  });

  it('should fall back to getAdjustedReach when min and max impressions are equal', async () => {
    loggedUser = '1';

    // Mock the HTTP response where min and max impressions are the same
    const mockFetchParse = fetchParse as jest.Mock;
    mockFetchParse.mockResolvedValue({
      impressions: 200,
      clicks: 15,
      users: 100,
      min_impressions: 75, // Same value
      max_impressions: 75, // Same value
    });

    const res = await client.query(QUERY, {
      variables: { ...params, budget: 4000, duration: 10 }, // 4000 cores = 40 USD, 10 days
    });

    expect(res.errors).toBeFalsy();
    // When min_impressions === max_impressions, it should use getAdjustedReach(maxImpressions)
    // getAdjustedReach applies ±8% calculation: 75 ± Math.floor(75 * 0.08) = 75 ± 6
    expect(res.data.boostEstimatedReachDaily).toEqual({
      min: 69, // 75 - Math.floor(75 * 0.08) = 75 - 6 = 69
      max: 81, // 75 + Math.floor(75 * 0.08) = 75 + 6 = 81
    });

    // Verify the HTTP call was made with correct parameters
    expect(mockFetchParse).toHaveBeenCalledWith(
      `${process.env.SKADI_API_ORIGIN}/promote/post/reach`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: 'p1',
          user_id: '1',
          duration: 10 * ONE_DAY_IN_SECONDS,
          budget: 40, // Converted from cores to USD (4000 cores = 40 USD)
        }),
        agent: expect.any(Function),
      },
    );
  });
});
