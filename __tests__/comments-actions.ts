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
import {
  ArticlePost,
  Comment,
  Post,
  PostTag,
  PostType,
  Source,
  SourceMember,
  SourceType,
  User,
} from '../src/entity';
import { ContentEmbed } from '../src/entity/ContentEmbed';
import { SourceMemberRoles } from '../src/roles';
import { sourcesFixture } from './fixture/source';
import {
  postsFixture,
  postTagsFixture,
  sharedPostsFixture,
} from './fixture/post';
import { SortCommentsBy } from '../src/schema/comments';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { CommentReport } from '../src/entity/CommentReport';
import { UserComment } from '../src/entity/user/UserComment';
import { UserVote, UserVoteEntity } from '../src/types';
import { rateLimiterName } from '../src/directive/rateLimit';
import { deleteKeysByPattern } from '../src/redis';
import { badUsersFixture } from './fixture';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
} from '../src/entity/user/UserTransaction';
import { Product, ProductType } from '../src/entity/Product';

let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await createOrGetConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser),
  );
  client = state.client;
});

const usersFixture = [
  { id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' },
  { id: '2', name: 'Tsahi', image: 'https://daily.dev/tsahi.jpg' },
  { id: '3', name: 'Nimrod', image: 'https://daily.dev/nimrod.jpg' },
  { id: '4', name: 'Lee', image: 'https://daily.dev/lee.jpg' },
  { id: '5', name: 'Hansel', image: 'https://daily.dev/Hansel.jpg' },
  { id: '6', name: 'Samson', image: 'https://daily.dev/samson.jpg' },
  { id: '7', name: 'Solevilla', image: 'https://daily.dev/solevilla.jpg' },
];

beforeEach(async () => {
  loggedUser = null;
  jest.resetAllMocks();

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, ArticlePost, sharedPostsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con.getRepository(User).save(usersFixture);
  await con.getRepository(User).save(badUsersFixture);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'parent comment',
      contentHtml: '<p>parent comment</p>',
      createdAt: new Date(2020, 1, 6, 0, 0),
    },
    {
      id: 'c2',
      parentId: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'child comment',
      contentHtml: '<p>child comment</p>',
      createdAt: new Date(2020, 1, 7, 0, 0),
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '2',
      content: 'parent comment #2',
      contentHtml: '<p>parent comment #2</p>',
      createdAt: new Date(2020, 1, 8, 0, 0),
    },
    {
      id: 'c4',
      postId: 'p2',
      userId: '3',
      content: 'parent comment #3',
      contentHtml: '<p>parent comment #3</p>',
      createdAt: new Date(2020, 1, 9, 0, 0),
    },
    {
      id: 'c5',
      postId: 'p2',
      parentId: 'c4',
      userId: '1',
      content: 'child comment #2',
      contentHtml: '<p>child comment #2</p>',
      createdAt: new Date(2020, 1, 10, 0, 0),
    },
    {
      id: 'c6',
      postId: 'p1',
      userId: '3',
      content: 'parent comment #4',
      contentHtml: '<p>parent comment #4</p>',
      createdAt: new Date(2020, 1, 9, 0, 0),
    },
    {
      id: 'c7',
      postId: 'p1',
      parentId: 'c6',
      userId: '2',
      content: 'child comment #3',
      contentHtml: '<p>child comment #3</p>',
      createdAt: new Date(2020, 1, 10, 0, 0),
    },
    {
      id: 'c8',
      postId: 'squadP1',
      userId: '2',
      content: 'comment #1',
      contentHtml: '<p>comment #1</p>',
      createdAt: new Date(2020, 1, 10, 0, 0),
    },
  ]);

  await deleteKeysByPattern(`${rateLimiterName}:*`);
});

afterAll(() => disposeGraphQLTesting(state));

describe('mutation deleteComment', () => {
  const MUTATION = `
  mutation DeleteComment($id: ID!) {
  deleteComment(id: $id) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'c1' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find comment', () => {
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

  it('should forbidden when user is not the author', () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'c1' },
      },
      'FORBIDDEN',
    );
  });

  it('should delete a comment', async () => {
    loggedUser = '1';
    const before = await con
      .getRepository(Comment)
      .findOneByOrFail({ id: 'c1' });
    expect(before.comments).toEqual(1);
    const beforePost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });
    expect(beforePost.comments).toEqual(5);
    const res = await client.mutate(MUTATION, { variables: { id: 'c2' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Comment)
      .find({ select: ['id', 'comments'], where: { postId: 'p1' } });
    expect(actual.length).toEqual(4);
    expect(actual.find((c) => c.id === 'c1')!.comments).toEqual(0);
    const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });
    expect(post.comments).toEqual(4);
    expect(post.statsUpdatedAt.getTime()).toBeGreaterThan(
      beforePost.statsUpdatedAt.getTime(),
    );
  });

  it('should delete comment content embeds', async () => {
    loggedUser = '1';
    const editMutation = `
      mutation EditComment($id: ID!, $content: String!) {
        editComment(id: $id, content: $content) {
          id
        }
      }
    `;

    await client.mutate(editMutation, {
      variables: {
        id: 'c2',
        content: 'http://localhost:5002/posts/p2',
      },
    });
    expect(await con.getRepository(ContentEmbed).count()).toEqual(1);

    const res = await client.mutate(MUTATION, { variables: { id: 'c2' } });

    expect(res.errors).toBeFalsy();
    expect(await con.getRepository(ContentEmbed).count()).toEqual(0);
  });

  it('should delete a comment and its children', async () => {
    loggedUser = '1';
    const before = await con.getRepository(Comment).findBy({ postId: 'p1' });
    expect(before.length).toEqual(5);
    const beforePost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });
    expect(beforePost.comments).toEqual(5);
    const res = await client.mutate(MUTATION, { variables: { id: 'c1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).findBy({ postId: 'p1' });
    expect(actual.length).toEqual(3);
    const post = await con.getRepository(Post).findOneByOrFail({ id: 'p1' });
    expect(post.comments).toEqual(3);
  });

  it("should forbidden when other user doesn't have the right permissions", async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).insert({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Member,
      referralToken: 's1',
    });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'c8' },
      },
      'FORBIDDEN',
    );
  });

  it('should delete a comment if source admin has permissions', async () => {
    loggedUser = '1';
    await con.getRepository(SourceMember).insert({
      userId: '1',
      sourceId: 'squad',
      role: SourceMemberRoles.Admin,
      referralToken: 's1',
    });
    const before = await con.getRepository(Comment).findBy({ postId: 'p1' });
    expect(before.length).toEqual(5);
    const beforePost = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'p1' });
    expect(beforePost.comments).toEqual(5);
    const res = await client.mutate(MUTATION, { variables: { id: 'c8' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Comment)
      .find({ select: ['id', 'comments'], where: { postId: 'squadP1' } });
    expect(actual.length).toEqual(0);
    const post = await con
      .getRepository(Post)
      .findOneByOrFail({ id: 'squadP1' });
    expect(post.comments).toEqual(0);
  });
});

describe('permalink field', () => {
  const MUTATION = `
  mutation CommentOnPost($postId: ID!, $content: String!) {
  commentOnPost(postId: $postId, content: $content) {
    id, permalink
  }
}`;

  it('should return permalink', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { postId: 'p1', content: '# my comment http://daily.dev' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.commentOnPost.permalink).toEqual(
      `http://localhost:5002/posts/p1#c-${res.data.commentOnPost.id}`,
    );
  });
});

describe('mutation editComment', () => {
  const MUTATION = `
  mutation EditComment($id: ID!, $content: String!) {
  editComment(id: $id, content: $content) {
    id, content, lastUpdatedAt
  }
}`;

  it('should not allow comment if content is empty string', () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { postId: 'p1', content: '   ' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'c1', content: 'Edit' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find comment', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'invalid', content: 'Edit' },
      },
      'NOT_FOUND',
    );
  });

  it('should forbidden when user is not the author', () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'c1', content: 'Edit' },
      },
      'FORBIDDEN',
    );
  });

  it('should edit a comment', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'c2', content: 'Edit' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.editComment).toEqual({
      id: 'c2',
      lastUpdatedAt: expect.any(String),
      content: 'Edit',
    });
  });

  it('should replace content embeds when editing a comment', async () => {
    loggedUser = '1';
    const linkedContent = 'http://localhost:5002/posts/p2';
    const mutation = `
      mutation EditComment($id: ID!, $content: String!) {
        editComment(id: $id, content: $content) {
          id
          contentEmbeds {
            referenceId
          }
        }
      }
    `;

    const linked = await client.mutate(mutation, {
      variables: { id: 'c2', content: linkedContent },
    });
    expect(linked.errors).toBeFalsy();
    expect(linked.data.editComment.contentEmbeds).toEqual([
      { referenceId: 'p2' },
    ]);

    const unlinked = await client.mutate(mutation, {
      variables: { id: 'c2', content: 'Edit' },
    });
    expect(unlinked.errors).toBeFalsy();
    expect(unlinked.data.editComment.contentEmbeds).toEqual([]);
  });

  describe('vordr', () => {
    it('should set correct vordr flags on edited comment by good user', async () => {
      loggedUser = '1';

      const res = await client.mutate(MUTATION, {
        variables: { id: 'c2', content: 'comment' },
      });

      expect(res.errors).toBeFalsy();

      const comment = await con.getRepository(Comment).findOneByOrFail({
        id: res.data.editComment.id,
      });

      expect(comment.flags).toEqual({ vordr: false });
    });

    it('should set correct vordr flags on edited comment by good user if vordr filter catches it', async () => {
      loggedUser = '1';

      const res = await client.mutate(MUTATION, {
        variables: { id: 'c2', content: 'VordrWillCatchYou' },
      });

      expect(res.errors).toBeFalsy();

      const comment = await con.getRepository(Comment).findOneByOrFail({
        id: res.data.editComment.id,
      });

      expect(comment.flags).toEqual({ vordr: true });
    });
  });
});

describe('mutation reportComment', () => {
  const MUTATION = `
    mutation ReportComment($commentId: ID!, $reason: ReportCommentReason, $note: String) {
      reportComment(commentId: $commentId, reason: $reason, note: $note) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { commentId: 'c1', reason: 'HATEFUL', note: 'Test comment' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find comment', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          commentId: 'invalid',
          reason: 'HATEFUL',
          note: 'Test comment',
        },
      },
      'NOT_FOUND',
    );
  });

  it('should report comment with note', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        commentId: 'c1',
        reason: 'HATEFUL',
        note: 'Test comment',
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con
      .getRepository(CommentReport)
      .findOneBy({ commentId: 'c1' });
    expect(comment).toEqual({
      commentId: 'c1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'HATEFUL',
      note: 'Test comment',
    });
  });

  it('should report comment without note', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { commentId: 'c1', reason: 'HATEFUL' },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con
      .getRepository(CommentReport)
      .findOneBy({ commentId: 'c1' });
    expect(comment).toEqual({
      commentId: 'c1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'HATEFUL',
      note: null,
    });
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const res1 = await client.mutate(MUTATION, {
      variables: { commentId: 'c1', reason: 'HATEFUL' },
    });
    expect(res1.errors).toBeFalsy();
    const comment = await con
      .getRepository(CommentReport)
      .findOneBy({ commentId: 'c1' });
    expect(comment).toEqual({
      commentId: 'c1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'HATEFUL',
      note: null,
    });
    const res2 = await client.mutate(MUTATION, {
      variables: { commentId: 'c1', reason: 'HATEFUL' },
    });
    expect(res2.errors).toBeFalsy();
  });
});

describe('query comment', () => {
  const QUERY = `
    query Comment($id: ID!) {
      comment(id: $id) {
        id
        content
      }
    }
  `;

  it('should not return comment by id when not authenticated', async () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: '123' } },
      'UNAUTHENTICATED',
    ));

  it('should return comment by id even if user is not the author', async () => {
    loggedUser = '2';

    const comment = await client.query(QUERY, { variables: { id: 'c1' } });
    expect(comment.errors).toBeFalsy();
    expect(comment.data.comment.id).toEqual('c1');
  });

  it('should return error when not part of private squad', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).update({ id: 'c1' }, { userId: '1' });
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { private: true, type: SourceType.Squad });

    return testQueryErrorCode(
      client,
      { query: QUERY, variables: { id: 'c1' } },
      'FORBIDDEN',
    );
  });

  it('should return comment by id', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).update({ id: 'c1' }, { userId: '1' });
    const comment = await client.query(QUERY, { variables: { id: 'c1' } });
    expect(comment.errors).toBeFalsy();
    expect(comment.data.comment.id).toEqual('c1');
  });
});

describe('userState field', () => {
  const QUERY = `query PostComments($postId: ID!, $after: String, $first: Int, $sortBy: SortCommentsBy) {
    postComments(postId: $postId, after: $after, first: $first, sortBy: $sortBy) {
      pageInfo { endCursor, hasNextPage }
      edges { node {
        id
        userState {
          vote
          awarded
        }
      } }
    }
    }`;

  it('should return null if anonymous user', async () => {
    const res = await client.query(QUERY, {
      variables: { postId: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    res.data.postComments.edges.forEach((edge) => {
      expect(edge.node.userState).toBeNull();
    });
  });

  it('should return default state if state does not exist', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { postId: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const { vote } = con.getRepository(UserComment).create();

    expect(res.errors).toBeFalsy();
    res.data.postComments.edges.forEach((edge) => {
      expect(edge.node.userState).toMatchObject({
        vote,
        awarded: false,
      });
    });
  });

  it('should sort comment oldest first', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { postId: 'p1' },
    });
    expect(res.errors).toBeFalsy();

    const map = res.data.postComments.edges.map((edge) => edge.node.id);
    expect(map).toEqual(['c1', 'c3', 'c6']);
  });

  it('should sort comment newest first', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, {
      variables: { postId: 'p1', sortBy: SortCommentsBy.NewestFirst },
    });
    expect(res.errors).toBeFalsy();

    const map = res.data.postComments.edges.map((edge) => edge.node.id);
    expect(map).toEqual(['c6', 'c3', 'c1']);
  });

  it('should return user state', async () => {
    loggedUser = '1';
    const userComment = await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    expect(userComment).toBeTruthy();

    const res = await client.query(QUERY, {
      variables: { postId: 'p1' },
    });

    expect(res.errors).toBeFalsy();
    res.data.postComments.edges.forEach((edge) => {
      if (edge.node.id === 'c1') {
        expect(edge.node.userState).toMatchObject({
          vote: UserVote.Up,
          awarded: false,
        });
      } else {
        expect(edge.node.userState).toMatchObject({
          vote: UserVote.None,
          awarded: false,
        });
      }
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

    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
      awardTransactionId: transaction.id,
    });
    const res = await client.query(QUERY, {
      variables: { postId: 'p1' },
    });

    expect(res.errors).toBeFalsy();

    res.data.postComments.edges.forEach((edge) => {
      if (edge.node.id === 'c1') {
        expect(edge.node.userState).toMatchObject({
          vote: UserVote.Up,
          awarded: true,
        });
      } else {
        expect(edge.node.userState).toMatchObject({
          vote: UserVote.None,
          awarded: false,
        });
      }
    });
  });
});

describe('mutation vote comment', () => {
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
          id: 'c1',
          vote: UserVote.Up,
          entity: UserVoteEntity.Comment,
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find comment', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: 'invalid',
          vote: UserVote.Up,
          entity: UserVoteEntity.Comment,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw not found when cannot find user', () => {
    loggedUser = '15';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: 'c1',
          vote: UserVote.Up,
          entity: UserVoteEntity.Comment,
        },
      },
      'NOT_FOUND',
    );
  });

  it('should throw error when user cannot access the commented post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          id: 'c1',
          vote: UserVote.Up,
          entity: UserVoteEntity.Comment,
        },
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
        variables: { id: 'c1', vote: 3, entity: UserVoteEntity.Comment },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should upvote', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Up,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const userComment = await con.getRepository(UserComment).findOneBy({
      userId: loggedUser,
      commentId: 'c1',
    });
    expect(userComment).toMatchObject({
      userId: loggedUser,
      commentId: 'c1',
      vote: UserVote.Up,
    });
    const commment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(commment?.upvotes).toEqual(4);
    const commentUpvote = await con.getRepository(UserComment).findOneBy({
      userId: loggedUser,
      commentId: 'c1',
      vote: UserVote.Up,
    });
    expect(commentUpvote).toMatchObject({
      userId: loggedUser,
      commentId: 'c1',
    });
  });

  it('should downvote', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).save({
      id: 'c1',
      downvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Down,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const userComment = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(userComment).toMatchObject({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    const post = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(post?.downvotes).toEqual(4);
  });

  it('should cancel vote', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 3,
    });
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.None,
        entity: UserVoteEntity.Comment,
      },
    });
    const userComment = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userComment).toMatchObject({
      userId: loggedUser,
      commentId: 'c1',
      vote: UserVote.None,
    });
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(3);
  });

  it('should not set votedAt when vote is not set on insert', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      hidden: false,
    });
    const userCommentBefore = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(userCommentBefore?.votedAt).toBeNull();
  });

  it('should set votedAt when user votes for the first time', async () => {
    loggedUser = '1';
    const userCommentBefore = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(userCommentBefore).toBeNull();
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Down,
        entity: UserVoteEntity.Comment,
      },
    });
    const userComment = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userComment?.votedAt).not.toBeNull();
  });

  it('should update votedAt when vote value changes', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
      hidden: false,
    });
    const userCommentBefore = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Down,
        entity: UserVoteEntity.Comment,
      },
    });
    const userComment = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userCommentBefore?.votedAt?.toISOString()).not.toBe(
      userComment?.votedAt?.toISOString(),
    );
  });

  it('should not update votedAt when vote value stays the same', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
      hidden: false,
    });
    const userCommentBefore = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Up,
        entity: UserVoteEntity.Comment,
      },
    });
    const userComment = await con.getRepository(UserComment).findOneBy({
      commentId: 'c1',
      userId: loggedUser,
    });
    expect(res.errors).toBeFalsy();
    expect(userCommentBefore?.votedAt?.toISOString()).toBe(
      userComment?.votedAt?.toISOString(),
    );
  });

  it('should increment comment upvotes when user upvotes', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 3,
    });
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.None,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Up,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(4);
    expect(comment?.downvotes).toEqual(0);
  });

  it('should increment comment downvotes when user downvotes', async () => {
    loggedUser = '1';
    await con.getRepository(Comment).save({
      id: 'c1',
      downvotes: 3,
    });
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.None,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Down,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(0);
    expect(comment?.downvotes).toEqual(4);
  });

  it('should decrement comment upvotes when user cancels upvote', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.None,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(2);
    expect(comment?.downvotes).toEqual(0);
  });

  it('should decrement comment downvotes when user cancels downvote', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    await con.getRepository(Comment).save({
      id: 'c1',
      downvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.None,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(0);
    expect(comment?.downvotes).toEqual(2);
  });

  it('should decrement comment upvotes and increment downvotes when user changes vote from up to down', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 3,
      downvotes: 2,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Down,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(2);
    expect(comment?.downvotes).toEqual(3);
  });

  it('should increment comment upvotes and decrement downvotes when user changes vote from down to up', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 2,
      downvotes: 3,
    });
    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'c1',
        vote: UserVote.Up,
        entity: UserVoteEntity.Comment,
      },
    });
    expect(res.errors).toBeFalsy();
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(3);
    expect(comment?.downvotes).toEqual(2);
  });

  it('should decrement comment upvotes when UserComment entity is removed', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Up,
    });
    await con.getRepository(Comment).save({
      id: 'c1',
      upvotes: 3,
    });
    await con.getRepository(UserComment).delete({
      commentId: 'c1',
      userId: loggedUser,
    });
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(2);
    expect(comment?.downvotes).toEqual(0);
  });

  it('should decrement comment downvotes when UserComment entity is removed', async () => {
    loggedUser = '1';
    await con.getRepository(UserComment).save({
      commentId: 'c1',
      userId: loggedUser,
      vote: UserVote.Down,
    });
    await con.getRepository(Comment).save({
      id: 'c1',
      downvotes: 3,
    });
    await con.getRepository(UserComment).delete({
      commentId: 'c1',
      userId: loggedUser,
    });
    const comment = await con.getRepository(Comment).findOneBy({ id: 'c1' });
    expect(comment?.upvotes).toEqual(0);
    expect(comment?.downvotes).toEqual(2);
  });
});

describe('award field', () => {
  const QUERY = `query PostComments($postId: ID!, $after: String, $first: Int, $sortBy: SortCommentsBy) {
      postComments(postId: $postId, after: $after, first: $first, sortBy: $sortBy) {
        pageInfo { endCursor, hasNextPage }
        edges {
          node {
            id
            award {
              id
              name
            }
          }
        }
      }
    }`;

  beforeEach(async () => {
    await saveFixtures(con, Product, [
      {
        id: '9104b834-6fac-4276-a168-0be1294ab371',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: 'b633129e-8d36-4108-9f5d-92766f089d21',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: 'e6fddef9-7110-430c-b032-b3e4de8b939f',
        name: 'Award 3',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 20,
      },
    ]);
  });

  it('should return awarded product', async () => {
    loggedUser = '1';

    const transaction = await con.getRepository(UserTransaction).save({
      processor: UserTransactionProcessor.Njord,
      receiverId: '1',
      status: UserTransactionStatus.Success,
      productId: '9104b834-6fac-4276-a168-0be1294ab371',
      senderId: '1',
      fee: 0,
      value: 100,
      valueIncFees: 100,
    });

    await con.getRepository(Comment).save({
      id: 'c1',
      awardTransactionId: transaction.id,
      flags: {
        awardId: transaction.productId,
      },
    });
    const res = await client.query(QUERY, {
      variables: { postId: 'p1' },
    });

    expect(res.errors).toBeFalsy();

    res.data.postComments.edges.forEach((edge) => {
      if (edge.node.id === 'c1') {
        expect(edge.node.award).toMatchObject({
          id: '9104b834-6fac-4276-a168-0be1294ab371',
          name: 'Award 1',
        });
      } else {
        expect(edge.node.award).toBeNull();
      }
    });
  });
});

describe('query comment awards', () => {
  const QUERY = `
  query CommentAwards($id: ID!) {
    awards: commentAwards(id: $id) {
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
    awardsTotal: commentAwardsTotal(id: $id) {
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
          id: `${item.id}-caq`,
          username: `${item.id}-caq`,
        };
      }),
    );

    await saveFixtures(con, Source, [
      {
        id: 'a-caq',
        name: 'A-PAQ',
        image: 'http://image.com/a/caq',
        handle: 'a-caq',
        type: SourceType.Machine,
      },
      {
        id: 'b-caq',
        name: 'B-PAQ',
        image: 'http://image.com/b/caq',
        handle: 'b-caq',
        type: SourceType.Machine,
        private: true,
      },
    ]);

    await saveFixtures(con, ArticlePost, [
      {
        id: 'p1-caq',
        shortId: 'sp1-caq',
        title: 'P1-PAQ',
        url: 'http://p1.com/caq',
        canonicalUrl: 'http://p1c.com/caq',
        image: 'https://daily.dev/image-caq.jpg',
        score: 1,
        sourceId: 'a-caq',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
        authorId: '1-caq',
      },
      {
        id: 'p2-caq',
        shortId: 'sp2-caq',
        title: 'P2-PAQ',
        url: 'http://p2.com/caq',
        canonicalUrl: 'http://p2c.com/caq',
        image: 'https://daily.dev/image2-caq.jpg',
        score: 1,
        sourceId: 'b-caq',
        createdAt: new Date(),
        tagsStr: 'javascript,webdev',
        type: PostType.Article,
        contentCuration: ['c1', 'c2'],
      },
    ]);

    await saveFixtures(con, Comment, [
      {
        id: 'c1-caq',
        postId: 'p1-caq',
        userId: '1-caq',
        content: 'comment',
        contentHtml: '<p>comment</p>',
        createdAt: new Date(),
      },
      {
        id: 'c2-caq',
        postId: 'p2-caq',
        userId: '2-caq',
        content: 'comment',
        contentHtml: '<p>comment</p>',
        createdAt: new Date(),
      },
    ]);

    await saveFixtures(con, Product, [
      {
        id: 'd5a3720d-bef4-454a-ace6-c22dafcf1b02',
        name: 'Award 1',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 42,
      },
      {
        id: '080e0eb0-b366-423b-8d61-eff048b9140b',
        name: 'Award 2',
        image: 'https://daily.dev/award.jpg',
        type: ProductType.Award,
        value: 10,
      },
      {
        id: '7009ba15-2df0-47be-bb34-5f38740a8842',
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
        variables: { id: 'c2-caq' },
      },
      'FORBIDDEN',
    );
  });

  it('should return awards', async () => {
    loggedUser = '2-caq';

    const [transaction, transaction2] = await con
      .getRepository(UserTransaction)
      .save([
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1-caq',
          status: UserTransactionStatus.Success,
          productId: '080e0eb0-b366-423b-8d61-eff048b9140b',
          senderId: '3-caq',
          fee: 0,
          value: 30,
          valueIncFees: 30,
        },
        {
          processor: UserTransactionProcessor.Njord,
          receiverId: '1-caq',
          status: UserTransactionStatus.Success,
          productId: '7009ba15-2df0-47be-bb34-5f38740a8842',
          senderId: '4-caq',
          fee: 0,
          value: 20,
          valueIncFees: 20,
        },
      ]);

    await con.getRepository(UserComment).save([
      {
        commentId: 'c1-caq',
        userId: transaction.senderId,
        vote: UserVote.None,
        hidden: false,
        flags: {
          awardId: transaction.productId,
        },
        awardTransactionId: transaction.id,
      },
      {
        commentId: 'c1-caq',
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
      variables: { id: 'c1-caq' },
    });

    expect(res.errors).toBeFalsy();

    expect(res.data.awardsTotal.amount).toEqual(50);
    expect(res.data.awards.edges).toMatchObject([
      {
        node: {
          user: {
            id: '3-caq',
            name: 'Nimrod',
          },
          award: {
            name: 'Award 2',
            value: 10,
          },
          awardTransaction: {
            value: 30,
          },
        },
      },
      {
        node: {
          user: {
            id: '4-caq',
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
