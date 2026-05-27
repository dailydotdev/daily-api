import {
  createMockNjordTransport,
  disposeGraphQLTesting,
  expectTypedEvent,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  ArticlePost,
  Feed,
  Post,
  PostRelation,
  PostRelationType,
  PostTag,
  PostType,
  Settings,
  SharePost,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  User,
  UserPost,
  YouTubePost,
} from '../src/entity';

import { Roles, SourceMemberRoles, sourceRoleRank } from '../src/roles';
import { sourcesFixture } from './fixture/source';
import {
  createPostCodeSnippetsFixture,
  postsFixture,
  postTagsFixture,
  relatedPostsFixture,
  videoPostsFixture,
} from './fixture/post';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { triggerTypedEvent, updateFlagsStatement } from '../src/common';
import { randomUUID } from 'crypto';
import { deleteKeysByPattern, deleteRedisKey, ioRedisPool } from '../src/redis';
import { checkHasMention } from '../src/common/markdown';
import { UserVote, UserVoteEntity } from '../src/types';
import { rateLimiterName } from '../src/directive/rateLimit';
import { badUsersFixture, usersFixture } from './fixture/user';
import { PostCodeSnippet } from '../src/entity/posts/PostCodeSnippet';
import {
  PostModerationReason,
  SourcePostModeration,
  SourcePostModerationStatus,
} from '../src/entity/SourcePostModeration';
import { generateUUID } from '../src/ids';
import { GQLResponse } from 'mercurius-integration-testing';
import type { GQLPostSmartTitle } from '../src/schema/posts';
import { TransferError } from '../src/errors';
import {
  Credits,
  TransferResult,
  TransferStatus,
  TransferType,
  UserBriefingRequest,
} from '@dailydotdev/schema';
import { SubscriptionCycles } from '../src/paddle';

import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../src/entity/user/UserTransaction';
import { Product, ProductType } from '../src/entity/Product';
import { BriefingModel, BriefingType } from '../src/integrations/feed';
import { addDays, format, subDays } from 'date-fns';
import { PostAnalytics } from '../src/entity/posts/PostAnalytics';
import { PostAnalyticsHistory } from '../src/entity/posts/PostAnalyticsHistory';
import * as njordCommon from '../src/common/njord';
import { BriefPost } from '../src/entity/posts/BriefPost';
import { createClient } from '@connectrpc/connect';
import isSameDay from 'date-fns/isSameDay';
import { PollPost } from '../src/entity/posts/PollPost';
import { PollOption } from '../src/entity/polls/PollOption';

jest.mock('../src/common/pubsub', () => ({
  ...(jest.requireActual('../src/common/pubsub') as Record<string, unknown>),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

jest.mock('../src/common/typedPubsub', () => ({
  ...(jest.requireActual('../src/common/typedPubsub') as Record<
    string,
    unknown
  >),
  triggerTypedEvent: jest.fn(),
}));

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string | null = null;
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
  loggedUser = null;
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

const saveSquadFixtures = async () => {
  await con
    .getRepository(Source)
    .update({ id: 'a' }, { type: SourceType.Squad });
  await con
    .getRepository(Post)
    .update(
      { id: 'p1' },
      { type: PostType.Welcome, title: 'Welcome post', authorId: '1' },
    );
  await con.getRepository(SourceMember).save([
    {
      userId: '1',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
    },
    {
      userId: '2',
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
    },
  ]);
  await con.getRepository(SourceMember).save(
    badUsersFixture.map((user) => ({
      userId: user.id,
      sourceId: 'a',
      role: SourceMemberRoles.Member,
      referralToken: randomUUID(),
    })),
  );
};

afterAll(() => disposeGraphQLTesting(state));

describe('util checkHasMention', () => {
  it('should return true if mention was found', () => {
    expect(checkHasMention('sample title @lee abc', 'lee')).toBeTruthy();
  });

  it('should return false if mention was not found', () => {
    expect(checkHasMention('sample title lee abc', 'lee')).toBeFalsy();
  });
});

describe('downvoted field', () => {
  const QUERY = `{
    post(id: "p1") {
      downvoted
    }
  }`;

  it('should return null when user is not logged in', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.downvoted).toEqual(null);
  });

  it('should return false when user did not downvoted the post', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.data.post.downvoted).toEqual(false);
  });

  it('should return true when user did downvoted the post', async () => {
    loggedUser = '1';
    const repo = con.getRepository(UserPost);
    await repo.save(
      repo.create({
        postId: 'p1',
        userId: loggedUser,
        vote: UserVote.Down,
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data.post.downvoted).toEqual(true);
  });
});

describe('posts flags field', () => {
  const QUERY = `{
    post(id: "p1") {
      flags {
        private
        promoteToPublic
      }
    }
  }`;

  it('should return all the public flags for anonymous user', async () => {
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement({ private: true, promoteToPublic: 123 }),
      },
    );
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.post.flags).toEqual({
      private: true,
      promoteToPublic: null,
    });
  });

  it('should return all flags to logged user', async () => {
    loggedUser = '1';
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement({ private: true, promoteToPublic: 123 }),
      },
    );
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.post.flags).toEqual({
      private: true,
      promoteToPublic: null,
    });
  });

  it('should return all flags to system moderator', async () => {
    roles = [Roles.Moderator];
    loggedUser = '1';
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement({ private: true, promoteToPublic: 123 }),
      },
    );
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.post.flags).toEqual({
      private: true,
      promoteToPublic: 123,
    });
  });

  it('should return null values for unset flags', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.flags).toEqual({
      private: null,
      promoteToPublic: null,
    });
  });

  it('should contain all default values in db query', async () => {
    const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });
    expect(post.flags).toEqual({
      sentAnalyticsReport: true,
      visible: true,
      showOnFeed: true,
    });
  });
});

describe('userState field', () => {
  const QUERY = `{
    post(id: "p1") {
      userState {
        vote
        hidden
        flags {
          feedbackDismiss
        }
        awarded
      }
    }
  }`;

  it('should return null if anonymous user', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.userState).toBeNull();
  });

  it('should return default state if state does not exist', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    const { vote, hidden, flags } = con.getRepository(UserPost).create();
    expect(res.data.post.userState).toMatchObject({
      vote,
      hidden,
      flags,
      awarded: false,
    });
  });

  it('should return user state', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
      hidden: true,
      flags: { feedbackDismiss: false },
    });
    const res = await client.query(QUERY);
    expect(res.data.post.userState).toMatchObject({
      vote: UserVote.Up,
      hidden: true,
      flags: { feedbackDismiss: false },
      awarded: false,
    });
  });

  it('should return awarded state', async () => {
    loggedUser = '1';

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      status: UserTransactionStatus.Success,
      productId: null,
      senderId: '1',
      fee: 0,
      value: 100,
      valueIncFees: 100,
    });

    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
      hidden: true,
      flags: { feedbackDismiss: false },
      awardTransactionId: transaction.id,
    });
    const res = await client.query(QUERY);
    expect(res.data.post.userState).toMatchObject({
      vote: UserVote.Up,
      hidden: true,
      flags: { feedbackDismiss: false },
      awarded: true,
    });
  });
});

describe('mutation vote post', () => {
  const MUTATION = `
    mutation Vote($id: ID!, $vote: Int!, $entity: UserVoteEntity!) {
      vote(id: $id, vote: $vote, entity: $entity) {
        _
      }
    }`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: 'p1',
          vote: UserVote.Up,
          entity: UserVoteEntity.Post,
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: 'invalid',
          vote: UserVote.Up,
          entity: UserVoteEntity.Post,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw not found when cannot find user', () => {
    loggedUser = '9';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
      },
      'NOT_FOUND',
    );
  });

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
      },
      'FORBIDDEN',
    );
  });

  it('should throw when invalid vote option', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', vote: 3, entity: UserVoteEntity.Post },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  const testUpvote = async () => {
    await con.getRepository(Post).save({
      id: 'p1',
      upvotes: 3,
    });
    const beforePost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const userPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(userPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      vote: UserVote.Up,
      hidden: false,
    });
    const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });
    expect(post.upvotes).toEqual(4);
    expect(post.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  };

  it('should upvote', async () => {
    loggedUser = '1';

    await testUpvote();
  });

  it('should upvote and update source flags upvotes count', async () => {
    loggedUser = '1';
    const source = await con.getRepository(Source).findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testUpvote();

    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(4);
  });

  it('should upvote and increment squad total upvotes', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testUpvote();

    const updatedSource = await repo.findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(4);
  });

  const testDownvote = async () => {
    await con.getRepository(Post).save({
      id: 'p1',
      downvotes: 3,
    });
    const beforePost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Down, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const userPost = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(userPost).toMatchObject({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Down,
      hidden: true,
    });
    const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });
    expect(post.downvotes).toEqual(4);
    expect(post.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  };

  it('should downvote', async () => {
    loggedUser = '1';

    await testDownvote();
  });

  it('should downvote and NOT update source flags upvotes count', async () => {
    loggedUser = '1';
    const source = await con.getRepository(Source).findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testDownvote();

    // should not be affected since this is not a squad
    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(undefined);
  });

  it('should downvote and NOT update squads flags upvotes count', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testDownvote();

    // should not be affected since the existing vote was a downvote
    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(undefined);
  });

  const testCancelVote = async (initialVote = UserVote.Up) => {
    const beforePost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });
    await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: initialVote, entity: UserVoteEntity.Post },
    });
    const oldPost = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });
    expect(oldPost.upvotes).toEqual(1);
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.None, entity: UserVoteEntity.Post },
    });
    const userPost = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      vote: UserVote.None,
      hidden: false,
    });
    expect(oldPost.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  };

  it('should cancel vote', async () => {
    loggedUser = '1';
    await testCancelVote();
  });

  it('should cancel vote and update source flags upvotes count', async () => {
    loggedUser = '1';
    const source = await con.getRepository(Source).findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testCancelVote();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(0);

    // should not be affected since this is not a squad
    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(0);
  });

  it('should cancel vote and decrement squads flags upvotes count if previous vote was upvote', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testCancelVote();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(0);

    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(0);
  });

  it('should cancel vote and NOT update squads flags upvotes count if previous state was downvote', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    loggedUser = '2';

    await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
    });

    loggedUser = '1';

    await testCancelVote(UserVote.Down);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    // expected is 1 since originally we upvoted with a different user
    expect(post?.upvotes).toEqual(1);

    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(1);
  });

  it('should not set votedAt when vote is not set on insert', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      hidden: false,
    });
    const userPostBefore = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(userPostBefore?.votedAt).toBeNull();
  });

  it('should set votedAt when user votes for the first time', async () => {
    loggedUser = '1';
    const userPostBefore = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(userPostBefore).toBeNull();
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Down, entity: UserVoteEntity.Post },
    });
    const userPost = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userPost?.votedAt).not.toBeNull();
  });

  it('should update votedAt when vote value changes', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
      hidden: false,
    });
    const userPostBefore = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Down, entity: UserVoteEntity.Post },
    });
    const userPost = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userPostBefore?.votedAt?.toISOString()).not.toBe(
      userPost?.votedAt?.toISOString(),
    );
  });

  it('should not update votedAt when vote value stays the same', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
      hidden: false,
    });
    const userPostBefore = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
    });
    const userPost = await con.getRepository(UserPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userPostBefore?.votedAt?.toISOString()).toBe(
      userPost?.votedAt?.toISOString(),
    );
  });

  it('should increment post upvotes when user upvotes', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save({
      id: 'p1',
      upvotes: 3,
    });
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.None,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(4);
    expect(post?.downvotes).toEqual(0);
  });

  it('should increment post downvotes when user downvotes', async () => {
    loggedUser = '1';
    await con.getRepository(Post).save({
      id: 'p1',
      downvotes: 3,
    });
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.None,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Down, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(0);
    expect(post?.downvotes).toEqual(4);
  });

  it('should decrement post upvotes when user cancels upvote', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    await con.getRepository(Post).save({
      id: 'p1',
      upvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.None, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(2);
    expect(post?.downvotes).toEqual(0);
  });

  it('should decrement post downvotes when user cancels downvote', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    await con.getRepository(Post).save({
      id: 'p1',
      downvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.None, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(0);
    expect(post?.downvotes).toEqual(2);
  });

  it('should decrement post upvotes and increment downvotes when user changes vote from up to down', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    await con.getRepository(Post).save({
      id: 'p1',
      upvotes: 3,
      downvotes: 2,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Down, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(2);
    expect(post?.downvotes).toEqual(3);
  });

  it('should increment post upvotes and decrement downvotes when user changes vote from down to up', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    await con.getRepository(Post).save({
      id: 'p1',
      upvotes: 2,
      downvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: UserVote.Up, entity: UserVoteEntity.Post },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(3);
    expect(post?.downvotes).toEqual(2);
  });

  it('should decrement post upvotes when UserPost entity is removed', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    await con.getRepository(Post).save({
      id: 'p1',
      upvotes: 3,
    });
    await con.getRepository(UserPost).delete({
      postId: 'p1',
      userId: loggedUser,
    });
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(2);
    expect(post?.downvotes).toEqual(0);
  });

  it('should decrement post downvotes when UserPost entity is removed', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    await con.getRepository(Post).save({
      id: 'p1',
      downvotes: 3,
    });
    await con.getRepository(UserPost).delete({
      postId: 'p1',
      userId: loggedUser,
    });
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(0);
    expect(post?.downvotes).toEqual(2);
  });
});

describe('mutation dismissPostFeedback', () => {
  const MUTATION = `
    mutation DismissPostFeedback($id: ID!) {
      dismissPostFeedback(id: $id) {
        _
      }
    }`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'invalid' },
      },
      'NOT_FOUND',
    );
  });

  it('should throw not found when cannot find user', () => {
    loggedUser = '9';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'NOT_FOUND',
    );
  });

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'FORBIDDEN',
    );
  });

  it('should dismiss feedback', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const userPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(userPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      vote: UserVote.None,
      flags: { feedbackDismiss: true },
    });
  });

  it('should dismiss feedback when user state exists', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      userId: loggedUser,
      postId: 'p1',
      vote: UserVote.Up,
      flags: { feedbackDismiss: false },
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const userPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(userPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      vote: UserVote.Up,
      flags: { feedbackDismiss: true },
    });
  });
});

describe('query relatedPosts', () => {
  const QUERY = `
  query relatedPosts($id: ID!, $relationType: PostRelationType!, $after: String, $first: Int) {
    relatedPosts(id: $id, relationType: $relationType, after: $after, first: $first) {
      edges {
        node {
          id
          title
        }
      }
    }
  }
  `;

  beforeEach(async () => {
    await con.getRepository(PostRelation).save(relatedPostsFixture);
  });

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: 'p1', relationType: PostRelationType.Collection },
      },
      'FORBIDDEN',
    );
  });

  it('should return related posts', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { id: 'p1', relationType: PostRelationType.Collection },
    });

    expect(res.errors).toBeFalsy();
    expect(res).toMatchObject({
      data: {
        relatedPosts: {
          edges: [
            {
              node: {
                id: 'p2',
                title: 'P2',
              },
            },
            {
              node: {
                id: 'p3',
                title: 'P3',
              },
            },
            {
              node: {
                id: 'p4',
                title: 'P4',
              },
            },
          ],
        },
      },
    });
  });
});

describe('posts summary field', () => {
  const QUERY = /* GraphQL */ `
    {
      post(id: "p1") {
        summary
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(ArticlePost).update(
      { id: 'p1' },
      {
        summary: 'P1 summary',
      },
    );
  });

  it('should return summary', async () => {
    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      summary: 'P1 summary',
    });
  });

  it('should return original summary when language is not set', async () => {
    loggedUser = '1';
    await con.getRepository(ArticlePost).update(
      { id: 'p1' },
      {
        translation: {
          en: {
            summary: 'P1 English',
          },
        },
      },
    );

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      summary: 'P1 summary',
    });
  });

  it('should return original summary if i18n exists but not plus', async () => {
    loggedUser = '1';
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        translation: {
          de: {
            summary: 'P1 german',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'de',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      summary: 'P1 summary',
    });
  });

  it('should return i18n summary if exists', async () => {
    loggedUser = '1';
    isPlus = true;
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        translation: {
          de: {
            summary: 'P1 german',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'de',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      summary: 'P1 german',
    });
  });

  it('should return default summary if i18n summary does not exist', async () => {
    loggedUser = '1';
    isPlus = true;
    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'fr',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      summary: 'P1 summary',
    });
  });

  it('should return i18n summary for cased language codes', async () => {
    loggedUser = '1';
    isPlus = true;
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        translation: {
          'pt-BR': {
            summary: 'P1 Portugal Brazil',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'pt-BR',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      summary: 'P1 Portugal Brazil',
    });
  });
});

describe('posts title field', () => {
  const QUERY = /* GraphQL */ `
    {
      post(id: "p1") {
        title
      }
    }
  `;

  it('should return title', async () => {
    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      title: 'P1',
    });
  });

  it('should return original title when language is not set', async () => {
    loggedUser = '1';
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        translation: {
          en: {
            title: 'P1 English',
          },
        },
      },
    );

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      title: 'P1',
    });
  });

  it('should return i18n title if exists', async () => {
    loggedUser = '1';
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        translation: {
          de: {
            title: 'P1 german',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'de',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      title: 'P1 german',
    });
  });

  it('should return default title if i18n title does not exist', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'fr',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      title: 'P1',
    });
  });

  it('should return i18n title for cased language codes', async () => {
    loggedUser = '1';
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        translation: {
          'pt-BR': {
            title: 'P1 Portugal Brazil',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      headers: {
        'content-language': 'pt-BR',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      title: 'P1 Portugal Brazil',
    });
  });

  describe('new translation field', () => {
    const QUERY_NTF = /* GraphQL */ `
      {
        post(id: "p1-ntf") {
          title
        }
      }
    `;

    beforeEach(async () => {
      await saveFixtures(con, ArticlePost, [
        {
          id: 'p1-ntf',
          shortId: 'sp1-ntf',
          title: 'P1-ntf',
          url: 'http://p1-ntf.com',
          canonicalUrl: 'http://p1-ntfc.com',
          image: 'https://daily.dev/image.jpg',
          score: 1,
          sourceId: 'a',
          tagsStr: 'javascript,webdev',
          type: PostType.Article,
          contentCuration: ['c1', 'c2'],
        },
      ]);
    });

    it('should return i18n title from new translation field when user is team member', async () => {
      loggedUser = '1';
      isTeamMember = true;
      await con.getRepository(Post).update(
        { id: 'p1-ntf' },
        {
          translation: {
            'pt-BR': {
              title: 'P1 Portugal Brazil',
            },
          },
        },
      );

      const res = await client.query(QUERY_NTF, {
        headers: {
          'content-language': 'pt-BR',
        },
      });

      expect(res.errors).toBeFalsy();

      expect(res.data.post).toEqual({
        title: 'P1 Portugal Brazil',
      });
    });

    it('should return original title from new translation field when user is team member', async () => {
      loggedUser = '1';
      isTeamMember = true;
      await con.getRepository(Post).update(
        { id: 'p1-ntf' },
        {
          translation: {
            'pt-BR': {
              title: 'P1 Portugal Brazil',
            },
          },
        },
      );

      const res = await client.query(QUERY_NTF, {
        headers: {
          'content-language': 'pt-BR',
        },
      });

      expect(res.errors).toBeFalsy();

      expect(res.data.post).toEqual({
        title: 'P1 Portugal Brazil',
      });
    });
  });

  describe('clickbait shield title', () => {
    beforeEach(async () => {
      await con.getRepository(Settings).save({
        userId: '1',
        flags: {
          clickbaitShieldEnabled: false,
        },
      });
    });

    it('should return original title if free user but post has smart title', async () => {
      loggedUser = '1';
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: { translations: { en: 'Clickbait title' } },
          },
        },
      );

      const res = await client.query(QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'P1',
      });
    });

    it('should return smart title if user has enabled clickbait shield', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: { translations: { en: 'Clickbait title' } },
          },
        },
      );

      const res = await client.query(QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'Clickbait title',
      });
    });

    it('should return original title if user has enabled clickbait shield but post is not clickbait', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 0 },
          contentMeta: {
            alt_title: { translations: { en: 'Clickbait title' } },
          },
        },
      );

      const res = await client.query(QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'P1',
      });
    });

    it('should return original title if user has disabled clickbait shield', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: false,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: { translations: { en: 'Clickbait title' } },
          },
        },
      );

      const res = await client.query(QUERY);
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'P1',
      });
    });

    it('should return i18n smart title', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: {
              translations: { en: 'Clickbait title', de: 'Clickbait title DE' },
            },
          },
        },
      );

      const res = await client.query(QUERY, {
        headers: {
          'content-language': 'de',
        },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'Clickbait title DE',
      });
    });

    it('should return english smart title when i18n smart title does not exist', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: {
              translations: { en: 'Clickbait title EN' },
            },
          },
        },
      );

      const res = await client.query(QUERY, {
        headers: {
          'content-language': 'de',
        },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'Clickbait title EN',
      });
    });

    it('should return i18n title when smart title does not exist', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          translation: {
            en: {
              title: 'Title EN',
            },
            de: {
              title: 'Title DE',
            },
          },
        },
      );

      const res = await client.query(QUERY, {
        headers: {
          'content-language': 'de',
        },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'Title DE',
      });
    });

    it('should return original title when smart title and i18n title does not exist', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {},
        },
      );

      const res = await client.query(QUERY, {
        headers: {
          'content-language': 'de',
        },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'P1',
      });
    });

    it('should return smart title translation', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: {
              translations: { en: 'Clickbait title', de: 'Clickbait title DE' },
            },
          },
          translation: {
            en: {
              smartTitle: 'Smart Title EN',
            },
            de: {
              smartTitle: 'Smart Title DE',
            },
          },
        },
      );

      const res = await client.query(QUERY, {
        headers: {
          'content-language': 'de',
        },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'Smart Title DE',
      });
    });

    it('should return english smart title translation when smart title translation does not exist', async () => {
      loggedUser = '1';
      isPlus = true;
      await con.getRepository(Settings).update(
        { userId: '1' },
        {
          flags: {
            clickbaitShieldEnabled: true,
          },
        },
      );
      await con.getRepository(Post).update(
        { id: 'p1' },
        {
          contentQuality: { is_clickbait_probability: 1.98 },
          contentMeta: {
            alt_title: {
              translations: { en: 'Clickbait title EN' },
            },
          },
          translation: {
            en: {
              smartTitle: 'Smart Title EN',
            },
          },
        },
      );

      const res = await client.query(QUERY, {
        headers: {
          'content-language': 'de',
        },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.post).toEqual({
        title: 'Smart Title EN',
      });
    });
  });
});

describe('posts titleHtml field', () => {
  const QUERY = /* GraphQL */ `
    query Post($id: ID!) {
      post(id: $id) {
        titleHtml
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, SharePost, [
      {
        id: 'sp1',
        shortId: 'ssp1',
        title: 'sp1',
        titleHtml: '<p>sp1</p>',
        score: 1,
        sourceId: 'a',
        tagsStr: 'javascript,webdev',
        type: PostType.Share,
        sharedPostId: 'p1',
        contentCuration: ['c1', 'c2'],
        authorId: usersFixture[0].id,
      },
    ]);
  });

  it('should return titleHtml', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: {
        id: 'sp1',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      titleHtml: '<p>sp1</p>',
    });
  });

  it('should return original titleHtml when not logged in', async () => {
    await con.getRepository(SharePost).update(
      { id: 'sp1' },
      {
        translation: {
          de: {
            titleHtml: '<p>sp1 DE</p>',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      variables: {
        id: 'sp1',
      },
      headers: {
        'content-language': 'de',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      titleHtml: '<p>sp1</p>',
    });
  });

  it('should return translated titleHtml when it exists', async () => {
    loggedUser = '1';

    await con.getRepository(SharePost).update(
      { id: 'sp1' },
      {
        translation: {
          de: {
            titleHtml: '<p>sp1 DE</p>',
          },
        },
      },
    );

    const res = await client.query(QUERY, {
      variables: {
        id: 'sp1',
      },
      headers: {
        'content-language': 'de',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      titleHtml: '<p>sp1 DE</p>',
    });
  });

  it('should fallback to original titleHtml when translation does not exist', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: {
        id: 'sp1',
      },
      headers: {
        'content-language': 'de',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post).toEqual({
      titleHtml: '<p>sp1</p>',
    });
  });
});

describe('query postCodeSnippets', () => {
  const QUERY = `
  query PostCodeSnippets($id: ID!, $after: String, $first: Int) {
    postCodeSnippets(id: $id, after: $after, first: $first) {
      edges {
        node {
          content
        }
      }
    }
  }
  `;

  beforeEach(async () => {
    await con.getRepository(PostCodeSnippet).save(
      createPostCodeSnippetsFixture({
        postId: 'p1',
      }),
    );
    await con.getRepository(PostCodeSnippet).save(
      createPostCodeSnippetsFixture({
        postId: 'p2',
      }),
    );
  });

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: 'p1' },
      },
      'FORBIDDEN',
    );
  });

  it('should return code snippets', async () => {
    loggedUser = '1';

    const res = await client.query(QUERY, {
      variables: { id: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchObject({
      postCodeSnippets: {
        edges: [
          {
            node: {
              content: 'console.log("Hello World")',
            },
          },
          {
            node: {
              content: 'const a = 1;\n\nconsole.log(a)',
            },
          },
          {
            node: {
              content: 'while (true) {\n    /* remove this */\n}',
            },
          },
        ],
      },
    });
  });
});

describe('Source post moderation approve/reject', () => {
  const [pendingId, pendingId2, rejectedId] = Array.from({ length: 2 }, () =>
    generateUUID(),
  );
  beforeEach(async () => {
    await saveSquadFixtures();
    await con.getRepository(SourcePostModeration).save([
      {
        id: pendingId,
        sourceId: 'm',
        createdById: '4',
        title: 'Title',
        content: 'Content',
        status: SourcePostModerationStatus.Pending,
        type: PostType.Article,
      },
      {
        id: pendingId2,
        sourceId: 'm2',
        createdById: '4',
        title: 'Title',
        content: 'Content',
        status: SourcePostModerationStatus.Pending,
        type: PostType.Article,
      },
      {
        id: rejectedId,
        sourceId: 'm',
        createdById: '4',
        title: 'Title',
        content: 'Content',
        status: SourcePostModerationStatus.Rejected,
        rejectionReason: PostModerationReason.Spam,
        moderatorMessage: 'This is spam',
        type: PostType.Article,
        moderatedById: '3',
      },
    ]);
  });

  const MUTATION = `
  mutation ModerateSourcePost(
    $postIds: [ID]!,
    $status: String,
    $sourceId: ID,
    $rejectionReason: String,
    $moderatorMessage: String
  ) {
    moderateSourcePosts(postIds: $postIds, status: $status, sourceId: $sourceId, rejectionReason: $rejectionReason, moderatorMessage: $moderatorMessage) {
      id
      status
    }
  }`;

  it('should block guest', async () => {
    loggedUser = '0';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId],
          status: SourcePostModerationStatus.Approved,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should not authorize when not source member', async () => {
    loggedUser = '1'; // Not a member
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId],
          status: SourcePostModerationStatus.Approved,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should not authorize when not source moderator', async () => {
    loggedUser = '4'; // Member level
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId],
          status: SourcePostModerationStatus.Approved,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should approve pending posts', async () => {
    loggedUser = '3'; // Moderator level

    const res: GQLResponse<{
      moderateSourcePosts: { id: string }[];
    }> = await client.mutate(MUTATION, {
      variables: {
        postIds: [pendingId],
        status: SourcePostModerationStatus.Approved,
      },
    });

    expect(res.data.moderateSourcePosts.length).toEqual(1);

    const post = await con.getRepository(SourcePostModeration).findOneByOrFail({
      id: pendingId,
    });

    expect(post.status).toEqual(SourcePostModerationStatus.Approved);
    expect(post.moderatedById).toEqual('3');
  });

  it('should not approve posts in sources where user is not moderator', async () => {
    loggedUser = '2'; // Not moderator of "m" squad, which "pendingId" post belongs to.

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId],
          status: SourcePostModerationStatus.Approved,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should throw error when one or more posts in postIds is from a source where user is not moderator', async () => {
    loggedUser = '2'; // Not moderator of "m" squad, which "pendingId" post belongs to.

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId, pendingId2],
          status: SourcePostModerationStatus.Approved,
        },
      },
      'FORBIDDEN',
    );
  });

  it('should reject pending posts', async () => {
    loggedUser = '3'; // Moderator level

    const res: GQLResponse<{
      moderateSourcePosts: { id: string }[];
    }> = await client.mutate(MUTATION, {
      variables: {
        postIds: [pendingId],
        status: SourcePostModerationStatus.Rejected,
        rejectionReason: 'Spam',
        moderatorMessage: 'This is spam',
      },
    });

    expect(res.data.moderateSourcePosts.length).toEqual(1);

    const post = await con.getRepository(SourcePostModeration).findOneByOrFail({
      id: pendingId,
    });

    expect(post.status).toEqual(SourcePostModerationStatus.Rejected);
    expect(post.moderatedById).toEqual('3');
    expect(post.rejectionReason).toEqual('Spam');
    expect(post.moderatorMessage).toEqual('This is spam');
  });

  it('should not reject pending posts without reason', async () => {
    loggedUser = '3'; // Moderator level

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId],
          status: SourcePostModerationStatus.Rejected,
          moderatorMessage: 'This is spam',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not reject pending posts when reason is `other` and message is empty', async () => {
    loggedUser = '3'; // Moderator level

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          postIds: [pendingId],
          status: SourcePostModerationStatus.Rejected,
          rejectionReason: 'Other',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not update already moderated posts', async () => {
    loggedUser = '3'; // Moderator level

    const res: GQLResponse<{
      moderateSourcePosts: { id: string; status: SourcePostModerationStatus }[];
    }> = await client.mutate(MUTATION, {
      variables: {
        postIds: [pendingId, rejectedId],
        status: SourcePostModerationStatus.Approved,
      },
    });

    // only one post should be updated, one is already rejected
    expect(res.data.moderateSourcePosts.length).toEqual(1);
    expect(res.data.moderateSourcePosts[0].status).toEqual(
      SourcePostModerationStatus.Approved,
    );
  });
});

describe('Source post moderation edit/delete', () => {
  const [pendingId, rejectedId] = Array.from({ length: 2 }, () =>
    generateUUID(),
  );

  beforeEach(async () => {
    await saveSquadFixtures();
    await con.getRepository(SourceMember).save([
      {
        sourceId: 'm',
        userId: '4',
        role: SourceMemberRoles.Member,
        referralToken: 'r4',
      },
    ]);
    await con.getRepository(SourcePostModeration).save([
      {
        id: pendingId,
        sourceId: 'm',
        createdById: '4',
        title: 'Title',
        content: 'Content',
        status: SourcePostModerationStatus.Pending,
        type: PostType.Share,
      },
      {
        id: rejectedId,
        sourceId: 'm',
        createdById: '4',
        title: 'Title',
        content: 'Content',
        status: SourcePostModerationStatus.Rejected,
        rejectionReason: PostModerationReason.Spam,
        moderatorMessage: 'This is spam',
        type: PostType.Share,
        moderatedById: '3',
      },
    ]);
  });

  const DELETE_MUTATION = `
  mutation DeleteSourcePostModeration($postId: ID!) {
    deleteSourcePostModeration(postId: $postId){
      _
    }
  }`;

  const EDIT_MUTATION = `
  mutation EditSourcePostModeration($id: ID!, $sourceId: ID!, $title: String, $content: String, $type: String!, $pollOptions: [PollOptionInput!], $duration: Int) {
    editSourcePostModeration(id: $id, sourceId: $sourceId, title: $title, content: $content, type: $type, pollOptions: $pollOptions, duration: $duration) {
      id
      title
      content
      status
    }
  }`;

  describe('deleteSourcePostModeration', () => {
    it('should block guest', async () => {
      loggedUser = '0';

      await testMutationErrorCode(
        client,
        {
          mutation: DELETE_MUTATION,
          variables: { postId: pendingId },
        },
        'FORBIDDEN',
      );
    });

    it('should not authorize when not source member', async () => {
      loggedUser = '1'; // Not a member
      await testMutationErrorCode(
        client,
        {
          mutation: DELETE_MUTATION,
          variables: { postId: pendingId },
        },
        'FORBIDDEN',
      );
    });

    it('should not authorize when not author nor moderator', async () => {
      loggedUser = '5'; // Member level
      await testMutationErrorCode(
        client,
        {
          mutation: DELETE_MUTATION,
          variables: { postId: pendingId },
        },
        'FORBIDDEN',
      );
    });

    it('should delete pending post', async () => {
      loggedUser = '4'; // Member level

      const res = await client.mutate(DELETE_MUTATION, {
        variables: { postId: pendingId },
      });

      expect(res.errors).toBeFalsy();
      const post = await con.getRepository(SourcePostModeration).findOneBy({
        id: pendingId,
      });
      expect(post).toBeNull();
    });
  });

  describe('editSourcePostModeration', () => {
    it('should block guest', async () => {
      loggedUser = '0';
      await testMutationErrorCode(
        client,
        {
          mutation: EDIT_MUTATION,
          variables: {
            id: pendingId,
            title: 'New Title',
            type: PostType.Freeform,
            sourceId: 'm',
          },
        },
        'FORBIDDEN',
      );
    });

    it('should not authorize when not source member', async () => {
      loggedUser = '1'; // Not a member
      await testMutationErrorCode(
        client,
        {
          mutation: EDIT_MUTATION,
          variables: {
            id: pendingId,
            title: 'New Title',
            type: PostType.Freeform,
            sourceId: 'm',
          },
        },
        'FORBIDDEN',
      );
    });

    it('should not authorize when not author', async () => {
      loggedUser = '3'; // Moderator level
      await testMutationErrorCode(
        client,
        {
          mutation: EDIT_MUTATION,
          variables: {
            id: pendingId,
            title: 'New Title',
            type: PostType.Freeform,
            sourceId: 'm',
          },
        },
        'FORBIDDEN',
      );
    });

    it('should edit pending post', async () => {
      loggedUser = '4'; // Member level

      const res = await client.mutate(EDIT_MUTATION, {
        variables: {
          id: pendingId,
          title: 'New Title',
          content: 'New Content',
          type: PostType.Freeform,
          sourceId: 'm',
        },
      });

      expect(res.errors).toBeFalsy();

      const post = res.data.editSourcePostModeration;
      expect(post.title).toEqual('New Title');
      expect(post.content).toEqual('New Content');
    });

    it('should edit rejected post and set as pending', async () => {
      loggedUser = '4'; // Member level

      const res: GQLResponse<{
        editSourcePostModeration: SourcePostModeration;
      }> = await client.mutate(EDIT_MUTATION, {
        variables: {
          id: rejectedId,
          title: 'New Title',
          content: 'New Content',
          type: PostType.Freeform,
          sourceId: 'm',
        },
      });

      expect(res.errors).toBeFalsy();
      const post = res.data.editSourcePostModeration;
      expect(post.title).toEqual('New Title');
      expect(post.content).toEqual('New Content');
      expect(post.status).toEqual(SourcePostModerationStatus.Pending);
    });

    describe('poll editing', () => {
      const pollId = generateUUID();
      const defaultPollOptions = [
        { text: 'Option 1', order: 0 },
        { text: 'Option 2', order: 1 },
      ];

      beforeEach(async () => {
        // Add a poll moderation entry for testing
        await con.getRepository(SourcePostModeration).save({
          id: pollId,
          sourceId: 'm',
          createdById: '4',
          title: 'Original Poll Question',
          type: PostType.Poll,
          status: SourcePostModerationStatus.Pending,
          pollOptions: defaultPollOptions,
          duration: 7,
        });
      });

      it('should edit poll options and duration', async () => {
        loggedUser = '4';

        const newPollOptions = [
          { text: 'New Option 1', order: 0 },
          { text: 'New Option 2', order: 1 },
          { text: 'New Option 3', order: 2 },
        ];

        const res = await client.mutate(EDIT_MUTATION, {
          variables: {
            id: pollId,
            sourceId: 'm',
            title: 'Updated Poll Question',
            type: PostType.Poll,
            pollOptions: newPollOptions,
            duration: 14,
          },
        });

        expect(res.errors).toBeFalsy();

        const updatedPost = res.data.editSourcePostModeration;
        expect(updatedPost.title).toEqual('Updated Poll Question');
        expect(updatedPost.status).toEqual(SourcePostModerationStatus.Pending);

        // Verify poll options and duration were updated in database
        const moderation = await con
          .getRepository(SourcePostModeration)
          .findOne({
            where: { id: pollId },
            select: ['pollOptions', 'duration'],
          });

        expect(moderation?.pollOptions).toHaveLength(3);
        expect(moderation?.pollOptions?.map((opt) => opt.text)).toEqual([
          'New Option 1',
          'New Option 2',
          'New Option 3',
        ]);
        expect(moderation?.duration).toBe(14);
      });

      it('should overwrite poll options completely', async () => {
        loggedUser = '4';

        // Change from 2 options to 4 options
        const newPollOptions = [
          { text: 'A', order: 0 },
          { text: 'B', order: 1 },
          { text: 'C', order: 2 },
          { text: 'D', order: 3 },
        ];

        const res = await client.mutate(EDIT_MUTATION, {
          variables: {
            id: pollId,
            sourceId: 'm',
            title: 'Poll with 4 options',
            type: PostType.Poll,
            pollOptions: newPollOptions,
            duration: 30,
          },
        });

        expect(res.errors).toBeFalsy();

        // Verify all options were replaced
        const moderation = await con
          .getRepository(SourcePostModeration)
          .findOne({
            where: { id: pollId },
            select: ['pollOptions', 'duration'],
          });

        expect(moderation?.pollOptions).toHaveLength(4);
        expect(moderation?.pollOptions?.map((opt) => opt.text)).toEqual([
          'A',
          'B',
          'C',
          'D',
        ]);
        expect(moderation?.duration).toBe(30);
      });

      it('should clear duration when not provided', async () => {
        loggedUser = '4';

        const res = await client.mutate(EDIT_MUTATION, {
          variables: {
            id: pollId,
            sourceId: 'm',
            title: 'Poll without duration',
            type: PostType.Poll,
            pollOptions: defaultPollOptions,
            // duration not specified
          },
        });

        expect(res.errors).toBeFalsy();

        // Verify duration was cleared but poll options were updated
        const moderation = await con
          .getRepository(SourcePostModeration)
          .findOne({
            where: { id: pollId },
            select: ['duration', 'pollOptions'],
          });

        expect(moderation?.duration).toBeFalsy();
        // Poll options should be updated since they were provided
        expect(moderation?.pollOptions).toHaveLength(2);
        expect(moderation?.pollOptions?.map((opt) => opt.text)).toEqual([
          'Option 1',
          'Option 2',
        ]);
      });

      it('should fail to edit poll with invalid poll options', async () => {
        loggedUser = '4';

        const invalidPollOptions = [{ text: 'Only one option', order: 0 }];

        await testMutationErrorCode(
          client,
          {
            mutation: EDIT_MUTATION,
            variables: {
              id: pollId,
              sourceId: 'm',
              title: 'Invalid poll',
              type: PostType.Poll,
              pollOptions: invalidPollOptions,
            },
          },
          'GRAPHQL_VALIDATION_FAILED',
        );
      });

      it('should fail to edit with invalid duration', async () => {
        loggedUser = '4';

        await testMutationErrorCode(
          client,
          {
            mutation: EDIT_MUTATION,
            variables: {
              id: pollId,
              sourceId: 'm',
              title: 'Invalid duration poll',
              type: PostType.Poll,
              pollOptions: defaultPollOptions,
              duration: 2, // Invalid duration (should be 3-30)
            },
          },
          'GRAPHQL_VALIDATION_FAILED',
        );
      });
    });
  });
});

describe('query fetchSmartTitle', () => {
  const QUERY = /* GraphQL */ `
    query FetchSmartTitle($id: ID!) {
      fetchSmartTitle(id: $id) {
        title
        translation {
          title
          smartTitle
        }
      }
    }
  `;

  beforeEach(async () => {
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        contentMeta: {
          alt_title: {
            translations: {
              en: 'Alt Title',
              de: 'Alt Title DE',
            },
          },
        },
        translation: {
          de: {
            title: 'Title DE',
          },
        },
      },
    );
    await con
      .getRepository(User)
      .update(
        { id: '1' },
        { subscriptionFlags: { cycle: SubscriptionCycles.Yearly } },
      );
  });

  it('should throw error when user is not logged in', async () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'p1' } },
      'UNAUTHENTICATED',
    ));

  it('should return the original title when clickbait shield is enabled', async () => {
    loggedUser = '1';
    isPlus = true;

    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('P1');
  });

  it('should return the original title when clickbait shield is enabled and language is set', async () => {
    loggedUser = '1';
    isPlus = true;
    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
      headers: { 'content-language': 'de' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('Title DE');
  });

  it('should return the smart title when clickbait shield is disabled', async () => {
    loggedUser = '1';
    isPlus = true;

    await con
      .getRepository(Settings)
      .save({ userId: loggedUser, flags: { clickbaitShieldEnabled: false } });

    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('Alt Title');
  });

  it('should return the smart title muliple times when clickbait shield is disabled', async () => {
    loggedUser = '1';
    isPlus = true;

    await con
      .getRepository(Settings)
      .save({ userId: loggedUser, flags: { clickbaitShieldEnabled: false } });

    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('Alt Title');

    const res2 = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
    });

    expect(res2.errors).toBeFalsy();
    expect(res2.data.fetchSmartTitle.title).toEqual('Alt Title');
  });

  it('should return the smart title when clickbait shield is disabled and language is set', async () => {
    loggedUser = '1';
    isPlus = true;

    await con
      .getRepository(Settings)
      .save({ userId: loggedUser, flags: { clickbaitShieldEnabled: false } });

    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
      headers: { 'content-language': 'de' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('Alt Title DE');
  });

  it('should return smart title translation when clickbait shield is enabled and language is set', async () => {
    loggedUser = '1';
    isPlus = true;

    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        contentMeta: {
          alt_title: {
            translations: {
              en: 'Alt Title',
              de: 'Alt Title DE',
            },
          },
        },
        translation: {
          de: {
            title: 'Title DE',
            smartTitle: 'Smart Title DE',
          },
        },
      },
    );

    await con
      .getRepository(Settings)
      .save({ userId: loggedUser, flags: { clickbaitShieldEnabled: false } });

    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
      headers: { 'content-language': 'de' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('Smart Title DE');
  });

  it('should return the original title translation when clickbait shield is enabled and language is set', async () => {
    loggedUser = '1';
    isPlus = true;

    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        contentMeta: {
          alt_title: {
            translations: {
              en: 'Alt Title',
              de: 'Alt Title DE',
            },
          },
        },
        translation: {
          de: {
            title: 'Title DE',
            smartTitle: 'Smart Title DE',
          },
        },
      },
    );

    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
      headers: { 'content-language': 'de' },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.fetchSmartTitle.title).toEqual('Title DE');
  });

  describe('free user', () => {
    it('should be able to get the smart title for trial', async () => {
      loggedUser = '2';
      const res = await client.query<
        { fetchSmartTitle: GQLPostSmartTitle },
        { id: string }
      >(QUERY, {
        variables: { id: 'p1' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.fetchSmartTitle.title).toEqual('Alt Title');
    });

    it('should return translate field', async () => {
      loggedUser = '1';
      isPlus = true;
      const res = await client.query<
        { fetchSmartTitle: GQLPostSmartTitle },
        { id: string }
      >(QUERY, {
        variables: { id: 'p1' },
        headers: { 'content-language': 'de' },
      });

      expect(res.errors).toBeFalsy();
      expect(res.data.fetchSmartTitle.title).toEqual('Title DE');
      expect(res.data.fetchSmartTitle.translation).toEqual({
        title: true,
        smartTitle: false,
      });
    });
  });

  const keyPrefix = 'clickbait-shield';
  const getShieldKey = (userId: string) => `${keyPrefix}:${userId}`;

  it('should block after 5 fetchSmartTitle queries for non-Plus user', async () => {
    loggedUser = '1';
    isPlus = false;
    await deleteRedisKey(getShieldKey(loggedUser));
    for (let i = 0; i < 5; i++) {
      const res = await client.query<
        { fetchSmartTitle: GQLPostSmartTitle },
        { id: string }
      >(QUERY, {
        variables: { id: 'p1' },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.fetchSmartTitle).toBeDefined();
    }
    // 6th call should be blocked
    const res = await client.query<
      { fetchSmartTitle: GQLPostSmartTitle },
      { id: string }
    >(QUERY, {
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0].message).toMatch(/You have reached your limit/);
    await deleteRedisKey(getShieldKey(loggedUser));
  });

  it('should never block fetchSmartTitle for Plus user', async () => {
    loggedUser = '1';
    isPlus = true;
    await deleteRedisKey(getShieldKey(loggedUser));
    for (let i = 0; i < 10; i++) {
      const res = await client.query<
        { fetchSmartTitle: GQLPostSmartTitle },
        { id: string }
      >(QUERY, {
        variables: { id: 'p1' },
      });
      expect(res.errors).toBeFalsy();
      expect(res.data.fetchSmartTitle).toBeDefined();
    }
    await deleteRedisKey(getShieldKey(loggedUser));
  });
});

describe('field language', () => {
  const QUERY = /* GraphQL */ `
    query Post($id: ID!) {
      post(id: $id) {
        language
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(con, ArticlePost, [
      {
        id: 'lp1',
        shortId: 'slp1',
        title: 'LP1',
        url: 'http://lp1.com',
        canonicalUrl: 'http://lp1c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 'a',
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        language: 'en',
      },
      {
        id: 'lp2',
        shortId: 'slp2',
        title: 'LP2',
        url: 'http://lp2.com',
        canonicalUrl: 'http://lp2c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 'a',
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        language: 'de',
      },
      {
        id: 'lp3',
        shortId: 'slp3',
        title: 'LP3',
        url: 'http://lp3.com',
        canonicalUrl: 'http://lp3c.com',
        image: 'https://daily.dev/image.jpg',
        score: 1,
        sourceId: 'a',
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
      },
    ]);
  });

  it('should return the post language', async () => {
    const res = await client.query(QUERY, {
      variables: { id: 'lp1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.post.language).toEqual('en');

    const resDe = await client.query(QUERY, {
      variables: { id: 'lp2' },
    });
    expect(resDe.errors).toBeFalsy();
    expect(resDe.data.post.language).toEqual('de');
  });

  it('should default to en when language is not set', async () => {
    const res = await client.query(QUERY, {
      variables: { id: 'lp3' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.post.language).toEqual('en');
  });
});

describe('featuredAward field', () => {
  const QUERY = `
  query Post($id: ID!) {
    post(id: $id) {
      featuredAward {
        award {
          id
          name
          image
          value
        }
      }
    }
  }`;

  beforeEach(async () => {
    await saveFixtures(con, Product, [
      {
        id: '5978781a-0e22-4702-bb32-1c59a13023c4',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '03916c91-8030-499e-8d3d-ae0a4c065012',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: '24d83ece-1f82-4a82-ae48-85e5b003c9af',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);
  });

  it('should return featuredAward', async () => {
    const [transaction, transaction2, transaction3] = await con
      .getRepository(UserTransaction)
      .save([
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1',
          status: UserTransactionStatus.Success,
          productId: '03916c91-8030-499e-8d3d-ae0a4c065012',
          senderId: '1',
          fee: 0,
          value: 10,
          valueIncFees: 10,
        },
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1',
          status: UserTransactionStatus.Success,
          productId: '24d83ece-1f82-4a82-ae48-85e5b003c9af',
          senderId: '3',
          fee: 0,
          value: 20,
          valueIncFees: 20,
        },
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1',
          status: UserTransactionStatus.Success,
          productId: '5978781a-0e22-4702-bb32-1c59a13023c4',
          senderId: '2',
          fee: 0,
          value: 42,
          valueIncFees: 42,
        },
      ]);

    await con.getRepository(UserPost).save([
      {
        postId: 'p1',
        userId: transaction.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction.productId,
        },
        awardTransactionId: transaction.id,
      },
      {
        postId: 'p1',
        userId: transaction2.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction2.productId,
        },
        awardTransactionId: transaction2.id,
      },
      {
        postId: 'p2',
        userId: transaction3.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction3.productId,
        },
        awardTransactionId: transaction3.id,
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { id: 'p1' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post.featuredAward).toMatchObject({
      award: {
        id: '24d83ece-1f82-4a82-ae48-85e5b003c9af',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        value: 20,
      },
    });
  });

  it('should not return featuredAward if no awards', async () => {
    const [transaction] = await con.getRepository(UserTransaction).save([
      {
        processor: UserTransactionProcessor.Njord,
        receiverId: '1',
        status: UserTransactionStatus.Success,
        productId: '03916c91-8030-499e-8d3d-ae0a4c065012',
        senderId: '1',
        fee: 0,
        value: 10,
        valueIncFees: 10,
      },
    ]);

    await con.getRepository(UserPost).save([
      {
        postId: 'p1',
        userId: transaction.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction.productId,
        },
        awardTransactionId: transaction.id,
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { id: 'p2' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.post.featuredAward).toBeNull();
  });
});

describe('query post awards', () => {
  const QUERY = `
  query PostAwards($id: ID!) {
    awards: postAwards(id: $id) {
      edges {
        node {
          user {
            id
            name
          }
          award {
            name
            value
          }
          awardTransaction {
            value
          }
        }
      }
    }
    awardsTotal: postAwardsTotal(id: $id) {
      amount
    }
  }
  `;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-paq`,
          username: `${item.username}-paq`,
        };
      }),
    );

    await saveFixtures(con, Source, [
      {
        id: 'a-paq',
        name: 'A-PAQ',
        image: 'http://image.com/a/paq',
        handle: 'a-paq',
        type: SourceType.Machine,
      },
      {
        id: 'b-paq',
        name: 'B-PAQ',
        image: 'http://image.com/b/paq',
        handle: 'b-paq',
        type: SourceType.Machine,
        private: true,
      },
    ]);

    await saveFixtures(con, ArticlePost, [
      {
        id: 'p1-paq',
        shortId: 'sp1-paq',
        title: 'P1-PAQ',
        url: 'http://p1.com/paq',
        canonicalUrl: 'http://p1c.com/paq',
        image: 'https://daily.dev/image-paq.jpg',
        score: 1,
        sourceId: 'a-paq',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        authorId: '1-paq',
      },
      {
        id: 'p2-paq',
        shortId: 'sp2-paq',
        title: 'P2-PAQ',
        url: 'http://p2.com/paq',
        canonicalUrl: 'http://p2c.com/paq',
        image: 'https://daily.dev/image2-paq.jpg',
        score: 1,
        sourceId: 'b-paq',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
      },
    ]);

    await saveFixtures(con, Product, [
      {
        id: '987cdf34-7d12-435d-87c1-1bbd4daa4480',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '777cfd3d-1359-416b-b52a-e229b230f024',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: '7097b336-fefa-4d60-bb78-fbc676ae1abf',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);
  });

  it('should throw error when user cannot access', async () => {
    loggedUser = '1';

    await testQueryErrorCode(
      client,
      {
        query: QUERY,
        variables: { id: 'p2-paq' },
      },
      'FORBIDDEN',
    );
  });

  it('should return awards', async () => {
    loggedUser = '2-paq';

    const [transaction, transaction2] = await con
      .getRepository(UserTransaction)
      .save([
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1-paq',
          status: UserTransactionStatus.Success,
          productId: '777cfd3d-1359-416b-b52a-e229b230f024',
          senderId: '3-paq',
          fee: 0,
          value: 50,
          valueIncFees: 50,
        },
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1-paq',
          status: UserTransactionStatus.Success,
          productId: '7097b336-fefa-4d60-bb78-fbc676ae1abf',
          senderId: '4-paq',
          fee: 0,
          value: 20,
          valueIncFees: 20,
        },
      ]);

    await con.getRepository(UserPost).save([
      {
        postId: 'p1-paq',
        userId: transaction.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction.productId,
        },
        awardTransactionId: transaction.id,
      },
      {
        postId: 'p1-paq',
        userId: transaction2.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction2.productId,
        },
        awardTransactionId: transaction2.id,
      },
    ]);

    const res = await client.query(QUERY, {
      variables: { id: 'p1-paq' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.awardsTotal.amount).toEqual(70);
    expect(res.data.awards.edges).toMatchObject([
      {
        node: {
          user: {
            id: '3-paq',
            name: 'Nimrod',
          },
          award: {
            name: 'Award 2',
            value: 10,
          },
          awardTransaction: {
            value: 50,
          },
        },
      },
      {
        node: {
          user: {
            id: '4-paq',
            name: 'Lee',
          },
          award: {
            name: 'Award 3',
            value: 20,
          },
          awardTransaction: {
            value: 20,
          },
        },
      },
    ]);
  });
});

describe('mutation generateBriefing', () => {
  const mockTransport = createMockNjordTransport();

  jest
    .spyOn(njordCommon, 'getNjordClient')
    .mockImplementation(() => createClient(Credits, mockTransport));

  const MUTATION = `
  mutation GenerateBriefing($type: BriefingType!) {
  generateBriefing(type: $type) {
    postId
  }
}`;

  afterEach(async () => {
    // clean all the briefings
    await con.getRepository(BriefPost).deleteAll();
  });

  const variables = {
    type: BriefingType.Daily,
  };

  it('should not authorize when not logged in', async () => {
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    );
  });

  it('should allow plus user to generate brief without payment', async () => {
    loggedUser = '1';
    isPlus = true;

    const res = await client.mutate(MUTATION, {
      variables,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.generateBriefing.postId).toBeDefined();

    expectTypedEvent('api.v1.brief-generate', {
      payload: new UserBriefingRequest({
        userId: loggedUser,
        frequency: variables.type,
        modelName: BriefingModel.Default,
      }),
      postId: res.data.generateBriefing.postId,
    });

    // Should not create any transaction for plus users
    const transactions = await con.getRepository(UserTransaction).find({
      where: {
        senderId: loggedUser,
        referenceType: UserTransactionType.BriefGeneration,
      },
    });
    expect(transactions).toHaveLength(0);
  });

  it('should allow non-plus user to generate first brief for free', async () => {
    loggedUser = '1';

    // Mock sufficient balance
    jest.spyOn(njordCommon, 'getBalance').mockResolvedValue({
      amount: 0,
    });

    const res = await client.mutate(MUTATION, {
      variables,
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.generateBriefing.postId).toBeDefined();

    expectTypedEvent('api.v1.brief-generate', {
      payload: new UserBriefingRequest({
        userId: loggedUser,
        frequency: variables.type,
        modelName: BriefingModel.Default,
      }),
      postId: res.data.generateBriefing.postId,
    });

    // Should not create any transaction for first brief
    const transactions = await con.getRepository(UserTransaction).find({
      where: {
        senderId: loggedUser,
        referenceType: UserTransactionType.BriefGeneration,
      },
    });
    expect(transactions).toHaveLength(0);
  });

  it('should charge cores for non-plus user briefs', async () => {
    loggedUser = '1';

    // Create an existing brief to make this not the first one
    await con.getRepository(Post).save({
      id: 'existing-brief',
      shortId: 'existing-brief',
      authorId: loggedUser,
      type: PostType.Brief,
      private: true,
      visible: true,
      sourceId: 'briefing',
      createdAt: subDays(new Date(), 1),
    });

    // Mock sufficient balance
    jest.spyOn(njordCommon, 'getBalance').mockResolvedValue({
      amount: 500,
    });

    // Mock successful transfer
    jest.spyOn(njordCommon, 'transferCores').mockResolvedValue({
      id: 'transfer-123',
      senderBalance: {
        newBalance: BigInt(400), // 500 - 100 (cost)
        previousBalance: BigInt(500),
        changeAmount: BigInt(-100),
      },
    } as TransferResult);

    const res = await client.mutate(MUTATION, {
      variables,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.generateBriefing.postId).toBeDefined();

    // Should create a transaction for non-first brief
    const transactions = await con.getRepository(UserTransaction).find({
      where: {
        senderId: loggedUser,
        referenceType: UserTransactionType.BriefGeneration,
      },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].value).toEqual(300); // Default daily price
    expect(transactions[0].flags.note).toContain('daily');
  });

  it('should charge different price for weekly briefs', async () => {
    loggedUser = '1';

    // Create an existing brief to make this not the first one
    await con.getRepository(Post).save({
      id: 'prev-brief-w',
      shortId: 'prev-brief-w',
      authorId: loggedUser,
      type: PostType.Brief,
      private: true,
      visible: true,
      sourceId: 'briefing',
      createdAt: subDays(new Date(), 1),
    });

    // Mock sufficient balance
    jest.spyOn(njordCommon, 'getBalance').mockResolvedValue({
      amount: 600,
    });

    // Mock successful transfer
    jest.spyOn(njordCommon, 'transferCores').mockResolvedValue({
      id: 'transfer-124',
      senderBalance: {
        newBalance: BigInt(100), // 600 - 500 (weekly cost)
        previousBalance: BigInt(600),
        changeAmount: BigInt(-500),
      },
    } as TransferResult);

    const res = await client.mutate(MUTATION, {
      variables: { type: BriefingType.Weekly },
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.generateBriefing.postId).toBeDefined();

    // Should create a transaction with a weekly price
    const transactions = await con.getRepository(UserTransaction).find({
      where: {
        senderId: loggedUser,
        referenceType: UserTransactionType.BriefGeneration,
      },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].value).toEqual(500); // Default weekly price
    expect(transactions[0].flags.note).toContain('weekly');
  });

  it('should throw error when non-plus user has insufficient cores', async () => {
    loggedUser = '1';

    // Create an existing brief to make this not the first one
    await con.getRepository(Post).save({
      id: 'prev-brief-p',
      shortId: 'prev-brief-p',
      authorId: loggedUser,
      type: PostType.Brief,
      private: true,
      visible: true,
      sourceId: 'briefing',
      createdAt: subDays(new Date(), 1),
    });

    // Mock insufficient balance
    jest.spyOn(njordCommon, 'getBalance').mockResolvedValue({
      amount: 100, // Less than required 300
    });

    // Mock transfer failure due to insufficient cores
    jest.spyOn(njordCommon, 'transferCores').mockRejectedValue(
      new TransferError({
        status: TransferStatus.INSUFFICIENT_FUNDS,
        errorMessage: 'Insufficient balance',
        idempotencyKey: 'test-key',
        results: [
          {
            senderId: loggedUser,
            transferType: TransferType.TRANSFER,
            senderBalance: {
              newBalance: BigInt(100),
              previousBalance: BigInt(100),
              changeAmount: BigInt(0),
            },
          },
        ],
      } as never),
    );

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'BALANCE_TRANSACTION_ERROR',
    );

    // Should create a transaction with failed status
    const transactions = await con.getRepository(UserTransaction).find({
      where: {
        senderId: loggedUser,
        referenceType: UserTransactionType.BriefGeneration,
      },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].status).toEqual(TransferStatus.INSUFFICIENT_FUNDS);
  });

  it('should not start briefing generation if already generating', async () => {
    loggedUser = '1';
    isPlus = true;

    const res = await client.mutate(MUTATION, {
      variables,
    });

    expect(res.errors).toBeFalsy();

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'CONFLICT',
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });

  it('should throw existing post data if briefing is already generating', async () => {
    loggedUser = '1';
    isPlus = true;

    const res = await client.mutate(MUTATION, {
      variables,
    });

    expect(res.errors).toBeFalsy();

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);

    const resError = await client.mutate(MUTATION, {
      variables,
    });

    expect(resError.errors).toBeTruthy();

    expect(resError.errors?.[0].extensions?.postId).toEqual(
      res.data.generateBriefing.postId,
    );
    expect(resError.errors?.[0].extensions?.createdAt).toEqual(
      expect.any(String),
    );

    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);
  });

  it('should start briefing generation if other user brief is generating', async () => {
    loggedUser = '2';

    const res = await client.mutate(MUTATION, {
      variables,
    });

    expect(res.errors).toBeFalsy();
    expect(triggerTypedEvent).toHaveBeenCalledTimes(1);

    loggedUser = '1';

    const res2 = await client.mutate(MUTATION, {
      variables,
    });

    expect(res2.errors).toBeFalsy();

    expect(res2.errors).toBeFalsy();
    expect(triggerTypedEvent).toHaveBeenCalledTimes(2);
  });
});

describe('query post analytics', () => {
  const QUERY = /* GraphQL */ `
    query PostAnalytics($id: ID!) {
      postAnalytics(id: $id) {
        id
        impressions
        reach
        bookmarks
        profileViews
        followers
        squadJoins
        reputation
        coresEarned
        upvotes
        downvotes
        comments
        awards
        upvotesRatio
        shares
        reachAds
        impressionsAds
        clicks
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-paq`,
        };
      }),
    );

    await saveFixtures(
      con,
      Post,
      postsFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-paq`,
          shortId: `${item.shortId}-paq`,
          url: `https://example.com/posts/${item.id}-paq`,
          canonicalUrl: `https://example.com/posts/${item.id}-paq`,
          yggdrasilId: randomUUID(),
          authorId: '1-paq',
        };
      }),
    );

    await saveFixtures(
      con,
      PostAnalytics,
      postsFixture.map<PostAnalytics>((item) => {
        return con.getRepository(PostAnalytics).create({
          ...item,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: `${item.id}-paq`,
          impressions: 10,
          reach: 5,
          followers: 2,
          bookmarks: 1,
          profileViews: 3,
          squadJoins: 4,
          sharesExternal: 5,
          sharesInternal: 6,
          reputation: 7,
          coresEarned: 8,
          upvotes: 9,
          downvotes: 2,
          comments: 1,
          awards: 2,
          reachAds: 7,
          reachAll: 12,
          impressionsAds: 25,
          clicks: 11,
          goToLink: 5,
        });
      }),
    );
  });

  it('should throw error when user is not logged in', async () => {
    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'p1-paq' } },
      'UNAUTHENTICATED',
    );
  });

  it('should return post analytics data', async () => {
    loggedUser = '1-paq';

    const res = await client.query(QUERY, {
      variables: {
        id: 'p1-paq',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.postAnalytics).toEqual({
      id: 'p1-paq',
      impressions: 35,
      reach: 12,
      bookmarks: 1,
      profileViews: 3,
      followers: 2,
      squadJoins: 4,
      shares: 11,
      reputation: 7,
      coresEarned: 8,
      upvotes: 9,
      downvotes: 2,
      comments: 1,
      upvotesRatio: 82,
      awards: 2,
      reachAds: 7,
      impressionsAds: 25,
      clicks: 16,
    });
  });

  it('should not return negative reputation', async () => {
    loggedUser = '1-paq';

    await con
      .getRepository(PostAnalytics)
      .update({ id: 'p1-paq' }, { reputation: -5 });

    const res = await client.query(QUERY, {
      variables: {
        id: 'p1-paq',
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.postAnalytics).toMatchObject({
      id: 'p1-paq',
      reputation: 0,
    });
  });

  it('should throw when user is not author', async () => {
    loggedUser = '2-paq';

    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'p1-paq' } },
      'FORBIDDEN',
    );
  });
});

describe('query history for post analytics', () => {
  const QUERY = /* GraphQL */ `
    query PostAnalyticsHistory($after: String, $first: Int, $id: ID!) {
      postAnalyticsHistory(after: $after, first: $first, id: $id) {
        edges {
          cursor
          node {
            id
            date
            impressions
            impressionsAds
          }
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-paqh`,
        };
      }),
    );

    await saveFixtures(
      con,
      Post,
      postsFixture.map((item) => {
        return {
          ...item,
          id: `${item.id}-paqh`,
          shortId: `${item.shortId}-paqh`,
          url: `https://example.com/posts/${item.id}-paqh`,
          canonicalUrl: `https://example.com/posts/${item.id}-paqh`,
          yggdrasilId: randomUUID(),
          authorId: '1-paqh',
        };
      }),
    );

    await saveFixtures(
      con,
      PostAnalyticsHistory,
      postsFixture
        .map<PostAnalyticsHistory[]>((item) => {
          return [
            new Date(),
            subDays(new Date(), 1),
            subDays(new Date(), 2),
          ].map((date) => {
            return con.getRepository(PostAnalyticsHistory).create({
              ...item,
              createdAt: date,
              updatedAt: date,
              id: `${item.id}-paqh`,
              date: format(date, 'yyyy-MM-dd'),
              impressions: 10,
              impressionsAds: 20,
            });
          });
        })
        .flat(1),
    );
  });

  it('should throw error when user is not logged in', async () => {
    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'p1-paqh' } },
      'UNAUTHENTICATED',
    );
  });

  it('should return post analytics data', async () => {
    loggedUser = '1-paqh';

    const res = await client.query(QUERY, {
      variables: {
        id: 'p1-paqh',
        first: 45,
      },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.postAnalyticsHistory.edges).toHaveLength(3);

    res.data.postAnalyticsHistory.edges.forEach((edge, index) => {
      if (index > 0) {
        const previousEdge = res.data.postAnalyticsHistory.edges[index - 1];

        expect(new Date(edge.node.date).getTime()).toBeLessThan(
          new Date(previousEdge.node.date).getTime(),
        );
      }

      expect(edge.node).toMatchObject({
        id: 'p1-paqh',
        date: expect.any(String),
        impressions: 30,
        impressionsAds: 20,
      });
    });
  });

  it('should throw when user is not author', async () => {
    loggedUser = '2-paqh';

    await testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'p1-paqh', first: 45 } },
      'FORBIDDEN',
    );
  });
});
describe('mutate polls', () => {
  beforeEach(async () => {
    await saveSquadFixtures();
    await con.getRepository(Feed).save({
      id: '1',
      userId: '1',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const MUTATION = `
    mutation CreatePollPost($sourceId: ID!, $title: String!, $options: [PollOptionInput!]!, $duration: Int) {
      createPollPost(sourceId: $sourceId, title: $title, options: $options, duration: $duration) {
        id
        title
        endsAt
        type
        source {
          id
        }
        author {
          id
        }
        pollOptions {
          id
          text
          numVotes
          order
        }
      }
    }
`;

  const defaultOptions = [
    { text: 'Option 1', order: 0 },
    { text: 'Option 2', order: 1 },
    { text: 'Option 3', order: 2 },
  ];

  const defaultPoll = {
    sourceId: 'a',
    title: 'My poll',
  };

  it('should create a poll post', async () => {
    loggedUser = '1';

    const poll = {
      ...defaultPoll,
      options: defaultOptions,
    };

    const res = await client.mutate(MUTATION, {
      variables: poll,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createPollPost.id).toBeTruthy();
    expect(res.data.createPollPost.title).toEqual('My poll');
    expect(res.data.createPollPost.type).toEqual(PostType.Poll);
    expect(res.data.createPollPost.pollOptions.length).toEqual(3);

    // Verify contentCuration in database
    const createdPost = await con.getRepository(Post).findOneByOrFail({
      id: res.data.createPollPost.id,
    });
    expect(createdPost.contentCuration).toEqual(['poll']);
  });

  it('should fail to create a poll without at least two options', async () => {
    loggedUser = '1';

    const poll = {
      ...defaultPoll,
      options: defaultOptions.slice(0, 1),
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: poll,
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should fail to create a poll with more than 4 options', async () => {
    loggedUser = '1';

    const options = [
      ...defaultOptions,
      {
        text: 'Option 4',
        order: 3,
      },
      {
        text: 'Option 5',
        order: 4,
      },
    ];

    const poll = {
      ...defaultPoll,
      options,
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: poll,
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should create a poll that ends in 7 days', async () => {
    loggedUser = '1';
    const fakeNow = new Date(2025, 5, 5);
    const futureDate = addDays(fakeNow, 7);

    // Test fails due to timeout if we do not exclude the APIs we don't need.
    const doNotFake: FakeableAPI[] = [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ];
    jest.useFakeTimers({ doNotFake }).setSystemTime(fakeNow);

    const poll = {
      ...defaultPoll,
      duration: 7,
      options: defaultOptions,
    };

    const res = await client.mutate(MUTATION, {
      variables: poll,
    });

    jest
      .useFakeTimers({ doNotFake, advanceTimers: true })
      .setSystemTime(futureDate);

    expect(res.errors).toBeFalsy();
    expect(res.data.createPollPost.endsAt).toBeTruthy();
    expect(
      isSameDay(new Date(res.data.createPollPost.endsAt), futureDate),
    ).toBeTruthy();
  });

  it('should fail to create a poll with a duration other than specified numbers in the zod schema', async () => {
    loggedUser = '1';

    const poll = {
      ...defaultPoll,
      duration: 2,
      options: defaultOptions,
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: poll,
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should create a poll without an end date', async () => {
    loggedUser = '1';

    const poll = {
      ...defaultPoll,
      options: defaultOptions,
    };

    const res = await client.mutate(MUTATION, {
      variables: poll,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createPollPost.endsAt).toBeFalsy();
  });

  it('should allow the user to post a poll to his his userId as source', async () => {
    loggedUser = '1';
    const poll = { ...defaultPoll, sourceId: '1', options: defaultOptions };
    const res = await client.mutate(MUTATION, {
      variables: poll,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.createPollPost.source.id).toBe('1');
    expect(res.data.createPollPost.author.id).toBe('1');
  });
});

describe('mutate poll vote', () => {
  const pollId = generateUUID();

  beforeEach(async () => {
    await saveSquadFixtures();
    const defaultPoll = await con.getRepository(PollPost).save({
      id: pollId,
      shortId: 'poll1',
      title: 'Best OS',
      type: PostType.Poll,
      sourceId: 'a',
      authorId: '1',
      endsAt: addDays(new Date(), 3),
    });

    await con.getRepository(PollOption).save([
      { text: 'Windows', order: 1, postId: defaultPoll.id },
      { text: 'MacOS', order: 2, postId: defaultPoll.id },
      { text: 'Linux', order: 3, postId: defaultPoll.id },
    ]);
  });

  const MUTATION = `
    mutation VotePoll($postId: ID!, $optionId: ID!) {
      votePoll(postId: $postId, optionId: $optionId) {
        id
        endsAt
        pollOptions {
          id
          text
          numVotes
        }
      }
    }
`;

  it('should successfully vote on a poll', async () => {
    loggedUser = '1';

    const option = await con.getRepository(PollOption).findOneBy({
      postId: pollId,
    });

    const vote = {
      postId: pollId,
      optionId: option!.id,
    };

    const res = await client.mutate(MUTATION, {
      variables: vote,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.votePoll.id).toBe(pollId);
    const votedPollOption = res.data.votePoll.pollOptions.find(
      (opt) => opt.id === option!.id,
    );
    expect(votedPollOption.numVotes).toBe(1);
  });

  it('should fail to vote on a poll the user has already voted on', async () => {
    loggedUser = '1';
    const options = await con
      .getRepository(PollOption)
      .find({ where: { postId: pollId } });

    const vote = {
      postId: pollId,
      optionId: options[0].id,
    };

    const res = await client.mutate(MUTATION, {
      variables: vote,
    });

    expect(res.errors).toBeFalsy();
    expect(res.data.votePoll.id).toBe(pollId);
    const votedPollOption = res.data.votePoll.pollOptions.find(
      (opt) => opt.id === options[0].id,
    );
    expect(votedPollOption.numVotes).toBe(1);

    const vote2 = {
      postId: pollId,
      optionId: options[1].id,
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: vote2,
      },
      'CONFLICT',
    );
  });

  it('should not allow the user to vote on a poll that has ended', async () => {
    loggedUser = '1';
    await con
      .getRepository(PollPost)
      .update({ id: pollId }, { endsAt: subDays(new Date(), 10) });

    const option = await con.getRepository(PollOption).findOneBy({
      postId: pollId,
    });

    const vote = {
      postId: pollId,
      optionId: option!.id,
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: vote,
      },
      'CONFLICT',
    );
  });

  it('should not allow user to vote on polls they cant access', async () => {
    loggedUser = '3';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });

    const option = await con.getRepository(PollOption).findOneBy({
      postId: pollId,
    });

    const vote = {
      postId: pollId,
      optionId: option!.id,
    };

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: vote,
      },
      'FORBIDDEN',
    );
  });
});

describe('query userPostsWithAnalytics', () => {
  const QUERY = /* GraphQL */ `
    query UserPostsWithAnalytics($first: Int, $after: String) {
      userPostsWithAnalytics(first: $first, after: $after) {
        edges {
          node {
            id
            title
            analytics {
              id
              impressions
              bookmarks
              reputation
              upvotes
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  beforeEach(async () => {
    await saveFixtures(
      con,
      User,
      usersFixture.map((item) => ({
        ...item,
        id: `${item.id}-upwa`,
      })),
    );

    await saveFixtures(
      con,
      Post,
      postsFixture.slice(0, 3).map((item) => ({
        ...item,
        id: `${item.id}-upwa`,
        shortId: `${item.shortId}-upwa`,
        url: `https://example.com/posts/${item.id}-upwa`,
        canonicalUrl: `https://example.com/posts/${item.id}-upwa`,
        yggdrasilId: randomUUID(),
        authorId: '1-upwa',
      })),
    );

    await saveFixtures(
      con,
      PostAnalytics,
      postsFixture.slice(0, 3).map((item) =>
        con.getRepository(PostAnalytics).create({
          id: `${item.id}-upwa`,
          impressions: 100,
          impressionsAds: 50,
          bookmarks: 12,
          reputation: 25,
          upvotes: 10,
        }),
      ),
    );
  });

  it('should require authentication', async () => {
    await testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED');
  });

  it('should return paginated posts with analytics for the user', async () => {
    loggedUser = '1-upwa';

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userPostsWithAnalytics.edges).toHaveLength(3);
    expect(res.data.userPostsWithAnalytics.edges[0].node).toMatchObject({
      id: expect.stringContaining('-upwa'),
      analytics: {
        impressions: 150,
        bookmarks: 12,
        reputation: 25,
        upvotes: 10,
      },
    });
  });

  it('should return empty for user with no posts', async () => {
    loggedUser = '2-upwa';

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    expect(res.data.userPostsWithAnalytics.edges).toHaveLength(0);
  });

  it('should exclude brief posts from analytics', async () => {
    await saveFixtures(con, Post, [
      {
        id: 'brief-upwa',
        shortId: 'sbrf-upwa',
        title: 'Brief Post',
        url: 'https://example.com/brief-upwa',
        sourceId: 'a',
        authorId: '1-upwa',
        type: PostType.Brief,
        visible: true,
      },
    ]);

    await saveFixtures(con, PostAnalytics, [
      con.getRepository(PostAnalytics).create({
        id: 'brief-upwa',
        impressions: 100,
        impressionsAds: 50,
        reputation: 25,
        upvotes: 10,
      }),
    ]);

    loggedUser = '1-upwa';

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    const postIds = res.data.userPostsWithAnalytics.edges.map(
      (e: { node: { id: string } }) => e.node.id,
    );
    expect(postIds).not.toContain('brief-upwa');
    expect(res.data.userPostsWithAnalytics.edges).toHaveLength(3);
  });

  it('should exclude digest posts from analytics', async () => {
    await saveFixtures(con, Post, [
      {
        id: 'digest-upwa',
        shortId: 'sdgst-upwa',
        title: 'Digest Post',
        url: 'https://example.com/digest-upwa',
        sourceId: 'a',
        authorId: '1-upwa',
        type: PostType.Digest,
        visible: true,
      },
    ]);

    await saveFixtures(con, PostAnalytics, [
      con.getRepository(PostAnalytics).create({
        id: 'digest-upwa',
        impressions: 100,
        impressionsAds: 50,
        reputation: 25,
        upvotes: 10,
      }),
    ]);

    loggedUser = '1-upwa';

    const res = await client.query(QUERY, { variables: { first: 10 } });

    expect(res.errors).toBeFalsy();
    const postIds = res.data.userPostsWithAnalytics.edges.map(
      (e: { node: { id: string } }) => e.node.id,
    );
    expect(postIds).not.toContain('digest-upwa');
    expect(res.data.userPostsWithAnalytics.edges).toHaveLength(3);
  });
});
