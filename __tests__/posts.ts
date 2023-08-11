import { FastifyInstance } from 'fastify';
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
  testMutationError,
  testMutationErrorCode,
  testQueryErrorCode,
} from './helpers';
import {
  ArticlePost,
  Bookmark,
  BookmarkList,
  Comment,
  FreeformPost,
  HiddenPost,
  Post,
  PostMention,
  PostReport,
  PostTag,
  PostType,
  SharePost,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  UNKNOWN_SOURCE,
  Upvote,
  User,
  View,
  WelcomePost,
  Downvote,
  PostQuestion,
} from '../src/entity';
import { SourceMemberRoles, sourceRoleRank } from '../src/roles';
import { sourcesFixture } from './fixture/source';
import { postsFixture, postTagsFixture } from './fixture/post';
import { Roles } from '../src/roles';
import { DataSource, DeepPartial, In } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  postScraperOrigin,
  notifyContentRequested,
  notifyView,
  DEFAULT_POST_TITLE,
  pickImageUrl,
  createSquadWelcomePost,
  updateFlagsStatement,
} from '../src/common';
import { randomUUID } from 'crypto';
import nock from 'nock';
import { deleteKeysByPattern } from '../src/redis';
import { checkHasMention } from '../src/common/markdown';

jest.mock('../src/common/pubsub', () => ({
  ...(jest.requireActual('../src/common/pubsub') as Record<string, unknown>),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

let app: FastifyInstance;
let con: DataSource;
let state: GraphQLTestingState;
let client: GraphQLTestClient;
let loggedUser: string = null;
let premiumUser = false;
let roles: Roles[] = [];

beforeAll(async () => {
  con = await createOrGetConnection();
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
  jest.clearAllMocks();

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' });
  await con.getRepository(User).save({
    id: '2',
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
  });
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
};

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
    const repo = con.getRepository(ArticlePost);
    await repo.save({
      id: 'image',
      shortId: 'image',
      title: 'No image',
      url: 'http://noimage.com',
      score: 0,
      sourceId: 'a',
      createdAt: new Date(2020, 4, 4, 19, 35),
    });
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return post image when exists', async () => {
    const repo = con.getRepository(ArticlePost);
    await repo.save({
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
    });
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

describe('featuredComments field', () => {
  const QUERY = `{
    post(id: "p1") {
      featuredComments { content, permalink, author { name, image } }
    }
  }`;

  it('should return empty array when no featured comments', async () => {
    const res = await client.query(QUERY);
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
    const res = await client.query(QUERY);
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

describe('scout field', () => {
  const QUERY = `{
    post(id: "p1") {
      scout {
        id
        name
      }
      author {
        id
        name
      }
    }
  }`;

  it('should return null when scout is not set', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return the scout when set', async () => {
    await con
      .getRepository(User)
      .save([{ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' }]);
    await con.getRepository(Post).update('p1', { scoutId: '1' });
    const res = await client.query(QUERY);
    expect(res.data).toMatchSnapshot();
  });

  it('should return the scout and author correctly', async () => {
    await con.getRepository(User).save([
      { id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' },
      { id: '2', name: 'Lee', image: 'https://daily.dev/lee.jpg' },
    ]);
    await con.getRepository(Post).update('p1', { scoutId: '1', authorId: '2' });
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
    } as DeepPartial<ArticlePost>);
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
  });
});

describe('sharedPost field', () => {
  const QUERY = `{
    post(id: "ps") {
      sharedPost {
        id
        title
        createdAt
      }
    }
  }`;

  it('should return the share post properties', async () => {
    await con.getRepository(SharePost).save({
      id: 'ps',
      shortId: 'ps',
      sourceId: 'a',
      title: 'Shared post',
      sharedPostId: 'p1',
    });
    const res = await client.query(QUERY);
    expect(res.data).toEqual({
      post: {
        sharedPost: {
          id: 'p1',
          title: 'P1',
          createdAt: expect.any(String),
        },
      },
    });
  });
});

describe('type field', () => {
  const QUERY = `{
    post(id: "p1") {
      type
    }
  }`;

  it('should return the share post properties', async () => {
    const res = await client.query(QUERY);
    expect(res.data).toEqual({
      post: { type: PostType.Article },
    });
  });
});

describe('freeformPost type', () => {
  const QUERY = `{
    post(id: "ff") {
      type
      content
      contentHtml
    }
  }`;

  it('should return the freeform post properties', async () => {
    await con.getRepository(FreeformPost).save({
      id: 'ff',
      shortId: 'ff',
      sourceId: 'a',
      title: 'Freeform post',
      content: '#Test',
      contentHtml: '<h1>Test</h1>',
    });
    const res = await client.query(QUERY);
    expect(res.data).toEqual({
      post: {
        type: PostType.Freeform,
        content: '#Test',
        contentHtml: '<h1>Test</h1>',
      },
    });
  });
});

describe('welcomePost type', () => {
  const QUERY = `{
    post(id: "wp") {
      type
      content
      contentHtml
    }
  }`;

  it('should return the welcome post properties', async () => {
    await con.getRepository(WelcomePost).save({
      id: 'wp',
      shortId: 'wp',
      sourceId: 'a',
      title: 'Welcome post',
      content: '#Test',
      contentHtml: '<h1>Test</h1>',
    });
    const res = await client.query(QUERY);
    expect(res.data).toEqual({
      post: {
        type: PostType.Welcome,
        content: '#Test',
        contentHtml: '<h1>Test</h1>',
      },
    });
  });

  it('should add welcome post with showOnFeed as false by default', async () => {
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    const post = await createSquadWelcomePost(con, source, '1');
    expect(post.showOnFeed).toEqual(false);
    expect(post.flags.showOnFeed).toEqual(false);
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
    await saveFixtures(con, ArticlePost, [
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

    return testQueryErrorCode(
      client,
      { query: QUERY('pdeleted') },
      'NOT_FOUND',
    );
  });

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    await con.getRepository(Post).update({ id: 'p1' }, { private: true });
    return testQueryErrorCode(
      client,
      {
        query: QUERY('p1'),
      },
      'FORBIDDEN',
    );
  });

  it('should throw error when annonymous user tries to access post from source with members', async () => {
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    await con.getRepository(Post).update({ id: 'p1' }, { private: true });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Admin,
    });
    return testQueryErrorCode(
      client,
      {
        query: QUERY('p1'),
      },
      'FORBIDDEN',
    );
  });

  it('should throw error when non member tries to access post from source with members', async () => {
    loggedUser = '2';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    await con.getRepository(Post).update({ id: 'p1' }, { private: true });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Admin,
    });
    return testQueryErrorCode(
      client,
      {
        query: QUERY('p1'),
      },
      'FORBIDDEN',
    );
  });

  it('should return post by id', async () => {
    const res = await client.query(QUERY('p1'));
    expect(res.data).toMatchSnapshot();
  });

  it('should disallow access to post from public source for blocked members', async () => {
    loggedUser = '1';
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { type: SourceType.Squad, private: false });
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { private: false, sourceId: 'a' });
    await con.getRepository(SourceMember).save({
      sourceId: 'a',
      userId: '1',
      referralToken: 'rt2',
      role: SourceMemberRoles.Blocked,
    });

    return testQueryErrorCode(
      client,
      {
        query: QUERY('p1'),
      },
      'FORBIDDEN',
    );
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
    await saveFixtures(con, ArticlePost, [
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

    return testQueryErrorCode(
      client,
      { query: QUERY('http://p8.com') },
      'NOT_FOUND',
    );
  });

  it('should throw error when source is private', async () => {
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    await con.getRepository(Post).update({ id: 'p1' }, { private: true });
    return testQueryErrorCode(
      client,
      { query: QUERY('http://p1.com') },
      'FORBIDDEN',
    );
  });

  it('should return post by canonical', async () => {
    const res = await client.query(QUERY('http://p1c.com'));
    expect(res.data).toMatchSnapshot();
  });

  it('should return post by url', async () => {
    const res = await client.query(QUERY('http://p1.com'));
    expect(res.data).toMatchSnapshot();
  });

  it('should return post if query params attached', async () => {
    const res = await client.query(QUERY('http://p1.com?query=param'));
    expect(res.data).toMatchSnapshot();
  });

  it('should return post if query params on youtube link', async () => {
    await saveFixtures(con, ArticlePost, [
      {
        id: 'yt1',
        shortId: 'yt1',
        title: 'Youtube video',
        url: 'https://youtube.com/watch?v=123',
        score: 0,
        sourceId: 'a',
        createdAt: new Date('2021-09-22T07:15:51.247Z'),
        tagsStr: 'javascript,webdev',
        deleted: false,
      },
    ]);
    const res = await client.query(QUERY('https://youtube.com/watch?v=123'));
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

describe('query searchQuestionRecommendations', () => {
  const QUERY = `
    query SearchQuestionRecommendations {
      searchQuestionRecommendations {
        id
        question
        post {
          id
        }
      }
    }
  `;

  it('should throw error when user is not logged in', async () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return questions related to upvoted posts of user', async () => {
    loggedUser = '1';

    await con.getRepository(PostQuestion).save([
      { postId: postsFixture[0].id, question: 'Question 1' },
      { postId: postsFixture[1].id, question: 'Question 2' },
      { postId: postsFixture[2].id, question: 'Question 3' },
      { postId: postsFixture[3].id, question: 'Question 4' },
      { postId: postsFixture[4].id, question: 'Question 5' },
      { postId: postsFixture[5].id, question: 'Question 6' },
      { postId: postsFixture[6].id, question: 'Question 7' },
    ]);

    const otherUserUpvotes = [postsFixture[5].id, postsFixture[6].id];
    await con.getRepository(Upvote).save([
      { userId: '1', postId: postsFixture[0].id },
      { userId: '1', postId: postsFixture[1].id },
      { userId: '1', postId: postsFixture[2].id },
      { userId: '1', postId: postsFixture[3].id },
      { userId: '1', postId: postsFixture[4].id },
      { userId: '2', postId: otherUserUpvotes[0] },
      { userId: '2', postId: otherUserUpvotes[1] },
    ]);

    const res = await client.query(QUERY);

    expect(res.errors).toBeFalsy();
    const loggedUserOnly = res.data.searchQuestionRecommendations.every(
      ({ post }) => !otherUserUpvotes.includes(post.id),
    );
    expect(loggedUserOnly).toBeTruthy();

    const postIds = res.data.searchQuestionRecommendations.map(
      ({ post }) => post.id,
    );
    const loggedUserUpvotes = await con
      .getRepository(Upvote)
      .findBy({ postId: In(postIds), userId: loggedUser }); // verify every item is for the logged user
    expect(loggedUserUpvotes).toHaveLength(3);
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

describe('mutation unhidePost', () => {
  const MUTATION = `
    mutation UnhidePost($id: ID!) {
      unhidePost(id: $id) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'p1' } },
      'UNAUTHENTICATED',
    ));

  it('should unhide post', async () => {
    loggedUser = '1';
    const repo = con.getRepository(HiddenPost);
    await repo.save(repo.create({ postId: 'p1', userId: loggedUser }));
    const initial = await repo.findBy({ userId: loggedUser });
    expect(initial.length).toBeGreaterThan(0);
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await repo.findBy({ userId: loggedUser });
    expect(actual.length).toEqual(0);
  });
});

describe('mutation deletePost', () => {
  const MUTATION = `
    mutation DeletePost($id: ID!) {
      deletePost(id: $id) {
        _
      }
    }
  `;

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'UNAUTHENTICATED',
    ));

  it('should delete the post', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    await verifyPostDeleted('p1');
  });

  it('should do nothing if post is already deleted', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];
    await con.getRepository(Post).delete({ id: 'p1' });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
  });

  const createSharedPost = async (
    id = 'sp1',
    member: Partial<SourceMember> = {},
    authorId = '2',
  ) => {
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
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
        ...member,
      },
    ]);
    await con.getRepository(SharePost).save({
      ...post,
      id,
      shortId: `short-${id}`,
      sharedPostId: 'p1',
      authorId,
    });
  };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1' },
      },
      'UNAUTHENTICATED',
    ));

  it('should restrict when not a member of the squad', async () => {
    loggedUser = '1';
    await createSharedPost();

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'sp1' } },
      'FORBIDDEN',
    );
  });

  it('should restrict member deleting a post from a moderator', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Moderator });

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'sp1' } },
      'FORBIDDEN',
    );
  });

  it('should restrict member deleting a post from the admin', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Admin });

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id } },
      'FORBIDDEN',
    );
  });

  it('should restrict member deleting a post from other members', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id);

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id } },
      'FORBIDDEN',
    );
  });

  it('should allow member to delete their own shared post', async () => {
    loggedUser = '2';
    const id = 'sp1';
    await createSharedPost(id);
    await verifyPostDeleted(id);
  });

  const verifyPostDeleted = async (id: string) => {
    const res = await client.mutate(MUTATION, { variables: { id } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Post).findOneBy({ id });
    expect(actual.deleted).toBeTruthy();
  };

  it('should allow member to delete their own freeform post', async () => {
    loggedUser = '2';
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    const post = await createSquadWelcomePost(con, source, '2');
    await con
      .getRepository(Post)
      .update({ id: post.id }, { type: PostType.Freeform });
    await verifyPostDeleted(post.id);
  });

  it('should delete the welcome post by a moderator or an admin', async () => {
    loggedUser = '2';
    await con.getRepository(SourceMember).save({
      userId: '1',
      sourceId: 'a',
      role: SourceMemberRoles.Moderator,
      referralToken: randomUUID(),
    });
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    const post = await createSquadWelcomePost(con, source, '2');
    await verifyPostDeleted(post.id);
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '1', sourceId: 'a' },
        { role: SourceMemberRoles.Admin },
      );
    const welcome = await createSquadWelcomePost(con, source, '2');
    await con
      .getRepository(Post)
      .update({ id: welcome.id }, { type: PostType.Freeform });
    await verifyPostDeleted(welcome.id);
  });

  it('should delete the shared post from a member as a moderator', async () => {
    loggedUser = '2';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Moderator }, '1');
    await verifyPostDeleted(id);
  });

  it('should allow moderator deleting a post from other moderators', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Moderator });
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Moderator });

    await verifyPostDeleted(id);
  });

  it('should allow moderator deleting a post from the admin', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Admin });
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Moderator });

    await verifyPostDeleted(id);
  });

  it('should delete the shared post as an admin of the squad', async () => {
    loggedUser = '2';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Admin }, '1');
    await verifyPostDeleted(id);
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post.banned).toEqual(true);
    expect(post.flags.banned).toEqual(true);
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
  mutation ReportPost($id: ID!, $reason: ReportReason, $comment: String, $tags: [String]) {
  reportPost(id: $id, reason: $reason, comment: $comment, tags: $tags) {
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

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '1';
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', reason: 'BROKEN', comment: 'Test comment' },
      },
      'FORBIDDEN',
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
    expect(
      await con.getRepository(PostReport).findOneBy({ postId: 'p1' }),
    ).toEqual({
      postId: 'p1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'BROKEN',
      tags: null,
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
    expect(
      await con.getRepository(PostReport).findOneBy({ postId: 'p1' }),
    ).toEqual({
      postId: 'p1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'BROKEN',
      tags: null,
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

  it('should save all the irrelevant tags', async () => {
    loggedUser = '1';
    const tags = ['js', 'react'];
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', tags, reason: 'IRRELEVANT' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(HiddenPost)
      .find({ where: { userId: loggedUser }, select: ['postId', 'userId'] });
    expect(actual.length).toEqual(1);
    expect(
      await con.getRepository(PostReport).findOneBy({ postId: 'p1' }),
    ).toEqual({
      postId: 'p1',
      userId: '1',
      createdAt: expect.anything(),
      reason: 'IRRELEVANT',
      tags,
      comment: null,
    });
  });

  it('should throw an error if there is no irrelevant tags when the reason is IRRELEVANT', async () => {
    loggedUser = '1';

    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'p1', tags: [], reason: 'IRRELEVANT' },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'p1', reason: 'IRRELEVANT' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should save report if post is hidden already', async () => {
    loggedUser = '1';
    await con
      .getRepository(HiddenPost)
      .save(
        con
          .getRepository(HiddenPost)
          .create({ postId: 'p1', userId: loggedUser }),
      );
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', reason: 'BROKEN', comment: 'Test comment' },
    });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(PostReport).findOne({
      where: { userId: loggedUser },
      select: ['postId', 'userId'],
    });
    expect(actual).toEqual({
      postId: 'p1',
      userId: '1',
    });
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
    loggedUser = '3';
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

  it('should upvote post', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Upvote)
      .find({ select: ['postId', 'userId'] });
    expect(actual).toMatchSnapshot();
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post.upvotes).toEqual(1);
  });

  it('should remove downvote and hidden when upvoting', async () => {
    loggedUser = '1';
    await con
      .getRepository(Downvote)
      .save({ postId: 'p1', userId: loggedUser });
    await con
      .getRepository(HiddenPost)
      .save({ postId: 'p1', userId: loggedUser });

    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();

    const upvote = await con
      .getRepository(Downvote)
      .findOneBy({ postId: 'p1', userId: loggedUser });
    expect(upvote).toBeNull();
    const hiddenPost = await con
      .getRepository(HiddenPost)
      .findOneBy({ postId: 'p1', userId: loggedUser });
    expect(hiddenPost).toBeNull();
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post.upvotes).toEqual(0);
  });

  it('should ignore if no upvotes', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Upvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
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

describe('mutation sharePost', () => {
  const MUTATION = `
  mutation SharePost($sourceId: ID!, $id: ID!, $commentary: String) {
  sharePost(sourceId: $sourceId, id: $id, commentary: $commentary) {
    id
    titleHtml
  }
}`;

  const variables = {
    sourceId: 's1',
    id: 'p1',
    commentary: 'My comment',
  };

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: false,
      memberPostingRank: 0,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '1',
      referralToken: 'rt',
      role: SourceMemberRoles.Member,
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should share to squad', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const newId = res.data.sharePost.id;
    const post = await con.getRepository(SharePost).findOneBy({ id: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });

  it('should share to squad and trim the commentary', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, commentary: '  My comment  ' },
    });
    expect(res.errors).toBeFalsy();
    const newId = res.data.sharePost.id;
    const post = await con.getRepository(SharePost).findOneBy({ id: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });

  it('should share to squad without commentary', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, commentary: null },
    });
    expect(res.errors).toBeFalsy();
    const newId = res.data.sharePost.id;
    const post = await con.getRepository(SharePost).findOneBy({ id: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toBeNull();
  });

  it('should share to squad with mentioned users', async () => {
    loggedUser = '1';
    await con.getRepository(User).update({ id: '2' }, { username: 'lee' });
    const params = { ...variables };
    params.commentary = 'Test @lee @non-existent';
    const res = await client.mutate(MUTATION, { variables: params });
    expect(res.errors).toBeFalsy();
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ id: res.data.sharePost.id });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.titleHtml).toMatchSnapshot();
    const mentions = await con
      .getRepository(PostMention)
      .findOneBy({ mentionedUserId: '2', mentionedByUserId: '1' });
    expect(mentions).toBeTruthy();
  });

  it('should escape html content on the title', async () => {
    loggedUser = '1';
    await con.getRepository(User).update({ id: '2' }, { username: 'lee' });
    const params = { ...variables };
    params.commentary = `<style>html { color: red !important; }</style>`;
    const res = await client.mutate(MUTATION, { variables: params });
    expect(res.errors).toBeFalsy();
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ id: res.data.sharePost.id });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.titleHtml).toMatchSnapshot();
  });

  it('should throw error when sharing to non-squad', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 'a' } },
      'FORBIDDEN',
    );
  });

  it('should throw error when non-member share to squad', async () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 'a' } },
      'FORBIDDEN',
    );
  });

  it('should throw error when post does not exist', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, id: 'nope' } },
      'NOT_FOUND',
    );
  });

  it('should throw error for members if posting to squad is not allowed', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).update('s1', {
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });

    await testMutationError(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 's1' } },
      (errors) => {
        expect(errors.length).toEqual(1);
        expect(errors[0].extensions?.code).toEqual('FORBIDDEN');
        expect(errors[0]?.message).toEqual('Posting not allowed!');
      },
    );
  });

  it('should allow moderators to post when posting to squad is not allowed', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).update('s1', {
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).update(
      { sourceId: 's1', userId: '1' },
      {
        role: SourceMemberRoles.Moderator,
      },
    );

    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const newId = res.data.sharePost.id;
    const post = await con.getRepository(SharePost).findOneBy({ id: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });

  it('should allow admins to post when posting to squad is not allowed', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).update('s1', {
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).update(
      { sourceId: 's1', userId: '1' },
      {
        role: SourceMemberRoles.Admin,
      },
    );

    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const newId = res.data.sharePost.id;
    const post = await con.getRepository(SharePost).findOneBy({ id: newId });
    expect(post.authorId).toEqual('1');
    expect(post.sharedPostId).toEqual('p1');
    expect(post.title).toEqual('My comment');
  });
});

describe('mutation viewPost', () => {
  const MUTATION = `
  mutation ViewPost($id: ID!) {
  viewPost(id: $id) {
    _
  }
}`;

  const variables = {
    id: 'p1',
  };

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: true,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '1',
      referralToken: 'rt',
      role: SourceMemberRoles.Member,
    });
    await con.getRepository(Post).update({ id: 'p1' }, { sourceId: 's1' });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should throw not found when post does not exist', () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { id: 'nope' },
      },
      'NOT_FOUND',
    );
  });

  it('should throw error when user cannot access the post', async () => {
    loggedUser = '2';
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Share });
    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'FORBIDDEN',
    );
  });

  it('should submit view event', async () => {
    loggedUser = '1';
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Share });
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    expect(notifyView).toBeCalledTimes(1);
  });

  it('should should not submit view event for articles', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    expect(notifyView).toBeCalledTimes(0);
  });
});

describe('mutation submitExternalLink', () => {
  const MUTATION = `
  mutation SubmitExternalLink($sourceId: ID!, $url: String!, $commentary: String, $title: String, $image: String) {
  submitExternalLink(sourceId: $sourceId, url: $url, commentary: $commentary, title: $title, image: $image) {
    _
  }
}`;

  const variables: Record<string, string> = {
    sourceId: 's1',
    url: 'https://daily.dev',
    commentary: 'My comment',
  };

  beforeEach(async () => {
    await con.getRepository(SquadSource).save({
      id: 's1',
      handle: 's1',
      name: 'Squad',
      private: false,
      memberPostingRank: 0,
    });
    await con.getRepository(SourceMember).save({
      sourceId: 's1',
      userId: '1',
      referralToken: 'rt',
      role: SourceMemberRoles.Member,
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  const checkSharedPostExpectation = async (visible: boolean) => {
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const articlePost = await con
      .getRepository(ArticlePost)
      .findOneBy({ url: variables.url });
    expect(articlePost.url).toEqual('https://daily.dev');
    expect(articlePost.visible).toEqual(visible);

    expect(notifyContentRequested).toBeCalledTimes(1);
    expect(jest.mocked(notifyContentRequested).mock.calls[0].slice(1)).toEqual([
      { id: articlePost.id, url: variables.url, origin: articlePost.origin },
    ]);

    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost.id });
    expect(sharedPost.authorId).toEqual('1');
    expect(sharedPost.title).toEqual('My comment');
    expect(sharedPost.visible).toEqual(visible);
  };

  it('should share to squad without title to support backwards compatibility', async () => {
    await con.getRepository(Source).insert({
      id: UNKNOWN_SOURCE,
      handle: UNKNOWN_SOURCE,
      name: UNKNOWN_SOURCE,
    });
    loggedUser = '1';
    await checkSharedPostExpectation(false);
  });

  it('should share to squad and be visible automatically when title is available', async () => {
    await con.getRepository(Source).insert({
      id: UNKNOWN_SOURCE,
      handle: UNKNOWN_SOURCE,
      name: UNKNOWN_SOURCE,
    });
    loggedUser = '1';
    variables.title = 'Sample external link title';
    await checkSharedPostExpectation(true);
  });

  it('should share existing post to squad', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, url: 'http://p6.com' },
    });
    expect(res.errors).toBeFalsy();
    const articlePost = await con
      .getRepository(ArticlePost)
      .findOneBy({ url: 'http://p6.com' });
    expect(articlePost.url).toEqual('http://p6.com');
    expect(articlePost.visible).toEqual(true);
    expect(articlePost.id).toEqual('p6');

    expect(notifyContentRequested).toBeCalledTimes(0);

    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost.id });
    expect(sharedPost.authorId).toEqual('1');
    expect(sharedPost.title).toEqual('My comment');
    expect(sharedPost.visible).toEqual(true);
  });

  it('should share existing post to squad without commentary', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, url: 'http://p6.com', commentary: null },
    });
    expect(res.errors).toBeFalsy();
    const articlePost = await con
      .getRepository(ArticlePost)
      .findOneBy({ url: 'http://p6.com' });
    expect(articlePost.url).toEqual('http://p6.com');
    expect(articlePost.visible).toEqual(true);
    expect(articlePost.id).toEqual('p6');

    expect(notifyContentRequested).toBeCalledTimes(0);

    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost.id });
    expect(sharedPost.authorId).toEqual('1');
    expect(sharedPost.title).toBeNull();
    expect(sharedPost.visible).toEqual(true);
  });

  it('should throw error when sharing to non-squad', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 'a' } },
      'FORBIDDEN',
    );
  });

  it('should throw error when URL is not valid', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, url: 'a' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when post is existing but deleted', async () => {
    loggedUser = '1';
    await con.getRepository(Post).update('p6', { deleted: true });
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, url: 'http://p6.com' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should throw error when non-member share to squad', async () => {
    loggedUser = '2';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 'a' } },
      'FORBIDDEN',
    );
  });

  it('should throw error for members if posting to squad is not allowed', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).update('s1', {
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });

    await testMutationError(
      client,
      { mutation: MUTATION, variables: { ...variables, sourceId: 's1' } },
      (errors) => {
        expect(errors.length).toEqual(1);
        expect(errors[0].extensions?.code).toEqual('FORBIDDEN');
        expect(errors[0]?.message).toEqual('Posting not allowed!');
      },
    );
  });

  it('should allow moderators to share when posting to squad is not allowed', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).update('s1', {
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).update(
      { sourceId: 's1', userId: '1' },
      {
        role: SourceMemberRoles.Moderator,
      },
    );

    const res = await client.mutate(MUTATION, {
      variables: { ...variables, url: 'http://p6.com' },
    });
    expect(res.errors).toBeFalsy();
    const articlePost = await con
      .getRepository(ArticlePost)
      .findOneBy({ url: 'http://p6.com' });
    expect(articlePost.url).toEqual('http://p6.com');
    expect(articlePost.visible).toEqual(true);
    expect(articlePost.id).toEqual('p6');

    expect(notifyContentRequested).toBeCalledTimes(0);

    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost.id });
    expect(sharedPost.authorId).toEqual('1');
    expect(sharedPost.title).toEqual('My comment');
    expect(sharedPost.visible).toEqual(true);
  });

  it('should allow admins to share when posting to squad is not allowed', async () => {
    loggedUser = '1';
    await con.getRepository(SquadSource).update('s1', {
      memberPostingRank: sourceRoleRank[SourceMemberRoles.Moderator],
    });
    await con.getRepository(SourceMember).update(
      { sourceId: 's1', userId: '1' },
      {
        role: SourceMemberRoles.Admin,
      },
    );

    const res = await client.mutate(MUTATION, {
      variables: { ...variables, url: 'http://p6.com' },
    });
    expect(res.errors).toBeFalsy();
    const articlePost = await con
      .getRepository(ArticlePost)
      .findOneBy({ url: 'http://p6.com' });
    expect(articlePost.url).toEqual('http://p6.com');
    expect(articlePost.visible).toEqual(true);
    expect(articlePost.id).toEqual('p6');

    expect(notifyContentRequested).toBeCalledTimes(0);

    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost.id });
    expect(sharedPost.authorId).toEqual('1');
    expect(sharedPost.title).toEqual('My comment');
    expect(sharedPost.visible).toEqual(true);
  });

  it('should not make squad post visible if shared post is not yet ready and visible', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        url: 'http://p7.com',
        commentary: 'Share 1',
      },
    });
    expect(res.errors).toBeFalsy();
    const articlePost = await con
      .getRepository(ArticlePost)
      .findOneBy({ url: 'http://p7.com' });
    expect(articlePost?.url).toEqual('http://p7.com');
    expect(articlePost?.visible).toEqual(false);
    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost?.id, title: 'Share 1' });
    expect(sharedPost?.visible).toEqual(false);

    const res2 = await client.mutate(MUTATION, {
      variables: {
        ...variables,
        url: 'http://p7.com',
        commentary: 'Share 2',
      },
    });
    expect(res2.errors).toBeFalsy();
    const sharedPost2 = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: articlePost?.id, title: 'Share 2' });
    expect(sharedPost2?.visible).toEqual(false);
  });
});

describe('mutation checkLinkPreview', () => {
  const MUTATION = `
    mutation CheckLinkPreview($url: String!) {
      checkLinkPreview(url: $url) {
        id
        title
        image
      }
    }
  `;

  beforeEach(async () => {
    await deleteKeysByPattern('rateLimit:*');
  });

  const variables: Record<string, string> = { url: 'https://daily.dev' };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables,
      },
      'UNAUTHENTICATED',
    ));

  it('should return link preview if url not found', async () => {
    loggedUser = '1';

    const sampleResponse = {
      title: 'We updated our RSA SSH host key',
      image:
        'https://github.blog/wp-content/uploads/2021/12/github-security_orange-banner.png',
    };

    nock(postScraperOrigin)
      .post('/preview', { url: variables.url })
      .reply(200, sampleResponse);

    const res = await client.mutate(MUTATION, { variables });

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLinkPreview.title).toEqual(sampleResponse.title);
    expect(res.data.checkLinkPreview.image).toEqual(sampleResponse.image);
    expect(res.data.checkLinkPreview.id).toBeFalsy();
  });

  it('should rate limit getting link preview by 5', async () => {
    loggedUser = '1';

    const sampleResponse = {
      title: 'We updated our RSA SSH host key',
      image:
        'https://github.blog/wp-content/uploads/2021/12/github-security_orange-banner.png',
    };

    const mockRequest = () =>
      nock(postScraperOrigin)
        .post('/preview', { url: variables.url })
        .reply(200, sampleResponse);

    const limit = 20;
    for (let i = 0; i < Array(limit).length; i++) {
      mockRequest();
      const res = await client.mutate(MUTATION, { variables });
      expect(res.errors).toBeFalsy();
    }

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'RATE_LIMITED',
    );
  });

  it('should return link preview and image being the placeholder when empty', async () => {
    loggedUser = '1';

    const sampleResponse = { title: 'We updated our RSA SSH host key' };

    nock(postScraperOrigin)
      .post('/preview', { url: variables.url })
      .reply(200, sampleResponse);

    const res = await client.mutate(MUTATION, { variables });

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLinkPreview.title).toEqual(sampleResponse.title);
    expect(res.data.checkLinkPreview.image).toEqual(
      pickImageUrl({ createdAt: new Date() }),
    );
    expect(res.data.checkLinkPreview.id).toBeFalsy();
  });

  it('should return link preview image and default title when null', async () => {
    loggedUser = '1';

    const sampleResponse = { title: null };

    nock(postScraperOrigin)
      .post('/preview', { url: variables.url })
      .reply(200, sampleResponse);

    const res = await client.mutate(MUTATION, { variables });

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLinkPreview.title).toEqual(DEFAULT_POST_TITLE);
    expect(res.data.checkLinkPreview.image).toEqual(
      pickImageUrl({ createdAt: new Date() }),
    );
    expect(res.data.checkLinkPreview.id).toBeFalsy();
  });

  it('should return link preview image and default title when empty', async () => {
    loggedUser = '1';

    const sampleResponse = { title: '' };

    nock(postScraperOrigin)
      .post('/preview', { url: variables.url })
      .reply(200, sampleResponse);

    const res = await client.mutate(MUTATION, { variables });

    expect(res.errors).toBeFalsy();
    expect(res.data.checkLinkPreview.title).toEqual(DEFAULT_POST_TITLE);
    expect(res.data.checkLinkPreview.image).toEqual(
      pickImageUrl({ createdAt: new Date() }),
    );
    expect(res.data.checkLinkPreview.id).toBeFalsy();
  });

  it('should return post by canonical', async () => {
    loggedUser = '1';
    const url = 'http://p1c.com';
    const foundPost = await con
      .getRepository(ArticlePost)
      .findOneBy({ canonicalUrl: url });
    const res = await client.mutate(MUTATION, { variables: { url } });
    expect(res.data.checkLinkPreview).toBeTruthy();
    expect(res.data.checkLinkPreview.id).toEqual(foundPost.id);
  });

  it('should return post by url', async () => {
    loggedUser = '1';
    const url = 'http://p1.com';
    const foundPost = await con.getRepository(ArticlePost).findOneBy({ url });
    const res = await client.mutate(MUTATION, { variables: { url } });
    expect(res.data.checkLinkPreview).toBeTruthy();
    expect(res.data.checkLinkPreview.id).toEqual(foundPost.id);
  });
});

describe('mutation createFreeformPost', () => {
  const MUTATION = `
    mutation CreateFreeformPost($sourceId: ID!, $title: String!, $content: String!, $image: Upload) {
      createFreeformPost(sourceId: $sourceId, title: $title, content: $content, image: $image) {
        id
        author {
          id
        }
        source {
          id
        }
        title
        content
        contentHtml
        type
        private
      }
    }
  `;

  const params = {
    sourceId: 'a',
    title: 'This is a welcome post',
    content: 'Sample content',
  };

  beforeEach(async () => {
    await saveSquadFixtures();
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if title is an empty space', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, title: ' ' } },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if title exceeds 80 characters', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...params,
          title:
            'Hello World! Start your squad journey here - Hello World! Start your squad journey here',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if content exceeds 4000 characters', async () => {
    loggedUser = '1';

    const content = 'Hello World! Start your squad journey here';
    const sample = new Array(100).fill(content);

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...params,
          content: sample.join(' - '),
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return error if user is not part of the squad', async () => {
    loggedUser = '1';
    await con
      .getRepository(Source)
      .update({ id: 'b' }, { type: SourceType.Squad });

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...params, sourceId: 'b' } },
      'FORBIDDEN',
    );
  });

  it('should create a freeform post if all parameters have passed', async () => {
    loggedUser = '1';

    const content = '# Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { ...params, content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createFreeformPost.type).toEqual(PostType.Freeform);
    expect(res.data.createFreeformPost.author.id).toEqual('1');
    expect(res.data.createFreeformPost.source.id).toEqual('a');
    expect(res.data.createFreeformPost.title).toEqual(params.title);
    expect(res.data.createFreeformPost.content).toEqual(content);
    expect(res.data.createFreeformPost.contentHtml).toMatchSnapshot();
  });

  it('should set the post to be private if source is private', async () => {
    await con.getRepository(Source).update({ id: 'a' }, { private: true });
    loggedUser = '1';

    const content = '# Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { ...params, content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createFreeformPost.type).toEqual(PostType.Freeform);
    expect(res.data.createFreeformPost.private).toEqual(true);
  });

  it('should set the post to be public if source is public', async () => {
    await con.getRepository(Source).update({ id: 'a' }, { private: false });
    loggedUser = '1';

    const content = '# Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { ...params, content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createFreeformPost.type).toEqual(PostType.Freeform);
    expect(res.data.createFreeformPost.private).toEqual(false);
  });

  it('should handle markdown injections', async () => {
    loggedUser = '1';

    const content =
      '```\n```<style>body{background-color: blue!important}a,h1,h2{color: red!important}</style>\n```';
    const res = await client.mutate(MUTATION, {
      variables: { ...params, content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createFreeformPost.contentHtml).toEqual(
      '<pre><code>```<span class="hljs-tag">&lt;<span class="hljs-name">style</span>&gt;</span><span class="language-css"><span class="hljs-selector-tag">body</span>{<span class="hljs-attribute">background-color</span>: blue<span class="hljs-meta">!important</span>}<span class="hljs-selector-tag">a</span>,<span class="hljs-selector-tag">h1</span>,<span class="hljs-selector-tag">h2</span>{<span class="hljs-attribute">color</span>: red<span class="hljs-meta">!important</span>}</span><span class="hljs-tag">&lt;/<span class="hljs-name">style</span>&gt;</span>\n' +
        '</code></pre>\n',
    );
  });

  const args = {
    mentionedUserId: '2',
    mentionedByUserId: '1',
  };
  const setupMention = async (mutationParams: {
    title?: string;
    content?: string;
  }): Promise<FreeformPost> => {
    const before = await con.getRepository(PostMention).findOneBy(args);
    expect(before).toBeFalsy();
    await con.getRepository(User).update({ id: '2' }, { username: 'lee' });
    const res = await client.mutate(MUTATION, {
      variables: { ...params, ...mutationParams },
    });
    expect(res.errors).toBeFalsy();
    return res.data.createFreeformPost;
  };

  it('should allow mention as part of the content', async () => {
    loggedUser = '1';
    const content = 'Test @lee';
    const post = await setupMention({ content });
    const mention = await con
      .getRepository(PostMention)
      .findOneBy({ ...args, postId: post.id });
    expect(mention).toBeTruthy();
    expect(post.contentHtml).toMatchSnapshot();
  });

  it('should not allow mention outside of squad as part of the content being a freeform post', async () => {
    loggedUser = '1';
    const content = 'Test @sample';
    await con.getRepository(User).update({ id: '5' }, { username: 'sample' });
    const post = await setupMention({ content });
    const mention = await con
      .getRepository(PostMention)
      .findOneBy({ ...args, postId: post.id });
    expect(mention).toBeFalsy();
    expect(post.contentHtml).toMatchSnapshot();
  });

  // I was way too ahead of myself and forgot the mention comes in at v7 - so no need to test for now
  // it('should not allow mention as part of the title being a freeform post', async () => {
  //   loggedUser = '1';
  //   const title = 'Test @lee';
  //   const post = await setupMention({ title });
  //   const mention = await con
  //     .getRepository(PostMention)
  //     .findOneBy({ ...args, postId: post.id });
  //   expect(mention).toBeFalsy();
  //   expect(post.titleHtml).toMatchSnapshot();
  // });
});

describe('mutation editPost', () => {
  const MUTATION = `
    mutation EditPost($id: ID!, $title: String, $content: String, $image: Upload) {
      editPost(id: $id, title: $title, content: $content, image: $image) {
        id
        title
        content
        contentHtml
        type
      }
    }
  `;

  const params = {
    id: 'p1',
    title: 'This is a welcome post',
  };

  beforeEach(async () => {
    await saveSquadFixtures();
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if post type is not allowed to be editable', async () => {
    loggedUser = '1';
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Share });

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'FORBIDDEN',
    );

    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Article });

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'FORBIDDEN',
    );
  });

  it('should return an error if title exceeds 80 characters', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...params,
          title:
            'Hello World! Start your squad journey here - Hello World! Start your squad journey here',
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should return an error if content exceeds 4000 characters', async () => {
    loggedUser = '1';

    const content = 'Hello World! Start your squad journey here';
    const sample = new Array(100).fill(content);

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...params,
          content: sample.join(' - '),
        },
      },
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('should restrict member when user is not the author of the post', async () => {
    loggedUser = '2';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { id: 'p1', title: 'Test' } },
      'FORBIDDEN',
    );
  });

  it('should update title of the post if it is either freeform or welcome post', async () => {
    loggedUser = '1';
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Freeform });
    const title = 'Updated title';
    const res1 = await client.mutate(MUTATION, {
      variables: { id: 'p1', title },
    });
    expect(res1.errors).toBeFalsy();
    expect(res1.data.editPost.title).toEqual(title);

    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Welcome, title: 'Test' });

    const res2 = await client.mutate(MUTATION, {
      variables: { id: 'p1', title },
    });
    expect(res2.errors).toBeFalsy();
    expect(res2.data.editPost.title).toEqual(title);
  });

  it('should not allow moderator or admin to do update posts of other people', async () => {
    loggedUser = '1';
    await con
      .getRepository(Post)
      .update({ id: 'p1' }, { type: PostType.Freeform, authorId: '2' });
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '1', sourceId: 'a' },
        { role: SourceMemberRoles.Moderator },
      );
    const title = 'Updated title';
    await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...params, title },
      },
      'FORBIDDEN',
    );

    await con
      .getRepository(SourceMember)
      .update(
        { userId: '1', sourceId: 'a' },
        { role: SourceMemberRoles.Admin },
      );

    return await testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: { ...params, title },
      },
      'FORBIDDEN',
    );
  });

  it('should allow moderator to do update of welcome posts', async () => {
    loggedUser = '2';

    await con
      .getRepository(SourceMember)
      .update(
        { userId: '2', sourceId: 'a' },
        { role: SourceMemberRoles.Moderator },
      );

    const content = 'Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', content: content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.editPost.content).toEqual(content);
  });

  it('should allow admin to do update of welcome post', async () => {
    loggedUser = '2';

    await con
      .getRepository(SourceMember)
      .update(
        { userId: '2', sourceId: 'a' },
        { role: SourceMemberRoles.Admin },
      );

    const content = 'Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', content: content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.editPost.content).toEqual(content);
  });

  it('should allow author to update their freeform post', async () => {
    loggedUser = '1';

    const content = '# Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', content: content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.editPost.contentHtml).toMatchSnapshot();
  });

  it('should allow mention as part of the content', async () => {
    loggedUser = '1';
    const params = {
      mentionedUserId: '2',
      mentionedByUserId: '1',
      postId: 'p1',
    };
    const before = await con.getRepository(PostMention).findOneBy(params);
    expect(before).toBeFalsy();
    await con.getRepository(User).update({ id: '2' }, { username: 'lee' });
    const content = 'Test @lee';
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', content: content },
    });
    expect(res.errors).toBeFalsy();
    const mention = await con.getRepository(PostMention).findOneBy(params);
    expect(mention).toBeTruthy();
    expect(res.data.editPost.contentHtml).toMatchSnapshot();
  });

  it('should not throw if no changes are made to post during edit mutation', async () => {
    loggedUser = '2';

    await con.getRepository(WelcomePost).save({
      id: 'wp',
      shortId: 'wp',
      sourceId: 'a',
      title: 'Welcome post',
      content: '#Test',
      contentHtml: '<h1>Test</h1>',
    });
    await con
      .getRepository(SourceMember)
      .update(
        { userId: '2', sourceId: 'a' },
        { role: SourceMemberRoles.Admin },
      );

    const res = await client.mutate(MUTATION, {
      variables: {
        id: 'wp',
        content: '#Test',
      },
    });
    expect(res.errors).toBeFalsy();
  });
});

describe('mutation promoteToPublic', () => {
  const MUTATION = `
    mutation PromoteToPublic($id: ID!) {
      promoteToPublic(id: $id) {
        _
      }
    }
  `;

  const params = { id: 'p1' };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if user is not a system moderator', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'FORBIDDEN',
    );
  });

  it('should promote post to public', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];

    await client.mutate(MUTATION, {
      variables: params,
    });

    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    const sixDays = new Date();
    sixDays.setDate(sixDays.getDate() + 6);
    const timeToSeconds = Math.floor(sixDays.valueOf() / 1000);
    expect(`${post.flags.promoteToPublic}`.length).toEqual(10);
    expect(post.flags.promoteToPublic).toBeGreaterThan(timeToSeconds);
  });
});

describe('mutation demoteFromPublic', () => {
  const MUTATION = `
    mutation DemoteFromPublic($id: ID!) {
      demoteFromPublic(id: $id) {
        _
      }
    }
  `;

  const params = { id: 'p1' };

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if user is not a system moderator', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'FORBIDDEN',
    );
  });

  it('should demote post from public', async () => {
    loggedUser = '1';
    roles = [Roles.Moderator];

    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        flags: updateFlagsStatement<Post>({
          promoteToPublic: 1690552747,
        }),
      },
    );

    await client.mutate(MUTATION, {
      variables: params,
    });

    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post.flags.promoteToPublic).toEqual(null);
  });
});

describe('mutation updatePinPost', () => {
  const MUTATION = `
    mutation UpdatePinPost($id: ID!, $pinned: Boolean!) {
      updatePinPost(id: $id, pinned: $pinned) {
        _
      }
    }
  `;

  const params = { id: 'p1', pinned: false };

  beforeEach(async () => {
    await saveSquadFixtures();
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'UNAUTHENTICATED',
    ));

  it('should return an error if user is not a moderator or an admin', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: params },
      'FORBIDDEN',
    );
  });

  it('should update pinnedAt property based on the parameter if user is admin or moderator', async () => {
    loggedUser = '1';

    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Admin });

    const getPost = () => con.getRepository(Post).findOneBy({ id: 'p1' });

    const unpinned = await getPost();
    expect(unpinned.pinnedAt).toBeNull();

    await client.mutate(MUTATION, {
      variables: { id: 'p1', pinned: true },
    });

    const pinned = await getPost();
    expect(pinned.pinnedAt).not.toBeNull();

    await client.mutate(MUTATION, {
      variables: { id: 'p1', pinned: false },
    });

    const unpinnedAgain = await getPost();
    expect(unpinnedAgain.pinnedAt).toBeNull();

    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Moderator });

    await client.mutate(MUTATION, {
      variables: { id: 'p1', pinned: true },
    });

    const pinnedAgain = await getPost();
    expect(pinnedAgain.pinnedAt).not.toBeNull();
  });
});

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
    const repo = con.getRepository(Downvote);
    await repo.save(
      repo.create({
        postId: 'p1',
        userId: loggedUser,
      }),
    );
    const res = await client.query(QUERY);
    expect(res.data.post.downvoted).toEqual(true);
  });
});

describe('mutation downvote', () => {
  const MUTATION = `
  mutation Downvote($id: ID!) {
  downvote(id: $id) {
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
    loggedUser = '3';
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

  it('should downvote post', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con
      .getRepository(Downvote)
      .findOneBy({ postId: 'p1', userId: loggedUser });
    expect(actual).toMatchObject({
      postId: 'p1',
      userId: loggedUser,
    });
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.downvotes).toEqual(1);
    const hiddenPost = await con.getRepository(HiddenPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(hiddenPost).toMatchObject({
      postId: 'p1',
      userId: loggedUser,
    });
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Downvote);
    await repo.save({ postId: 'p1', userId: loggedUser });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await repo.findOneBy({ postId: 'p1', userId: loggedUser });
    expect(actual).toMatchObject({
      postId: 'p1',
      userId: loggedUser,
    });
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.downvotes).toEqual(1);
  });

  it('should remove upvote when downvoting', async () => {
    loggedUser = '1';
    await con.getRepository(Upvote).save({ postId: 'p1', userId: loggedUser });

    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();

    const upvote = await con
      .getRepository(Upvote)
      .findOneBy({ postId: 'p1', userId: loggedUser });
    expect(upvote).toBeNull();
  });
});

describe('mutation cancelDownvote', () => {
  const MUTATION = `
  mutation CancelDownvote($id: ID!) {
  cancelDownvote(id: $id) {
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

  it('should cancel post downvote', async () => {
    loggedUser = '1';
    const repo = con.getRepository(Downvote);
    await repo.save({ postId: 'p1', userId: loggedUser });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Downvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.downvotes).toEqual(0);
    const hiddenPost = await con.getRepository(HiddenPost).findOneBy({
      postId: 'p1',
      userId: loggedUser,
    });
    expect(hiddenPost).toBeNull();
  });

  it('should ignore if no downvote', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Downvote).find();
    expect(actual).toEqual([]);
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.downvotes).toEqual(0);
  });
});

describe('flags field', () => {
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.flags).toEqual({
      sentAnalyticsReport: true,
      visible: true,
      showOnFeed: true,
    });
  });
});
