import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import { MockContext, saveFixtures, testMutationErrorCode } from './helpers';
import appFunc from '../src';
import { mocked } from 'ts-jest/utils';
import {
  notifyPostCommented,
  notifyCommentCommented,
  notifyCommentUpvoted,
  notifyCommentUpvoteCanceled,
} from '../src/common';
import {
  Post,
  PostTag,
  Source,
  SourceDisplay,
  Comment,
  User,
  CommentUpvote,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { sourceDisplaysFixture } from './fixture/sourceDisplay';
import { postsFixture, postTagsFixture } from './fixture/post';

let app: FastifyInstance;
let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  notifyPostCommented: jest.fn(),
  notifyCommentCommented: jest.fn(),
  notifyCommentUpvoted: jest.fn(),
  notifyCommentUpvoteCanceled: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context => new MockContext(con, loggedUser, false),
    playground: false,
  });
  client = createTestClient(server);
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  loggedUser = null;
  jest.resetAllMocks();

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con.getRepository(User).save([
    { id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' },
    { id: '2', name: 'Tsahi', image: 'https://daily.dev/tsahi.jpg' },
    { id: '3', name: 'Nimrod', image: 'https://daily.dev/nimrod.jpg' },
  ]);
  await con.getRepository(Comment).save([
    {
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'parent comment',
      createdAt: new Date(2020, 1, 6, 0, 0),
    },
    {
      id: 'c2',
      parentId: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'child comment',
      createdAt: new Date(2020, 1, 7, 0, 0),
    },
    {
      id: 'c3',
      postId: 'p1',
      userId: '2',
      content: 'parent comment #2',
      createdAt: new Date(2020, 1, 8, 0, 0),
    },
    {
      id: 'c4',
      postId: 'p2',
      userId: '3',
      content: 'parent comment #3',
      createdAt: new Date(2020, 1, 9, 0, 0),
    },
    {
      id: 'c5',
      postId: 'p2',
      parentId: 'c4',
      userId: '1',
      content: 'child comment #2',
      createdAt: new Date(2020, 1, 10, 0, 0),
    },
    {
      id: 'c6',
      postId: 'p1',
      userId: '3',
      content: 'parent comment #4',
      createdAt: new Date(2020, 1, 9, 0, 0),
    },
    {
      id: 'c7',
      postId: 'p1',
      parentId: 'c6',
      userId: '2',
      content: 'child comment #3',
      createdAt: new Date(2020, 1, 10, 0, 0),
    },
  ]);
});

afterAll(() => app.close());

const commentFields =
  'id, content, createdAt, permalink, upvoted, author { id, name, image }';

describe('query postComments', () => {
  const QUERY = `query PostComments($postId: ID!, $after: String, $first: Int) {
  postComments(postId: $postId, after: $after, first: $first) {
    pageInfo { endCursor, hasNextPage }
    edges { node {
      ${commentFields}
      children {
        pageInfo { endCursor, hasNextPage }
        edges { node { ${commentFields} } }
      }
    } }
  }
  }`;

  beforeEach(async () => {
    await con.getRepository(CommentUpvote).save([
      { commentId: 'c1', userId: '1' },
      { commentId: 'c7', userId: '1' },
      { commentId: 'c2', userId: '2' },
    ]);
  });

  it('should fetch comments and sub-comments of a post', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { postId: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should fetch comments and sub-comments of a post with upvoted', async () => {
    loggedUser = '1';
    const res = await client.query({
      query: QUERY,
      variables: { postId: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query userComments', () => {
  const QUERY = `query UserComments($userId: ID!, $after: String, $first: Int) {
  userComments(userId: $userId, after: $after, first: $first) {
    pageInfo { endCursor, hasNextPage }
    edges { node {
      ${commentFields}
    } }
  }
  }`;

  it('should fetch comments by user id', async () => {
    const res = await client.query({
      query: QUERY,
      variables: { userId: '1' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('mutation commentOnPost', () => {
  const MUTATION = `
  mutation CommentOnPost($postId: ID!, $content: String!) {
  commentOnPost(postId: $postId, content: $content) {
    id, content
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { postId: 'p1', content: 'my comment' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { postId: 'invalid', content: 'my comment' },
      },
      'NOT_FOUND',
    );
  });

  it('should throw not found when cannot find user', () => {
    loggedUser = '10';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { postId: 'p1', content: 'my comment' },
      },
      'NOT_FOUND',
    );
  });

  it('should comment on a post', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { postId: 'p1', content: 'my comment' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).find({
      select: ['id', 'content', 'parentId'],
      order: { createdAt: 'DESC' },
      where: { postId: 'p1' },
    });
    expect(actual.length).toEqual(6);
    expect(actual[0]).toMatchSnapshot({ id: expect.any(String) });
    expect(res.data.commentOnPost.id).toEqual(actual[0].id);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(1);
    // Cannot use toBeCalledWith for because of logger for some reason
    expect(mocked(notifyPostCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      actual[0].id,
    ]);
  });
});

describe('mutation commentOnComment', () => {
  const MUTATION = `
  mutation CommentOnComment($commentId: ID!, $content: String!) {
  commentOnComment(commentId: $commentId, content: $content) {
    id, content
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { commentId: 'c1', content: 'my comment' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find parent comment', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { commentId: 'invalid', content: 'my comment' },
      },
      'NOT_FOUND',
    );
  });

  it('should throw not found when cannot find user', () => {
    loggedUser = '10';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { commentId: 'c1', content: 'my comment' },
      },
      'NOT_FOUND',
    );
  });

  it('should throw error when commenting on a sub-comment', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { commentId: 'c2', content: 'my comment' },
      },
      'FORBIDDEN',
    );
  });

  it('should comment on a comment', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { content: 'my comment', commentId: 'c1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).find({
      select: ['id', 'content', 'parentId', 'postId', 'comments'],
      order: { createdAt: 'DESC' },
      where: { postId: 'p1' },
    });
    expect(actual.length).toEqual(6);
    expect(actual[0]).toMatchSnapshot({ id: expect.any(String) });
    expect(res.data.commentOnComment.id).toEqual(actual[0].id);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(1);
    expect(actual.find((c) => c.id === 'c1').comments).toEqual(1);
    // Cannot use toBeCalledWith for because of logger for some reason
    expect(mocked(notifyCommentCommented).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
      'c1',
      actual[0].id,
    ]);
  });
});

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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'c2' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Comment)
      .find({ select: ['id', 'comments'], where: { postId: 'p1' } });
    expect(actual.length).toEqual(4);
    expect(actual.find((c) => c.id === 'c1').comments).toEqual(-1);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(-1);
  });

  it('should delete a comment and its children', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'c1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).find({ postId: 'p1' });
    expect(actual.length).toEqual(3);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(-2);
  });
});

describe('mutation upvoteComment', () => {
  const MUTATION = `
  mutation Upvote($id: ID!) {
  upvoteComment(id: $id) {
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

  it('should throw not found when cannot find user', () => {
    loggedUser = '10';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'c1' },
      },
      'NOT_FOUND',
    );
  });

  it('should upvote comment', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'c1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(CommentUpvote)
      .find({ select: ['commentId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(1);
    // Cannot use toBeCalledWith for because of logger for some reason
    expect(mocked(notifyCommentUpvoted).mock.calls[0].slice(1)).toEqual([
      'c1',
      '1',
    ]);
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(CommentUpvote);
    await repo.save({ commentId: 'c1', userId: loggedUser });
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'c1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      select: ['commentId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(0);
    expect(notifyCommentUpvoted).toBeCalledTimes(0);
  });
});

describe('mutation cancelCommentUpvote', () => {
  const MUTATION = `
  mutation CancelUpvote($id: ID!) {
  cancelCommentUpvote(id: $id) {
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

  it('should cancel comment upvote', async () => {
    loggedUser = '1';
    const repo = con.getRepository(CommentUpvote);
    await repo.save({ commentId: 'c1', userId: loggedUser });
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'c1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(CommentUpvote).find();
    expect(actual).toEqual([]);
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(-1);
    expect(mocked(notifyCommentUpvoteCanceled).mock.calls[0].slice(1)).toEqual([
      'c1',
      '1',
    ]);
  });

  it('should ignore if no upvotes', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'c1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(CommentUpvote).find();
    expect(actual).toEqual([]);
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(0);
    expect(notifyCommentUpvoteCanceled).toBeCalledTimes(0);
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { postId: 'p1', content: 'my comment' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.commentOnPost.permalink).toEqual(
      'http://localhost:5002/posts/p1',
    );
  });
});
