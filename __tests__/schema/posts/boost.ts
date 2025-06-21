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
  SharePost,
  FreeformPost,
  WelcomePost,
  CollectionPost,
  PostType,
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
import { skadiBoostClient } from '../../../src/integrations/skadi/clients';
import { pickImageUrl } from '../../../src/common/post';

jest.mock('../../../src/common/pubsub', () => ({
  ...(jest.requireActual('../../../src/common/pubsub') as Record<
    string,
    unknown
  >),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

// Mock the skadiBoostClient
jest.mock('../../../src/integrations/skadi/clients', () => ({
  skadiBoostClient: {
    getCampaignById: jest.fn(),
    estimatePostBoostReach: jest.fn(),
    startPostCampaign: jest.fn(),
    cancelPostCampaign: jest.fn(),
    getCampaigns: jest.fn(),
    getAd: jest.fn(),
  },
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

  const params = { id: 'mock-campaign-id' };

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

    // Mock the skadi client to return the share post campaign
    (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
      campaignId: 'mock-campaign-id',
      postId: 'p1',
      status: 'active',
      budget: 1000,
      currentBudget: 500,
      startedAt: new Date(),
      endedAt: null,
      impressions: 50,
      clicks: 10,
    });

    const res = await client.query(QUERY, { variables: params });

    expect(res.errors).toBeFalsy();
    expect(res.data.postCampaignById).toEqual({
      campaign: {
        budget: 100000,
        campaignId: 'mock-campaign-id',
        clicks: 10,
        currentBudget: 50000,
        impressions: 50,
        postId: 'p1',
        status: 'active',
      },
      post: {
        id: 'p1',
        image: 'https://daily.dev/image.jpg',
        title: 'P1',
        shortId: 'sp1',
        permalink: 'http://localhost:4000/r/sp1',
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
        await con.getRepository(ArticlePost).save({
          id: 'shared-post-1',
          shortId: 'shared1',
          title: 'Shared Post Title',
          image: 'https://shared-post-image.jpg',
          url: 'http://shared-post.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
        });

        // Create a share post that references the shared post
        await con.getRepository(SharePost).save({
          id: 'share-post-1',
          shortId: 'share1',
          title: null, // No title on share post
          sharedPostId: 'shared-post-1',
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the share post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'share-campaign-id',
          postId: 'share-post-1',
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'share-campaign-id' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: 'share-post-1',
          image: 'https://shared-post-image.jpg', // From shared post
          title: 'Shared Post Title', // From shared post
          shortId: 'share1',
          permalink: 'http://localhost:4000/r/share1',
        });
      });

      it('should use share post title when available, fallback to shared post title', async () => {
        // Create a shared post
        await con.getRepository(ArticlePost).save({
          id: 'shared-post-2',
          shortId: 'shared2',
          title: 'Original Shared Post Title',
          image: 'https://shared-post-2-image.jpg',
          url: 'http://shared-post-2.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
        });

        // Create a share post with its own title
        await con.getRepository(SharePost).save({
          id: 'share-post-2',
          shortId: 'share2',
          title: 'Share Post Custom Title', // Has its own title
          sharedPostId: 'shared-post-2',
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the share post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'share-campaign-id-2',
          postId: 'share-post-2',
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'share-campaign-id-2' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: 'share-post-2',
          image: 'https://shared-post-2-image.jpg', // From shared post
          title: 'Share Post Custom Title', // From share post (not shared post)
          shortId: 'share2',
          permalink: 'http://localhost:4000/r/share2',
        });
      });

      it('should handle share post with empty title string', async () => {
        // Create a shared post
        await con.getRepository(ArticlePost).save({
          id: 'shared-post-3',
          shortId: 'shared3',
          title: 'Shared Post Title for Empty',
          image: 'https://shared-post-3-image.jpg',
          url: 'http://shared-post-3.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
        });

        // Create a share post with empty title
        await con.getRepository(SharePost).save({
          id: 'share-post-3',
          shortId: 'share3',
          title: '', // Empty string title
          sharedPostId: 'shared-post-3',
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the share post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'share-campaign-id-3',
          postId: 'share-post-3',
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'share-campaign-id-3' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: 'share-post-3',
          image: 'https://shared-post-3-image.jpg', // From shared post
          title: 'Shared Post Title for Empty', // From shared post (empty string is falsy)
          shortId: 'share3',
          permalink: 'http://localhost:4000/r/share3',
        });
      });
    });

    describe('Freeform posts', () => {
      it('should use freeform post image directly', async () => {
        // Create a freeform post
        const freeformPost = await con.getRepository(FreeformPost).save({
          id: 'freeform-post-1',
          shortId: 'freeform1',
          title: 'Freeform Post Title',
          image: 'https://freeform-post-image.jpg',
          content: 'Freeform post content',
          sourceId: 'a',
          type: PostType.Freeform,
          createdAt: new Date(),
          authorId: '1',
        } as unknown as Partial<FreeformPost>);

        // Mock the skadi client to return the freeform post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'freeform-campaign-id',
          postId: freeformPost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'freeform-campaign-id' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: freeformPost.id,
          image: 'https://freeform-post-image.jpg', // Direct from freeform post
          title: 'Freeform Post Title',
          shortId: 'freeform1',
          permalink: 'http://localhost:4000/r/freeform1',
        });
      });

      it('should handle freeform post with no image', async () => {
        // Create a freeform post without image
        const createdAt = new Date();
        const freeformPost = await con.getRepository(FreeformPost).save({
          id: 'freeform-post-2',
          shortId: 'freeform2',
          title: 'Freeform Post No Image',
          image: null, // No image
          content: 'Freeform post content',
          sourceId: 'a',
          type: PostType.Freeform,
          createdAt,
          authorId: '1',
        } as unknown as Partial<FreeformPost>);

        // Mock the skadi client to return the freeform post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'freeform-campaign-id-2',
          postId: freeformPost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'freeform-campaign-id-2' },
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
        const articlePost = await con.getRepository(ArticlePost).save({
          id: 'article-post-1',
          shortId: 'article1',
          title: 'Article Post Title',
          image: 'https://article-post-image.jpg',
          url: 'http://article-post.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the article post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'article-campaign-id',
          postId: articlePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'article-campaign-id' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: articlePost.id,
          image: 'https://article-post-image.jpg', // Direct from article post
          title: 'Article Post Title',
          shortId: 'article1',
          permalink: 'http://localhost:4000/r/article1',
        });
      });

      it('should handle article post with no image', async () => {
        // Create an article post without image
        const createdAt = new Date();
        const articlePost = await con.getRepository(ArticlePost).save({
          id: 'article-post-2',
          shortId: 'article2',
          title: 'Article Post No Image',
          image: null, // No image
          url: 'http://article-post-2.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt,
          authorId: '1',
        });

        // Mock the skadi client to return the article post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'article-campaign-id-2',
          postId: articlePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'article-campaign-id-2' },
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
        const welcomePost = await con.getRepository(WelcomePost).save({
          id: 'welcome-post-1',
          shortId: 'welcome1',
          title: 'Welcome Post Title',
          image: 'https://welcome-post-image.jpg',
          content: 'Welcome post content',
          sourceId: 'a',
          type: PostType.Welcome,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the welcome post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'welcome-campaign-id',
          postId: welcomePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'welcome-campaign-id' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: welcomePost.id,
          image: 'https://welcome-post-image.jpg', // Direct from welcome post
          title: 'Welcome Post Title',
          shortId: 'welcome1',
          permalink: 'http://localhost:4000/r/welcome1',
        });
      });
    });

    describe('Collection posts', () => {
      it('should use collection post image directly', async () => {
        // Create a collection post
        const collectionPost = await con.getRepository(CollectionPost).save({
          id: 'collection-post-1',
          shortId: 'collect1',
          title: 'Collection Post Title',
          image: 'https://collection-post-image.jpg',
          content: 'Collection post content',
          sourceId: 'a',
          type: PostType.Collection,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the collection post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'collection-campaign-id',
          postId: collectionPost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'collection-campaign-id' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: collectionPost.id,
          image: 'https://collection-post-image.jpg', // Direct from collection post
          title: 'Collection Post Title',
          shortId: 'collect1',
          permalink: 'http://localhost:4000/r/collect1',
        });
      });
    });

    describe('YouTube video posts', () => {
      it('should use YouTube post image directly', async () => {
        // Create a YouTube post
        const youtubePost = await con.getRepository(YouTubePost).save({
          id: 'youtube-post-1',
          shortId: 'youtube1',
          title: 'YouTube Post Title',
          image: 'https://youtube-post-image.jpg',
          url: 'https://youtu.be/example',
          videoId: 'example',
          sourceId: 'a',
          type: PostType.VideoYouTube,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the YouTube post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'youtube-campaign-id',
          postId: youtubePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'youtube-campaign-id' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: youtubePost.id,
          image: 'https://youtube-post-image.jpg', // Direct from YouTube post
          title: 'YouTube Post Title',
          shortId: 'youtube1',
          permalink: 'http://localhost:4000/r/youtube1',
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle share post with shared post that has no image', async () => {
        // Create a shared post with no image
        const createdAt = new Date();
        await con.getRepository(ArticlePost).save({
          id: 'shared-post-no-image',
          shortId: 'sharednoimg',
          title: 'Shared Post No Image',
          image: null, // No image
          url: 'http://shared-post-no-image.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt,
        });

        // Create a share post that references the shared post
        const sharePost = await con.getRepository(SharePost).save({
          id: 'share-post-no-image',
          shortId: 'sharenoimg',
          title: 'Share Post with Shared Post No Image',
          sharedPostId: 'shared-post-no-image',
          sourceId: 'a',
          type: PostType.Share,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the share post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'share-campaign-no-image',
          postId: sharePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'share-campaign-no-image' },
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
        const nullTitlePost = await con.getRepository(ArticlePost).save({
          id: 'null-title-post',
          shortId: 'nulltitle',
          title: null, // Null title
          image: 'https://null-title-image.jpg',
          url: 'http://null-title.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'null-title-campaign',
          postId: nullTitlePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'null-title-campaign' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: nullTitlePost.id,
          image: 'https://null-title-image.jpg',
          title: null, // Preserves null title
          shortId: 'nulltitle',
          permalink: 'http://localhost:4000/r/nulltitle',
        });
      });

      it('should handle post with undefined title', async () => {
        // Create a post with undefined title
        const undefinedTitlePost = await con.getRepository(ArticlePost).save({
          id: 'undefined-title-post',
          shortId: 'undeftitle',
          title: undefined, // Undefined title
          image: 'https://undefined-title-image.jpg',
          url: 'http://undefined-title.com',
          sourceId: 'a',
          type: PostType.Article,
          createdAt: new Date(),
          authorId: '1',
        });

        // Mock the skadi client to return the post campaign
        (skadiBoostClient.getCampaignById as jest.Mock).mockResolvedValue({
          campaignId: 'undefined-title-campaign',
          postId: undefinedTitlePost.id,
          status: 'active',
          budget: 1000,
          currentBudget: 500,
          startedAt: new Date(),
          endedAt: null,
          impressions: 50,
          clicks: 10,
        });

        const res = await client.query(QUERY, {
          variables: { id: 'undefined-title-campaign' },
        });

        expect(res.errors).toBeFalsy();
        expect(res.data.postCampaignById.post).toEqual({
          id: undefinedTitlePost.id,
          image: 'https://undefined-title-image.jpg',
          title: null, // Preserves undefined title
          shortId: 'undeftitle',
          permalink: 'http://localhost:4000/r/undeftitle',
        });
      });
    });
  });
});
