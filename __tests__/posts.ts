import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import request from 'supertest';
import _ from 'lodash';
import {
  authorizeRequest,
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
  Bookmark,
  BookmarkList,
  Comment,
  HiddenPost,
  Post,
  PostTag,
  Source,
  Upvote,
  User,
  View,
  PostReport,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { postsFixture, postTagsFixture } from './fixture/post';
import { Roles } from '../src/roles';

let app: FastifyInstance;
let con: Connection;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
let premiumUser = false;
let roles: Roles[] = [];

beforeAll(async () => {
  con = await getConnection();
  state = await initializeGraphQLTesting(
    () => new MockContext(con, loggedUser, premiumUser, roles),
  );
  client = state.client;
  app = state.app;
});

beforeEach(async () => {
  loggedUser = null;
  premiumUser = false;
  roles = [];
  jest.resetAllMocks();

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' });
});

afterAll(() => disposeGraphQLTesting(state));

describe('image fields', () => {
  const QUERY = `{
    post(id: "image") {
      image
      placeholder
      ratio
    }
  }`;

  it('should return default image when no image exists', async () => {
    const repo = con.getRepository(Post);
    await repo.save(
      repo.create({
        id: 'image',
        shortId: 'image',
        title: 'No image',
        url: 'http://noimage.com',
        score: 0,
        sourceId: 'a',
        createdAt: new Date(2020, 4, 4, 19, 35),
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return post image when exists', async () => {
    const repo = con.getRepository(Post);
    await repo.save(
      repo.create({
        id: 'image',
        shortId: 'image',
        title: 'Image',
        url: 'http://post.com',
        score: 0,
        sourceId: 'a',
        createdAt: new Date(2020, 4, 4, 19, 35),
        image: 'http://image.com',
        placeholder: 'data:image/jpeg;base64,placeholder',
        ratio: 0.5,
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });
});

describe('source field', () => {
  const QUERY = `{
    post(id: "p1") {
      source {
        id
        name
        image
        public
      }
    }
  }`;

  it('should return the public representation', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  // it('should return the private representation', async () => {
  //   loggedUser = '1';
  //   const repo = con.getRepository(SourceDisplay);
  //   await repo.delete({ sourceId: 'a' });
  //   await repo.save({
  //     sourceId: 'a',
  //     name: 'Private A',
  //     image: 'https://private.com/a',
  //     userId: loggedUser,
  //   });
  //   const res = await client.query(QUERY);
  //   expect(res.data).toMatchSnapshot();
  // });
});

describe('read field', () => {
  const QUERY = `{
    post(id: "p1") {
      read
    }
  }`;

  it('should return null when user is not logged in', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.read).toEqual(null);
  });

  it('should return false when user did not read the post', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.data.post.read).toEqual(false);
  });

  it('should return true when user did read the post', async () => {
    loggedUser = '1';
    const repo = con.getRepository(View);
    await repo.save(
      repo.create({
        postId: 'p1',
        userId: loggedUser,
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data.post.read).toEqual(true);
  });
});

describe('bookmarked field', () => {
  const QUERY = `{
    post(id: "p1") {
      bookmarked
    }
  }`;

  it('should return null when user is not logged in', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarked).toEqual(null);
  });

  it('should return false when user did not bookmark the post', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarked).toEqual(false);
  });

  it('should return true when user did bookmark the post', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Bookmark);
    await repo.save(
      repo.create({
        postId: 'p1',
        userId: loggedUser,
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarked).toEqual(true);
  });
});

describe('bookmarkList field', () => {
  const QUERY = `{
    post(id: "p1") {
      bookmarkList {
        id
        name
      }
    }
  }`;

  let list;

  beforeEach(async () => {
    list = await con
      .getRepository(BookmarkList)
      .save({ name: 'my list', userId: '1' });
  });

  it('should return null when user is not logged in', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarkList).toEqual(null);
  });

  it('should return null when user is not premium', async () => {
    loggedUser = '1';
    await con.getRepository(Bookmark).save({
      postId: 'p1',
      userId: loggedUser,
      listId: list.id,
    });
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarkList).toEqual(null);
  });

  it('should return null when bookmark does not belong to a list', async () => {
    loggedUser = '1';
    premiumUser = true;
    await con.getRepository(Bookmark).save({
      postId: 'p1',
      userId: loggedUser,
    });
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarkList).toEqual(null);
  });

  it('should return the bookmark list', async () => {
    loggedUser = '1';
    premiumUser = true;
    await con.getRepository(Bookmark).save({
      postId: 'p1',
      userId: loggedUser,
      listId: list.id,
    });
    const res = await client.query(QUERY);
    expect(res.data.post.bookmarkList).toEqual({
      id: list.id,
      name: list.name,
    });
  });
});

describe('permalink field', () => {
  const QUERY = `{
    post(id: "p1") {
      permalink
    }
  }`;

  it('should return permalink of the post', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.permalink).toEqual('http://localhost:4000/r/sp1');
  });
});

describe('commentsPermalink field', () => {
  const QUERY = `{
    post(id: "p1") {
      commentsPermalink
    }
  }`;

  it('should return permalink of the post', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.commentsPermalink).toEqual(
      'http://localhost:5002/posts/p1',
    );
  });
});

describe('upvoted field', () => {
  const QUERY = `{
    post(id: "p1") {
      upvoted
    }
  }`;

  it('should return null when user is not logged in', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.upvoted).toEqual(null);
  });

  it('should return false when user did not upvoted the post', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.data.post.upvoted).toEqual(false);
  });

  it('should return true when user did upvoted the post', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Upvote);
    await repo.save(
      repo.create({
        postId: 'p1',
        userId: loggedUser,
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data.post.upvoted).toEqual(true);
  });
});

describe('commented field', () => {
  const QUERY = `{
    post(id: "p1") {
      commented
    }
  }`;

  it('should return null when user is not logged in', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.commented).toEqual(null);
  });

  it('should return false when user did not commented the post', async () => {
    loggedUser = '1';
    const res = await client.query(QUERY);
    expect(res.data.post.commented).toEqual(false);
  });

  it('should return true when user did commented the post', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Comment);
    await repo.save(
      repo.create({
        id: 'c1',
        postId: 'p1',
        userId: loggedUser,
        content: 'My comment',
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data.post.commented).toEqual(true);
  });
});

describe('author field', () => {
  const QUERY = `{
    post(id: "p1") {
      author {
        id
        name
      }
    }
  }`;

  it('should return null when author is not set', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return the author when set', async () => {
    await con
      .getRepository(User)
      .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
    await con.getRepository(Post).update('p1', { authorId: '1' });
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });
});

describe('views field', () => {
  const QUERY = `{
    post(id: "p1") {
      views
    }
  }`;

  it('should return null when the user is not the author', async () => {
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.post.views).toEqual(null);
  });

  it('should return views when the user is the author', async () => {
    loggedUser = '1';
    await con
      .getRepository(User)
      .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
    await con.getRepository(Post).update('p1', { authorId: '1', views: 200 });
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.post.views).toEqual(200);
  });
});

describe('toc field', () => {
  const QUERY = `{
    post(id: "p1") {
      toc { text, id, children { text, id } }
    }
  }`;

  it('should return null when toc is not set', async () => {
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });

  it('should return the toc when set', async () => {
    await con.getRepository(Post).update('p1', {
      toc: [
        {
          text: 'Title 1',
          id: 'title-1',
          children: [{ text: 'Sub 1', id: 'sub-1' }],
        },
        { text: 'Title 2', id: 'title-2' },
      ],
    });
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('query post', () => {
  const QUERY = (id: string): string => `{
    post(id: "${id}") {
      id
      url
      title
      readTime
      tags
      source {
        id
        name
        image
        public
      }
    }
  }`;

  it('should throw not found when cannot find post', () =>
    testQueryErrorCode(client, { query: QUERY('notfound') }, 'NOT_FOUND'));

  it('should throw not found when post was soft deleted', async () => {
    await saveFixtures(con, Post, [
      {
        id: 'pdeleted',
        shortId: 'spdeleted',
        title: 'PDeleted',
        url: 'http://p8.com',
        score: 0,
        sourceId: 'a',
        createdAt: new Date('2021-09-22T07:15:51.247Z'),
        tagsStr: 'javascript,webdev',
        deleted: true,
      },
    ]);

    testQueryErrorCode(client, { query: QUERY('pdeleted') }, 'NOT_FOUND');
  });

  it('should return post by id', async () => {
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query postByUrl', () => {
  const QUERY = (url: string): string => `{
    postByUrl(url: "${url}") {
      id
      url
      title
    }
  }`;

  it('should throw not found when cannot find post', () =>
    testQueryErrorCode(client, { query: QUERY('notfound') }, 'NOT_FOUND'));

  it('should throw not found when post was soft deleted', async () => {
    await saveFixtures(con, Post, [
      {
        id: 'pdeleted',
        shortId: 'spdeleted',
        title: 'PDeleted',
        url: 'http://p8.com',
        canonicalUrl: 'http://p8.com',
        score: 0,
        sourceId: 'a',
        createdAt: new Date('2021-09-22T07:15:51.247Z'),
        tagsStr: 'javascript,webdev',
        deleted: true,
      },
    ]);

    testQueryErrorCode(client, { query: QUERY('http://p8.com') }, 'NOT_FOUND');
  });

  it('should return post by canonical', async () => {
    const res = await client.query(QUERY('http://p1c.com'));
    expect(res.data).toMatchSnapshot();
  });

  it('should return post by url', async () => {
    const res = await client.query(QUERY('http://p1.com'));
    expect(res.data).toMatchSnapshot();
  });
});

describe('query postUpvotes', () => {
  const QUERY = `
  query postUpvotes($id: String!) {
    postUpvotes(id: $id) {
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

  it('should return users that upvoted the post by id in descending order', async () => {
    const userRepo = con.getRepository(User);
    const upvoteRepo = con.getRepository(Upvote);
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await userRepo.save({
      id: '2',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
    });
    await upvoteRepo.save({
      userId: '1',
      postId: 'p1',
      createdAt: createdAtOld,
    });
    await upvoteRepo.save({
      userId: '2',
      postId: 'p1',
      createdAt: createdAtNew,
    });

    const res = await client.query(QUERY, { variables: { id: 'p1' } });

    const [secondUpvote, firstUpvote] = res.data.postUpvotes.edges;
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
    expect(new Date(secondUpvote.node.createdAt).getTime()).toBeGreaterThan(
      new Date(firstUpvote.node.createdAt).getTime(),
    );
  });
});

describe('mutation hidePost', () => {
  const MUTATION = `
  mutation HidePost($id: ID!) {
  hidePost(id: $id) {
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

  it('should hide the post', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(HiddenPost);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
  });
});

describe('mutation deletePost', () => {
  const MUTATION = `
  mutation DeletePost($id: ID!) {
  deletePost(id: $id) {
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

  it('should not authorize when not moderator', () => {
    loggedUser = '1';
    roles = [];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'FORBIDDEN',
    );
  });

  it('should delete the post', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Post).findOne('p1');
    expect(actual.deleted).toBeTruthy();
  });

  it('should do nothing if post is already deleted', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    await con.getRepository(Post).delete({ id: 'p1' });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
  });
});

describe('mutation banPost', () => {
  const MUTATION = `
  mutation BanPost($id: ID!) {
  banPost(id: $id) {
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

  it('should not authorize when not moderator', () => {
    loggedUser = '1';
    roles = [];
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'FORBIDDEN',
    );
  });

  it('should ban the post', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.banned).toEqual(true);
  });

  it('should do nothing if post is already banned', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    await con.getRepository(Post).update({ id: 'p1' }, { banned: true });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
  });
});

describe('mutation reportPost', () => {
  const MUTATION = `
  mutation ReportPost($id: ID!, $reason: ReportReason, $comment: String) {
  reportPost(id: $id, reason: $reason, comment: $comment) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', reason: 'BROKEN', comment: 'Test comment' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'invalid', reason: 'BROKEN', comment: 'Test comment' },
      },
      'NOT_FOUND',
    );
  });

  it('should report post with comment', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', reason: 'BROKEN', comment: 'Test comment' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    expect(await con.getRepository(PostReport).findOne()).toEqual({
      postId: 'p1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'BROKEN',
      comment: 'Test comment',
    });
  });

  it('should report post without comment', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', reason: 'BROKEN' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    expect(await con.getRepository(PostReport).findOne()).toEqual({
      postId: 'p1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'BROKEN',
      comment: null,
    });
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(HiddenPost);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', reason: 'BROKEN', comment: 'Test comment' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
  });
});

describe('mutation upvote', () => {
  const MUTATION = `
  mutation Upvote($id: ID!) {
  upvote(id: $id) {
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
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'NOT_FOUND',
    );
  });

  it('should upvote post', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Upvote)
      .find({ select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(1);
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Upvote);
    await repo.save({ postId: 'p1', userId: loggedUser });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(0);
  });
});

describe('mutation cancelUpvote', () => {
  const MUTATION = `
  mutation CancelUpvote($id: ID!) {
  cancelUpvote(id: $id) {
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

  it('should cancel post upvote', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Upvote);
    await repo.save({ postId: 'p1', userId: loggedUser });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Upvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(-1);
  });

  it('should ignore if no upvotes', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Upvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(0);
  });
});

describe('compatibility routes', () => {
  describe('GET /posts/:id', () => {
    it('should throw not found when cannot find post', () =>
      request(app.server).get('/v1/posts/invalid').send().expect(404));

    it('should return post by id', async () => {
      const res = await request(app.server)
        .get('/v1/posts/p1')
        .send()
        .expect(200);
      expect(_.pick(res.body, ['id'])).toMatchSnapshot();
    });

    it('should return private post by id', async () => {
      const res = await request(app.server)
        .get('/v1/posts/p6')
        .send()
        .expect(200);
      expect(_.pick(res.body, ['id'])).toMatchSnapshot();
    });

    it('should return post by short id', async () => {
      const res = await request(app.server)
        .get('/v1/posts/sp1')
        .send()
        .expect(200);
      expect(_.pick(res.body, ['id'])).toMatchSnapshot();
    });
  });

  describe('POST /posts/:id/hide', () => {
    it('should hide the post', async () => {
      loggedUser = '1';
      await authorizeRequest(request(app.server).post('/v1/posts/p1/hide'))
        .send()
        .expect(204);
      const actual = await con
        .getRepository(HiddenPost)
        .find({ where: { userId: '1' }, select: ['postId', 'userId'] });
      expect(actual).toMatchSnapshot();
    });
  });

  describe('POST /posts/:id/report', () => {
    it('should return bad request when no body is provided', () =>
      authorizeRequest(request(app.server).post('/v1/posts/p1/report')).expect(
        400,
      ));

    it('should report the post', async () => {
      loggedUser = '1';
      await authorizeRequest(request(app.server).post('/v1/posts/p1/report'))
        .send({ reason: 'broken' })
        .expect(204);
      const actual = await con
        .getRepository(HiddenPost)
        .find({ where: { userId: '1' }, select: ['postId', 'userId'] });
      expect(actual).toMatchSnapshot();
    });
  });
});
