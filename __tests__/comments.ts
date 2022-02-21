import { CommentMention } from './../src/entity/CommentMention';
import { Connection, getConnection } from 'typeorm';
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
  Post,
  PostTag,
  Source,
  Comment,
  User,
  CommentUpvote,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture, postTagsFixture } from './fixture/post';
import { getMentionLink } from '../src/common/markdown';

let con: Connection;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;

beforeAll(async () => {
  con = await getConnection();
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
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con.getRepository(User).save(usersFixture);
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
  ]);
});

afterAll(() => disposeGraphQLTesting(state));

const saveCommentMentionFixtures = async (sampleAuthor = usersFixture[0]) => {
  const promises = usersFixture.map((user) =>
    con
      .getRepository(User)
      .update({ id: user.id }, { ...user, username: user.name }),
  );
  await Promise.all(promises);
  await con
    .getRepository(Post)
    .update({ id: 'p1' }, { ...postsFixture[0], authorId: sampleAuthor.id });
  await con.getRepository(CommentMention).save(
    usersFixture.map(({ id }) => ({
      commentId: 'c1',
      mentionedUserId: id,
    })),
  );
};

const commentFields =
  'id, content, contentHtml, createdAt, permalink, upvoted, author { id, name, image }';

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
    const res = await client.query(QUERY, { variables: { postId: 'p1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should fetch comments and sub-comments of a post with upvoted', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY, { variables: { postId: 'p1' } });
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
    const res = await client.query(QUERY, { variables: { userId: '1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query commentUpvotes', () => {
  const QUERY = `
  query commentUpvotes($id: String!) {
    commentUpvotes(id: $id) {
      edges {
        node {
          createdAt
          user {
            name
            username
            bio
            image
          }
        }
      }
    }
  }
  `;

  it('should return users that upvoted the comment by id in descending order', async () => {
    const commentUpvoteRepo = con.getRepository(CommentUpvote);
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await commentUpvoteRepo.save({
      userId: '1',
      commentId: 'c1',
      createdAt: createdAtOld,
    });
    await commentUpvoteRepo.save({
      userId: '2',
      commentId: 'c1',
      createdAt: createdAtNew,
    });

    const res = await client.query(QUERY, { variables: { id: 'c1' } });

    const [secondUpvote, firstUpvote] = res.data.commentUpvotes.edges;
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
    expect(new Date(secondUpvote.node.createdAt).getTime()).toBeGreaterThan(
      new Date(firstUpvote.node.createdAt).getTime(),
    );
  });
});

describe('query recommendedMentions', () => {
  const QUERY = `
    query RecommendedMentions($postId: String!, $query: String, $limit: Int) {
      recommendedMentions(postId: $postId, query: $query, limit: $limit) {
        name
        username
        image      
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testQueryErrorCode(
      client,
      { query: QUERY, variables: { postId: 'p1' } },
      'UNAUTHENTICATED',
    ));

  it('should return author and previously mentioned users if query is empty', async () => {
    loggedUser = '1';
    const author = usersFixture[4];
    await saveCommentMentionFixtures(author);

    const res = await client.query(QUERY, { variables: { postId: 'p1' } });
    expect(res.errors).toBeFalsy();
    expect(res.data.recommendedMentions.length).toEqual(5);
    expect(res.data.recommendedMentions[0].name).toEqual(author.name);
  });

  it('should return users with user or username starting with the query prioritizing previously mentioned ones', async () => {
    loggedUser = '1';
    await con.getRepository(User).save({
      id: 'sample',
      name: 'sample',
      username: 'sample',
      image: 'sample/image',
    });
    await saveCommentMentionFixtures();

    const res = await client.query(QUERY, {
      variables: { postId: 'p1', query: 's' },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.recommendedMentions.length).toEqual(3);
    expect(res.data.recommendedMentions[0]).not.toEqual('sample');
  });
});

describe('mutation commentOnPost', () => {
  const MUTATION = `
  mutation CommentOnPost($postId: ID!, $content: String!) {
  commentOnPost(postId: $postId, content: $content) {
    id, content
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
        variables: { postId: 'p1', content: '# my comment http://daily.dev' },
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
          postId: 'invalid',
          content: '# my comment http://daily.dev',
        },
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
        variables: { postId: 'p1', content: '# my comment http://daily.dev' },
      },
      'NOT_FOUND',
    );
  });

  it('should comment markdown on a post', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { postId: 'p1', content: '# my comment http://daily.dev' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).find({
      select: ['id', 'content', 'contentHtml', 'parentId'],
      order: { createdAt: 'DESC' },
      where: { postId: 'p1' },
    });
    expect(actual.length).toEqual(6);
    expect(actual[0]).toMatchSnapshot({
      id: expect.any(String),
      contentHtml: `<h1>my comment <a href=\"http://daily.dev\" target=\"_blank\" rel=\"noopener nofollow\">http://daily.dev</a></h1>\n`,
    });
    expect(res.data.commentOnPost.id).toEqual(actual[0].id);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(1);
  });

  it('should comment markdown on a post with user mention', async () => {
    loggedUser = '1';
    await saveCommentMentionFixtures();
    const res = await client.mutate(MUTATION, {
      variables: { postId: 'p1', content: '@Lee' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).find({
      select: ['id', 'content', 'contentHtml', 'parentId'],
      order: { createdAt: 'DESC' },
      where: { postId: 'p1' },
    });
    expect(actual.length).toEqual(6);
    expect(actual[0]).toMatchSnapshot({
      id: expect.any(String),
      contentHtml: `<p>${getMentionLink('Lee')}</p>\n`,
    });
    expect(res.data.commentOnPost.id).toEqual(actual[0].id);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(1);
  });

  it('should comment markdown but restrict mentioning ownself', async () => {
    loggedUser = '1';
    const mention = '@Ido';
    await saveCommentMentionFixtures();
    const res = await client.mutate(MUTATION, {
      variables: { postId: 'p1', content: mention },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Comment).find({
      select: ['id', 'content', 'contentHtml', 'parentId'],
      order: { createdAt: 'DESC' },
      where: { postId: 'p1' },
    });
    expect(actual.length).toEqual(6);
    expect(actual[0]).toMatchSnapshot({
      id: expect.any(String),
      contentHtml: `<p>${mention}</p>\n`,
    });
    expect(res.data.commentOnPost.id).toEqual(actual[0].id);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.comments).toEqual(1);
  });
});

describe('mutation commentOnComment', () => {
  const MUTATION = `
  mutation CommentOnComment($commentId: ID!, $content: String!) {
  commentOnComment(commentId: $commentId, content: $content) {
    id, content
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
        variables: {
          commentId: 'c1',
          content: '# my comment http://daily.dev',
        },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find parent comment', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          commentId: 'invalid',
          content: '# my comment http://daily.dev',
        },
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
        variables: {
          commentId: 'c1',
          content: '# my comment http://daily.dev',
        },
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
        variables: {
          commentId: 'c2',
          content: '# my comment http://daily.dev',
        },
      },
      'FORBIDDEN',
    );
  });

  it('should comment on a comment', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { content: '# my comment http://daily.dev', commentId: 'c1' },
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
    const res = await client.mutate(MUTATION, { variables: { id: 'c2' } });
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
    const res = await client.mutate(MUTATION, { variables: { id: 'c1' } });
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
    const res = await client.mutate(MUTATION, { variables: { id: 'c1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(CommentUpvote)
      .find({ select: ['commentId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(1);
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(CommentUpvote);
    await repo.save({ commentId: 'c1', userId: loggedUser });
    const res = await client.mutate(MUTATION, { variables: { id: 'c1' } });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      select: ['commentId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(0);
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
    const res = await client.mutate(MUTATION, { variables: { id: 'c1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(CommentUpvote).find();
    expect(actual).toEqual([]);
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(-1);
  });

  it('should ignore if no upvotes', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'c1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(CommentUpvote).find();
    expect(actual).toEqual([]);
    const comment = await con.getRepository(Comment).findOne('c1');
    expect(comment.upvotes).toEqual(0);
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
      'http://localhost:5002/posts/p1',
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
});
