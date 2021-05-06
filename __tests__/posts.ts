import { FastifyInstance } from 'fastify';
import { Connection, getConnection } from 'typeorm';
import { ApolloServer } from 'apollo-server-fastify';
import {
  ApolloServerTestClient,
  createTestClient,
} from 'apollo-server-testing';
import request from 'supertest';
import _ from 'lodash';
import { mocked } from 'ts-jest/utils';

import createApolloServer from '../src/apollo';
import { Context } from '../src/Context';
import {
  authorizeRequest,
  MockContext,
  saveFixtures,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import appFunc from '../src';
import {
  Bookmark,
  BookmarkList,
  Comment,
  HiddenPost,
  Post,
  PostTag,
  Source,
  SourceDisplay,
  Upvote,
  User,
  View,
} from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { sourceDisplaysFixture } from './fixture/sourceDisplay';
import { postsFixture, postTagsFixture } from './fixture/post';
import {
  notifyPostReport,
  notifyPostUpvoted,
  notifyPostUpvoteCanceled,
  notifyPostBannedOrRemoved,
} from '../src/common';
import { Roles } from '../src/roles';
import { getPostsIndex } from '../src/common';
import Mock = jest.Mock;
import { SearchIndex } from 'algoliasearch';
import { PostReport } from '../src/entity/PostReport';

let app: FastifyInstance;
let con: Connection;
let server: ApolloServer;
let client: ApolloServerTestClient;
let loggedUser: string = null;
let premiumUser = false;
let roles: Roles[] = [];
let deleteObjectMock: Mock;

jest.mock('../src/common', () => ({
  ...jest.requireActual('../src/common'),
  notifyPostReport: jest.fn(),
  notifyPostUpvoted: jest.fn(),
  notifyPostUpvoteCanceled: jest.fn(),
  notifyPostBannedOrRemoved: jest.fn(),
}));

jest.mock('../src/common/algolia', () => ({
  ...jest.requireActual('../src/common/algolia'),
  getPostsIndex: jest.fn(),
}));

beforeAll(async () => {
  con = await getConnection();
  server = await createApolloServer({
    context: (): Context =>
      new MockContext(con, loggedUser, premiumUser, roles),
    playground: false,
  });
  client = createTestClient(server);
  app = await appFunc();
  return app.ready();
});

beforeEach(async () => {
  loggedUser = null;
  premiumUser = false;
  roles = [];
  jest.resetAllMocks();

  deleteObjectMock = jest.fn();
  mocked(getPostsIndex).mockReturnValue(({
    deleteObject: deleteObjectMock,
  } as unknown) as SearchIndex);

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, SourceDisplay, sourceDisplaysFixture);
  await saveFixtures(con, Post, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' });
});

afterAll(() => app.close());

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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });

  it('should return the private representation', async () => {
    loggedUser = '1';
    const repo = con.getRepository(SourceDisplay);
    await repo.delete({ sourceId: 'a' });
    await repo.save({
      sourceId: 'a',
      name: 'Private A',
      image: 'https://private.com/a',
      userId: loggedUser,
    });
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });
});

describe('read field', () => {
  const QUERY = `{
    post(id: "p1") {
      read
    }
  }`;

  it('should return null when user is not logged in', async () => {
    const res = await client.query({ query: QUERY });
    expect(res.data.post.read).toEqual(null);
  });

  it('should return false when user did not read the post', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.data.post.bookmarked).toEqual(null);
  });

  it('should return false when user did not bookmark the post', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.data.post.bookmarkList).toEqual(null);
  });

  it('should return null when user is not premium', async () => {
    loggedUser = '1';
    await con.getRepository(Bookmark).save({
      postId: 'p1',
      userId: loggedUser,
      listId: list.id,
    });
    const res = await client.query({ query: QUERY });
    expect(res.data.post.bookmarkList).toEqual(null);
  });

  it('should return null when bookmark does not belong to a list', async () => {
    loggedUser = '1';
    premiumUser = true;
    await con.getRepository(Bookmark).save({
      postId: 'p1',
      userId: loggedUser,
    });
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.data.post.upvoted).toEqual(null);
  });

  it('should return false when user did not upvoted the post', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.data.post.commented).toEqual(null);
  });

  it('should return false when user did not commented the post', async () => {
    loggedUser = '1';
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.data.post.commented).toEqual(true);
  });
});

describe('featuredComments field', () => {
  const QUERY = `{
    post(id: "p1") {
      featuredComments { content, permalink, author { name, image } }
    }
  }`;

  it('should return empty array when no featured comments', async () => {
    const res = await client.query({ query: QUERY });
    const repo = con.getRepository(Comment);
    await repo.save({
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'My comment',
    });
    expect(res.data.post.featuredComments).toEqual([]);
  });

  it('should return array with the featured comments', async () => {
    const repo = con.getRepository(Comment);
    await repo.save({
      id: 'c1',
      postId: 'p1',
      userId: '1',
      content: 'My comment',
      featured: true,
    });
    const res = await client.query({ query: QUERY });
    expect(res.data.post.featuredComments).toMatchSnapshot();
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
    const res = await client.query({ query: QUERY });
    expect(res.data).toMatchSnapshot();
  });

  it('should return the author when set', async () => {
    await con
      .getRepository(User)
      .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
    await con.getRepository(Post).update('p1', { authorId: '1' });
    const res = await client.query({ query: QUERY });
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
    const res = await client.query({ query: QUERY });
    expect(res.errors).toBeFalsy();
    expect(res.data.post.views).toEqual(null);
  });

  it('should return views when the user is the author', async () => {
    loggedUser = '1';
    await con
      .getRepository(User)
      .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
    await con.getRepository(Post).update('p1', { authorId: '1', views: 200 });
    const res = await client.query({ query: QUERY });
    expect(res.errors).toBeFalsy();
    expect(res.data.post.views).toEqual(200);
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

  it('should return post by id', async () => {
    const res = await client.query({ query: QUERY('p1') });
    expect(res.data).toMatchSnapshot();
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Post).findOne('p1');
    expect(actual).toBeFalsy();
    expect(deleteObjectMock).toBeCalledWith('p1');
    expect(mocked(notifyPostBannedOrRemoved).mock.calls[0].slice(1)).toEqual([
      'p1',
    ]);
  });

  it('should do nothing if post is already deleted', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    await con.getRepository(Post).delete({ id: 'p1' });
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(deleteObjectMock).toBeCalledTimes(0);
    expect(notifyPostBannedOrRemoved).toBeCalledTimes(0);
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.banned).toEqual(true);
    expect(mocked(notifyPostBannedOrRemoved).mock.calls[0].slice(1)).toEqual([
      'p1',
    ]);
  });

  it('should do nothing if post is already banned', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    await con.getRepository(Post).update({ id: 'p1' }, { banned: true });
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    expect(notifyPostBannedOrRemoved).toBeCalledTimes(0);
  });
});

describe('mutation reportPost', () => {
  const MUTATION = `
  mutation ReportPost($id: ID!, $reason: ReportReason) {
  reportPost(id: $id, reason: $reason) {
    _
  }
}`;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', reason: 'BROKEN' },
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when cannot find post', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'invalid', reason: 'BROKEN' },
      },
      'NOT_FOUND',
    );
  });

  it('should report post', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1', reason: 'BROKEN' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOne('p1');
    expect(notifyPostReport).toBeCalledWith(
      loggedUser,
      post,
      '💔 Link is broken',
    );
    expect(await con.getRepository(PostReport).findOne()).toEqual({
      postId: 'p1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'BROKEN',
    });
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(HiddenPost);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1', reason: 'BROKEN' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
    expect(notifyPostReport).toBeCalledTimes(0);
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Upvote)
      .find({ select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(1);
    // Cannot use toBeCalledWith for because of logger for some reason
    expect(mocked(notifyPostUpvoted).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
    ]);
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Upvote);
    await repo.save({ postId: 'p1', userId: loggedUser });
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await repo.find({
      select: ['postId', 'userId'],
    });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(0);
    expect(notifyPostUpvoted).toBeCalledTimes(0);
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
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Upvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(-1);
    expect(mocked(notifyPostUpvoteCanceled).mock.calls[0].slice(1)).toEqual([
      'p1',
      '1',
    ]);
  });

  it('should ignore if no upvotes', async () => {
    loggedUser = '1';
    const res = await client.mutate({
      mutation: MUTATION,
      variables: { id: 'p1' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Upvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOne('p1');
    expect(post.upvotes).toEqual(0);
    expect(notifyPostUpvoteCanceled).toBeCalledTimes(0);
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
      await authorizeRequest(request(app.server).post('/v1/posts/p1/report'))
        .send({ reason: 'broken' })
        .expect(204);
      const actual = await con
        .getRepository(HiddenPost)
        .find({ where: { userId: '1' }, select: ['postId', 'userId'] });
      expect(actual).toMatchSnapshot();
      const post = await con.getRepository(Post).findOne('p1');
      expect(notifyPostReport).toBeCalledWith('1', post, 'Link is broken');
    });
  });
});
