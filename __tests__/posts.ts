import {
  disposeGraphQLTesting,
  GraphQLTestClient,
  GraphQLTestingState,
  initializeGraphQLTesting,
  MockContext,
  saveFixtures,
  testMutationError,
  testMutationErrorCode,
  testQueryError,
  testQueryErrorCode,
} from './helpers';
import {
  ArticlePost,
  Bookmark,
  BookmarkList,
  Comment,
  FreeformPost,
  Post,
  PostMention,
  PostQuestion,
  PostRelation,
  PostRelationType,
  PostReport,
  PostTag,
  PostType,
  SharePost,
  Source,
  SourceMember,
  SourceType,
  SquadSource,
  UNKNOWN_SOURCE,
  User,
  UserPost,
  View,
  WelcomePost,
  YouTubePost,
} from '../src/entity';
import { Roles, SourceMemberRoles, sourceRoleRank } from '../src/roles';
import { sourcesFixture } from './fixture/source';
import {
  postsFixture,
  postTagsFixture,
  relatedPostsFixture,
  videoPostsFixture,
} from './fixture/post';
import { DataSource, DeepPartial, IsNull, Not } from 'typeorm';
import createOrGetConnection from '../src/db';
import {
  createSquadWelcomePost,
  DEFAULT_POST_TITLE,
  notifyContentRequested,
  notifyView,
  pickImageUrl,
  postScraperOrigin,
  updateFlagsStatement,
  WATERCOOLER_ID,
} from '../src/common';
import { randomUUID } from 'crypto';
import nock from 'nock';
import {
  deleteKeysByPattern,
  getRedisObject,
  getRedisObjectExpiry,
  ioRedisPool,
  setRedisObject,
} from '../src/redis';
import { checkHasMention, markdown } from '../src/common/markdown';
import { generateStorageKey, StorageTopic } from '../src/config';
import { UserVote, UserVoteEntity } from '../src/types';
import {
  highRateLimiterName,
  rateLimiterName,
} from '../src/directive/rateLimit';

jest.mock('../src/common/pubsub', () => ({
  ...(jest.requireActual('../src/common/pubsub') as Record<string, unknown>),
  notifyView: jest.fn(),
  notifyContentRequested: jest.fn(),
}));

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
});

beforeEach(async () => {
  loggedUser = null;
  premiumUser = false;
  roles = [];
  jest.clearAllMocks();
  await ioRedisPool.execute((client) => client.flushall());

  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, YouTubePost, videoPostsFixture);
  await saveFixtures(con, PostTag, postTagsFixture);
  await con
    .getRepository(User)
    .save({ id: '1', name: 'Ido', image: 'https://daily.dev/ido.jpg' });
  await con.getRepository(User).save({
    id: '2',
    name: 'Lee',
    image: 'https://daily.dev/lee.jpg',
  });
  await deleteKeysByPattern(`${rateLimiterName}:*`);
  await deleteKeysByPattern(`${highRateLimiterName}:*`);
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

describe('slug field', () => {
  const QUERY = `{
    post(id: "p1") {
      slug
    }
  }`;

  it('should return the post slug', async () => {
    const res = await client.query(QUERY);
    expect(res.data.post.slug).toBe('p1-p1');
  });

  it('should return the post slug as id if title is empty', async () => {
    const repo = con.getRepository(ArticlePost);
    await repo.update({ id: 'p1' }, { title: '' });
    const res = await client.query(QUERY);
    expect(res.data.post.slug).toBe('p1');
  });

  it('should return the post slug cleaned if special characters are used', async () => {
    const repo = con.getRepository(ArticlePost);
    await repo.update(
      { id: 'p1' },
      { title: 'gemüse🦙✨杂货/薄荷نعناع!@#$%^&*()_+}{[],./;:""' },
    );
    const res = await client.query(QUERY);
    expect(res.data.post.slug).toBe('gem-se--p1');
  });

  it('should return the post slug truncated if title is too long', async () => {
    const repo = con.getRepository(ArticlePost);
    await repo.update(
      { id: 'p1' },
      {
        title:
          'Donec vulputate neque a est convallis, at interdum ligula fermentum. Pellentesque euismod semper urna, ac eleifend felis viverra nec. Phasellus sit am',
      },
    );
    const res = await client.query(QUERY);
    expect(res.data.post.slug).toBe(
      'donec-vulputate-neque-a-est-convallis-at-interdum-ligula-fermentum-pellentesque-euismod-semper-urn-p1',
    );
  });

  it('should return the post slug when searching for slug', async () => {
    const SUB_QUERY = `{
    post(id: "p1-p1") {
      slug
    }
  }`;
    const res = await client.query(SUB_QUERY);
    expect(res.data.post.slug).toBe('p1-p1');
  });
});

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
      'http://localhost:5002/posts/p1-p1',
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
    const repo = con.getRepository(UserPost);
    await repo.save(
      repo.create({
        postId: 'p1',
        userId: loggedUser,
        vote: UserVote.Up,
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

  it('should add welcome post and increment squad total posts', async () => {
    const repo = con.getRepository(Source);
    await repo.update({ id: 'a' }, { type: SourceType.Squad });
    const source = await repo.findOneBy({ id: 'a' });
    const post = await createSquadWelcomePost(con, source, '1');
    expect(post.showOnFeed).toEqual(false);
    expect(post.flags.showOnFeed).toEqual(false);

    const updatedSource = await repo.findOneBy({ id: 'a' });
    expect(updatedSource.flags.totalPosts).toEqual(1);
  });

  it('should add a post and NOT increment source total posts', async () => {
    const repo = con.getRepository(Source);
    const source = await repo.findOneBy({ id: 'a' });
    const post = await createSquadWelcomePost(con, source, '1');
    expect(post.showOnFeed).toEqual(false);
    expect(post.flags.showOnFeed).toEqual(false);

    const updatedSource = await repo.findOneBy({ id: 'a' });
    expect(updatedSource.flags.totalPosts).toEqual(undefined);
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

  it('should throw not found when post was soft deleted #1', async () => {
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
    return testQueryError(
      client,
      {
        query: QUERY('p1'),
      },
      (errors) => {
        expect(errors.length).toEqual(1);
        expect(errors[0].extensions?.code).toEqual('FORBIDDEN');
        expect(errors[0].extensions?.postId).toEqual('p1');
      },
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

  it('should throw not found when post was soft deleted #2', async () => {
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
        id: 'yt0',
        shortId: 'yt0',
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
          votedAt
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
    const userPostRepo = con.getRepository(UserPost);
    const createdAtOld = new Date('2020-09-22T07:15:51.247Z');
    const createdAtNew = new Date('2021-09-22T07:15:51.247Z');
    await userRepo.save({
      id: '2',
      name: 'Lee',
      image: 'https://daily.dev/lee.jpg',
    });
    await userPostRepo.save({
      userId: '1',
      postId: 'p1',
      vote: UserVote.Up,
    });
    await userPostRepo.save({
      userId: '1',
      postId: 'p1',
      votedAt: createdAtOld,
      vote: UserVote.Up,
    });
    await userPostRepo.save({
      userId: '2',
      postId: 'p1',
      vote: UserVote.Up,
    });
    await userPostRepo.save({
      userId: '2',
      postId: 'p1',
      votedAt: createdAtNew,
      vote: UserVote.Up,
    });

    const res = await client.query(QUERY, { variables: { id: 'p1' } });

    const [secondUpvote, firstUpvote] = res.data.postUpvotes.edges;
    expect(res.errors).toBeFalsy();
    expect(res.data).toMatchSnapshot();
    expect(new Date(secondUpvote.node.votedAt).getTime()).toBeGreaterThan(
      new Date(firstUpvote.node.votedAt).getTime(),
    );
  });
});

describe('query searchQuestionRecommendations', () => {
  const QUERY = `
    query SearchQuestionRecommendations {
      searchQuestionRecommendations {
        id
        question
      }
    }
  `;

  it('should throw error when user is not logged in', async () =>
    testQueryErrorCode(client, { query: QUERY }, 'UNAUTHENTICATED'));

  it('should return questions related to views of user', async () => {
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
    await con.getRepository(View).save([
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
    expect(res.data.searchQuestionRecommendations.length).toEqual(3);
  });

  it('should serve cached data if available', async () => {
    loggedUser = '1';
    const key = generateStorageKey(StorageTopic.Search, 'rec', loggedUser);
    await setRedisObject(
      key,
      JSON.stringify([{ id: 'c1', question: 'cached' }]),
    );
    const res = await client.query(QUERY);
    expect(res.errors).toBeFalsy();
    expect(res.data.searchQuestionRecommendations).toEqual([
      { id: 'c1', question: 'cached' },
    ]);
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
    const actualUserPost = await con
      .getRepository(UserPost)
      .findOneBy({ userId: loggedUser });
    expect(actualUserPost).toMatchObject({
      postId: 'p1',
      userId: loggedUser,
      hidden: true,
    });
  });

  it('should ignore conflicts', async () => {
    loggedUser = '1';
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      hidden: true,
    });
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actualUserPost = await con
      .getRepository(UserPost)
      .findOneBy({ userId: loggedUser, postId: 'p1' });
    expect(actualUserPost).toMatchObject({
      postId: 'p1',
      userId: loggedUser,
      hidden: true,
    });
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
    await con.getRepository(UserPost).save({
      postId: 'p1',
      userId: loggedUser,
      hidden: true,
    });
    const initialUserPost = await con
      .getRepository(UserPost)
      .findOneBy({ userId: loggedUser, postId: 'p1' });
    expect(initialUserPost?.hidden).toBe(true);
    const res = await client.mutate(MUTATION, { variables: { id: 'p1' } });
    expect(res.errors).toBeFalsy();
    const actualUserPost = await con
      .getRepository(UserPost)
      .findOneBy({ userId: loggedUser, postId: 'p1' });
    expect(actualUserPost?.hidden).toEqual(false);
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
    await verifyPostDeleted('p1', loggedUser);
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
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { flags: { totalPosts: 1 } });
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
    await verifyPostDeleted(id, loggedUser);
  });

  const verifyPostDeleted = async (id: string, user: string) => {
    const res = await client.mutate(MUTATION, { variables: { id } });
    expect(res.errors).toBeFalsy();
    const actual = await con.getRepository(Post).findOneBy({ id });
    expect(actual.deleted).toBeTruthy();
    expect(actual.flags.deleted).toBeTruthy();
    expect(actual.flags.deletedBy).toBe(user);
  };

  it('should allow member to delete their own freeform post', async () => {
    loggedUser = '2';
    const source = await con.getRepository(Source).findOneBy({ id: 'a' });
    const post = await createSquadWelcomePost(con, source, '2');
    await con
      .getRepository(Post)
      .update({ id: post.id }, { type: PostType.Freeform });
    await verifyPostDeleted(post.id, loggedUser);
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
    await verifyPostDeleted(post.id, loggedUser);
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
    await verifyPostDeleted(welcome.id, loggedUser);
  });

  it('should delete the shared post from a member as a moderator', async () => {
    loggedUser = '2';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Moderator }, '1');
    await verifyPostDeleted(id, loggedUser);
  });

  it('should allow moderator deleting a post from other moderators', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Moderator });
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Moderator });

    await verifyPostDeleted(id, loggedUser);
  });

  it('should allow moderator deleting a post from the admin', async () => {
    loggedUser = '1';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Admin });
    await con
      .getRepository(SourceMember)
      .update({ userId: '1' }, { role: SourceMemberRoles.Moderator });

    await verifyPostDeleted(id, loggedUser);
  });

  it('should delete the shared post as an admin of the squad', async () => {
    loggedUser = '2';
    const id = 'sp1';
    await createSharedPost(id, { role: SourceMemberRoles.Admin }, '1');
    await verifyPostDeleted(id, loggedUser);
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
    const actualUserPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(actualUserPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      hidden: true,
    });
    expect(
      await con
        .getRepository(PostReport)
        .findOneBy({ userId: loggedUser, postId: 'p1' }),
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
    const actualUserPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(actualUserPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      hidden: true,
    });
    expect(
      await con
        .getRepository(PostReport)
        .findOneBy({ userId: loggedUser, postId: 'p1' }),
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
    await con.getRepository(UserPost).save({
      userId: loggedUser,
      postId: 'p1',
      hidden: true,
    });
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', reason: 'BROKEN', comment: 'Test comment' },
    });
    expect(res.errors).toBeFalsy();
    const actualUserPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(actualUserPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      hidden: true,
    });
  });

  it('should save all the irrelevant tags', async () => {
    loggedUser = '1';
    const tags = ['js', 'react'];
    const res = await client.mutate(MUTATION, {
      variables: { id: 'p1', tags, reason: 'IRRELEVANT' },
    });
    expect(res.errors).toBeFalsy();
    const actualUserPost = await con.getRepository(UserPost).findOneBy({
      userId: loggedUser,
      postId: 'p1',
    });
    expect(actualUserPost).toMatchObject({
      userId: loggedUser,
      postId: 'p1',
      hidden: true,
    });
    expect(
      await con
        .getRepository(PostReport)
        .findOneBy({ userId: loggedUser, postId: 'p1' }),
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
    await con.getRepository(UserPost).save({
      userId: loggedUser,
      postId: 'p1',
      hidden: true,
    });
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

  it('should share to squad and increment squad flags total posts', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, { variables });
    expect(res.errors).toBeFalsy();
    const newId = res.data.sharePost.id;
    const post = await con.getRepository(SharePost).findOneBy({ id: newId });
    const source = await post.source;
    expect(source.flags.totalPosts).toEqual(1);
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
    expect(post.titleHtml).toMatch(
      markdown.utils.escapeHtml(
        `<style>html { color: red !important; }</style>`,
      ),
    );
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

  describe('rate limiting', () => {
    const redisKey = `${rateLimiterName}:1:createPost`;
    it('store rate limiting state in redis', async () => {
      loggedUser = '1';

      const res = await client.mutate(MUTATION, {
        variables: variables,
      });

      expect(res.errors).toBeFalsy();
      expect(await getRedisObject(redisKey)).toEqual('1');
    });

    it('should rate limit creating posts to 10 per hour', async () => {
      loggedUser = '1';

      for (let i = 0; i < 10; i++) {
        const res = await client.mutate(MUTATION, {
          variables: variables,
        });

        expect(res.errors).toBeFalsy();
      }
      expect(await getRedisObject(redisKey)).toEqual('10');

      await testMutationErrorCode(
        client,
        { mutation: MUTATION, variables: variables },
        'RATE_LIMITED',
        'Take a break. You already posted enough in the last hour',
      );

      // Check expiry, to not cause it to be flaky, we check if it is within 10 seconds
      expect(await getRedisObjectExpiry(redisKey)).toBeLessThanOrEqual(3600);
      expect(await getRedisObjectExpiry(redisKey)).toBeGreaterThanOrEqual(3590);
    });

    describe('high rate squads', () => {
      const highRateRedisKey = `${highRateLimiterName}:1:createPost`;
      beforeEach(async () => {
        await con.getRepository(SquadSource).save({
          id: WATERCOOLER_ID,
          handle: 'watercooler',
          name: 'Watercooler',
          private: false,
        });
        await con.getRepository(SourceMember).save({
          sourceId: WATERCOOLER_ID,
          userId: '1',
          referralToken: 'watercoolerRt',
          role: SourceMemberRoles.Member,
        });
      });

      it('should rate limit creating posts in Watercooler squad to 1 per 10 minutes', async () => {
        loggedUser = '1';

        const res = await client.mutate(MUTATION, {
          variables: { ...variables, sourceId: WATERCOOLER_ID },
        });

        expect(res.errors).toBeFalsy();
        expect(await getRedisObject(redisKey)).toEqual('1');
        expect(await getRedisObject(highRateRedisKey)).toEqual('1');

        await testMutationErrorCode(
          client,
          {
            mutation: MUTATION,
            variables: { ...variables, sourceId: WATERCOOLER_ID },
          },
          'RATE_LIMITED',
          'Take a break. You already posted enough in the last ten minutes',
        );
      });
    });
  });
});

describe('mutation editSharePost', () => {
  const MUTATION = `
  mutation editSharePost($id: ID!, $commentary: String) {
    editSharePost(id: $id, commentary: $commentary) {
      id
    }
  }`;

  const variables = {
    sourceId: 'a',
    id: 'sharePost',
    commentary: 'My comment',
  };

  beforeEach(async () => {
    await saveSquadFixtures();

    await con.getRepository(SharePost).save({
      id: 'sharePost',
      shortId: 'sharePost',
      sourceId: 'a',
      type: PostType.Share,
      title: 'Foo Bar',
      authorId: '1',
    });
  });

  it('should not authorize when not logged in', () =>
    testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'UNAUTHENTICATED',
    ));

  it('should throw error when post does not exist', async () => {
    loggedUser = '1';
    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables: { ...variables, id: 'nope' } },
      'NOT_FOUND',
    );
  });

  it('should restrict member when user is not the author of the post', async () => {
    loggedUser = '2';

    return testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'FORBIDDEN',
    );
  });

  it('should update the post with a trimmed commentary', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, commentary: '  My comment  ' },
    });
    expect(res.errors).toBeFalsy();
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ id: variables.id });
    expect(post.title).toEqual('My comment');
  });

  it('should update without commentary', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, commentary: null },
    });
    expect(res.errors).toBeFalsy();
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ id: variables.id });
    expect(post.title).toBeNull();
  });

  it('should update with mentioned users', async () => {
    loggedUser = '1';
    await con.getRepository(User).update({ id: '2' }, { username: 'lee' });
    const params = { ...variables };
    params.commentary = 'Test @lee @non-existent';
    const res = await client.mutate(MUTATION, { variables: params });
    expect(res.errors).toBeFalsy();
    const post = await con
      .getRepository(SharePost)
      .findOneBy({ id: variables.id });
    expect(post.authorId).toEqual('1');
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
      .findOneBy({ id: variables.id });
    expect(post.titleHtml).toMatch(
      markdown.utils.escapeHtml(
        `<style>html { color: red !important; }</style>`,
      ),
    );
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

  it('should share existing youtube post to squad', async () => {
    loggedUser = '1';
    const res = await client.mutate(MUTATION, {
      variables: { ...variables, url: 'https://youtu.be/T_AbQGe7fuU' },
    });
    expect(res.errors).toBeFalsy();
    const youtubePost = await con
      .getRepository(YouTubePost)
      .findOneBy({ url: 'https://youtu.be/T_AbQGe7fuU' });
    expect(youtubePost.url).toEqual('https://youtu.be/T_AbQGe7fuU');
    expect(youtubePost.visible).toEqual(true);
    expect(youtubePost.id).toEqual('yt1');

    expect(notifyContentRequested).toHaveBeenCalledTimes(0);

    const sharedPost = await con
      .getRepository(SharePost)
      .findOneBy({ sharedPostId: youtubePost.id });
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

  describe('rate limiting', () => {
    const redisKey = `${rateLimiterName}:1:createPost`;
    it('store rate limiting state in redis', async () => {
      loggedUser = '1';

      const res = await client.mutate(MUTATION, {
        variables: { ...variables, url: 'http://p6.com' },
      });

      expect(res.errors).toBeFalsy();
      expect(await getRedisObject(redisKey)).toEqual('1');
    });

    it('should rate limit creating posts to 10 per hour', async () => {
      loggedUser = '1';

      for (let i = 0; i < 10; i++) {
        const res = await client.mutate(MUTATION, {
          variables: { ...variables, url: 'http://p6.com' },
        });

        expect(res.errors).toBeFalsy();
      }
      expect(await getRedisObject(redisKey)).toEqual('10');

      await testMutationErrorCode(
        client,
        { mutation: MUTATION, variables: variables },
        'RATE_LIMITED',
        'Take a break. You already posted enough in the last hour',
      );

      // Check expiry, to not cause it to be flaky, we check if it is within 10 seconds
      expect(await getRedisObjectExpiry(redisKey)).toBeLessThanOrEqual(3600);
      expect(await getRedisObjectExpiry(redisKey)).toBeGreaterThanOrEqual(3590);
    });

    describe('high rate squads', () => {
      const highRateRedisKey = `${highRateLimiterName}:1:createPost`;
      beforeEach(async () => {
        await con.getRepository(SquadSource).save({
          id: WATERCOOLER_ID,
          handle: 'watercooler',
          name: 'Watercooler',
          private: false,
        });
        await con.getRepository(SourceMember).save({
          sourceId: WATERCOOLER_ID,
          userId: '1',
          referralToken: 'watercoolerRt',
          role: SourceMemberRoles.Member,
        });
      });

      it('should rate limit creating posts in Watercooler squad to 1 per 10 minutes', async () => {
        loggedUser = '1';

        const res = await client.mutate(MUTATION, {
          variables: {
            ...variables,
            url: 'http://p6.com',
            sourceId: WATERCOOLER_ID,
          },
        });

        expect(res.errors).toBeFalsy();
        expect(await getRedisObject(redisKey)).toEqual('1');
        expect(await getRedisObject(highRateRedisKey)).toEqual('1');

        await testMutationErrorCode(
          client,
          {
            mutation: MUTATION,
            variables: {
              ...variables,
              url: 'http://p6.com',
              sourceId: WATERCOOLER_ID,
            },
          },
          'RATE_LIMITED',
          'Take a break. You already posted enough in the last ten minutes',
        );
      });
    });
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
    await deleteKeysByPattern(`${rateLimiterName}:*`);
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

    await testMutationErrorCode(
      client,
      { mutation: MUTATION, variables },
      'RATE_LIMITED',
      'Too many requests, please try again in 60s',
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
          flags {
            totalPosts
          }
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

  it('should return an error if title exceeds 250 characters', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...params,
          title:
            'Hello World! Start your squad journey here - Hello World! Start your squad journey here Hello World! Start your squad journey here - Hello World! Start your squad journey here Hello World! Start your squad journey here - Hello World! Start your squad journey here',
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

  it('should increment source total posts', async () => {
    loggedUser = '1';
    const sourceId = 'a';
    const repo = con.getRepository(Source);
    const current = 2;
    await repo.update({ id: sourceId }, { flags: { totalPosts: current } });
    const source = await repo.findOneByOrFail({ id: sourceId });
    expect(source.flags.totalPosts).toEqual(current);
    const content = '# Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { ...params, content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createFreeformPost.source.id).toEqual('a');
    expect(res.data.createFreeformPost.source.flags.totalPosts).toEqual(
      current + 1,
    );
  });

  it('should increment source total posts even if undefined', async () => {
    loggedUser = '1';
    const sourceId = 'a';
    const source = await con
      .getRepository(Source)
      .findOneByOrFail({ id: sourceId });
    expect(source.flags.totalPosts).toEqual(undefined);
    const content = '# Updated content';
    const res = await client.mutate(MUTATION, {
      variables: { ...params, content },
    });
    expect(res.errors).toBeFalsy();
    expect(res.data.createFreeformPost.source.id).toEqual('a');
    expect(res.data.createFreeformPost.source.flags.totalPosts).toEqual(1);
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

  describe('rate limiting', () => {
    const redisKey = `${rateLimiterName}:1:createPost`;
    it('store rate limiting state in redis', async () => {
      loggedUser = '1';

      const res = await client.mutate(MUTATION, {
        variables: params,
      });

      expect(res.errors).toBeFalsy();
      expect(await getRedisObject(redisKey)).toEqual('1');
    });

    it('should rate limit creating posts to 10 per hour', async () => {
      loggedUser = '1';

      for (let i = 0; i < 10; i++) {
        const res = await client.mutate(MUTATION, {
          variables: params,
        });

        expect(res.errors).toBeFalsy();
      }
      expect(await getRedisObject(redisKey)).toEqual('10');

      await testMutationErrorCode(
        client,
        { mutation: MUTATION, variables: params },
        'RATE_LIMITED',
        'Take a break. You already posted enough in the last hour',
      );

      // Check expiry, to not cause it to be flaky, we check if it is within 10 seconds
      expect(await getRedisObjectExpiry(redisKey)).toBeLessThanOrEqual(3600);
      expect(await getRedisObjectExpiry(redisKey)).toBeGreaterThanOrEqual(3590);
    });

    describe('high rate squads', () => {
      const highRateRedisKey = `${highRateLimiterName}:1:createPost`;
      beforeEach(async () => {
        await con.getRepository(SquadSource).save({
          id: WATERCOOLER_ID,
          handle: 'watercooler',
          name: 'Watercooler',
          private: false,
        });
        await con.getRepository(SourceMember).save({
          sourceId: WATERCOOLER_ID,
          userId: '1',
          referralToken: 'watercoolerRt',
          role: SourceMemberRoles.Member,
        });
      });

      it('should rate limit creating posts in Watercooler squad to 1 per 10 minutes', async () => {
        loggedUser = '1';

        const res = await client.mutate(MUTATION, {
          variables: { ...params, sourceId: WATERCOOLER_ID },
        });

        expect(res.errors).toBeFalsy();
        expect(await getRedisObject(redisKey)).toEqual('1');
        expect(await getRedisObject(highRateRedisKey)).toEqual('1');

        await testMutationErrorCode(
          client,
          {
            mutation: MUTATION,
            variables: { ...params, sourceId: WATERCOOLER_ID },
          },
          'RATE_LIMITED',
          'Take a break. You already posted enough in the last ten minutes',
        );
      });
    });
  });
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
        source {
          id
        }
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
      .update({ id: 'p1' }, { type: PostType.Collection });

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

  it('should return an error if title exceeds 250 characters', async () => {
    loggedUser = '1';

    return testMutationErrorCode(
      client,
      {
        mutation: MUTATION,
        variables: {
          ...params,
          title:
            'Hello World! Start your squad journey here - Hello World! Start your squad journey here Hello World! Start your squad journey here - Hello World! Start your squad journey here Hello World! Start your squad journey here - Hello World! Start your squad journey here',
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

  it('should update title of the post but keep the same squad flags total posts count', async () => {
    loggedUser = '1';
    await con
      .getRepository(Source)
      .update({ id: 'a' }, { flags: { totalPosts: 1 } });
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
    const source = await con
      .getRepository(Source)
      .findOneByOrFail({ id: res2.data.editPost.source.id });
    expect(source.flags.totalPosts).toEqual(1);
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

describe('mutation swapPinnedPosts', () => {
  const MUTATION = `
    mutation SwapPinnedPosts($id: ID!, $swapWithId: ID!) {
      swapPinnedPosts(id: $id, swapWithId: $swapWithId) {
        _
      }
    }
  `;

  const params = { id: 'p1', swapWithId: 'p2' };

  beforeEach(async () => {
    await saveSquadFixtures();

    const currentDate = new Date();
    await con.getRepository(Post).update(
      { id: 'p1' },
      {
        pinnedAt: new Date(currentDate.getTime() - 2000),
      },
    );

    await con.getRepository(Post).update(
      { id: 'p2' },
      {
        pinnedAt: new Date(currentDate.getTime() - 1000),
        sourceId: 'a',
      },
    );
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

  describe('when authenticated w/ permissions', () => {
    beforeEach(async () => {
      await con
        .getRepository(SourceMember)
        .update({ userId: '1' }, { role: SourceMemberRoles.Admin });
    });

    it('should throw a validation error if posts are not pinned', async () => {
      loggedUser = '1';

      await con.getRepository(Post).update({ id: 'p1' }, { pinnedAt: null });

      return testMutationError(
        client,
        { mutation: MUTATION, variables: params },
        (errors) => {
          expect(errors.length).toEqual(1);
          expect(errors[0].message).toEqual('Posts must be pinned first');
        },
      );
    });

    it('should allow swapping w/ the next pinned post', async () => {
      loggedUser = '1';

      const pinnedQuery = () =>
        con.getRepository(Post).find({
          where: { pinnedAt: Not(IsNull()), sourceId: 'a' },
          order: { pinnedAt: 'DESC' },
        });

      const postsBefore = await pinnedQuery();
      expect(postsBefore.map((p) => p.id)).toEqual(['p2', 'p1']);

      await client.mutate(MUTATION, {
        variables: { id: 'p1', swapWithId: 'p2' },
      });

      const postsAfter = await pinnedQuery();
      expect(postsAfter.map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('should allow swapping w/ the previous pinned post', async () => {
      loggedUser = '1';

      const pinnedQuery = () =>
        con.getRepository(Post).find({
          where: { pinnedAt: Not(IsNull()), sourceId: 'a' },
          order: { pinnedAt: 'DESC' },
        });

      const postsBefore = await pinnedQuery();
      expect(postsBefore.map((p) => p.id)).toEqual(['p2', 'p1']);

      await client.mutate(MUTATION, {
        variables: { id: 'p2', swapWithId: 'p1' },
      });

      const postsAfter = await pinnedQuery();
      expect(postsAfter.map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('should increment relevant pinnedAt values to avoid duplicates', async () => {
      loggedUser = '1';

      // oldest of the 3 pinned posts: p2, p1, p3
      await con.getRepository(Post).update(
        { id: 'p3' },
        {
          pinnedAt: new Date(new Date().getTime() - 3000),
          sourceId: 'a',
        },
      );

      // to assert that the first pinned post pinnedAt timestamp is changed
      const firstPostBefore = await con
        .getRepository(Post)
        .findOneBy({ id: 'p2' });

      await client.mutate(MUTATION, {
        variables: { id: 'p3', swapWithId: 'p1' },
      });

      const firstPostAfter = await con
        .getRepository(Post)
        .findOneBy({ id: 'p2' });

      expect(firstPostAfter.pinnedAt.getTime()).toEqual(
        firstPostBefore.pinnedAt.getTime() + 1000,
      );
    });

    it('only touches pinned posts in the given source', async () => {
      loggedUser = '1';

      // oldest of the 3 pinned posts: p2, p1, p3
      await con.getRepository(Post).update(
        { id: 'p3' },
        {
          pinnedAt: new Date(new Date().getTime() - 3000),
          sourceId: 'a',
        },
      );

      // take p2 out of the source
      await con.getRepository(Post).update({ id: 'p2' }, { sourceId: 'b' });

      const firstPostBefore = await con
        .getRepository(Post)
        .findOneBy({ id: 'p2' });

      await client.mutate(MUTATION, {
        variables: { id: 'p3', swapWithId: 'p1' },
      });

      const firstPostAfter = await con
        .getRepository(Post)
        .findOneBy({ id: 'p2' });

      expect(firstPostAfter.pinnedAt.getTime()).toEqual(
        firstPostBefore.pinnedAt.getTime(),
      );
    });
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

describe('userState field', () => {
  const QUERY = `{
    post(id: "p1") {
      userState {
        vote
        hidden
        flags {
          feedbackDismiss
        }
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
    loggedUser = '3';
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.upvotes).toEqual(4);
  };

  it('should upvote', async () => {
    loggedUser = '1';

    await testUpvote();
  });

  it('should upvote and NOT update source flags upvotes count', async () => {
    loggedUser = '1';
    const source = await con.getRepository(Source).findOneByOrFail({ id: 'a' });
    expect(source.flags.totalUpvotes).toEqual(undefined);

    await testUpvote();

    const updatedSource = await con
      .getRepository(Source)
      .findOneByOrFail({ id: 'a' });
    expect(updatedSource.flags.totalUpvotes).toEqual(undefined);
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
    const post = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(post?.downvotes).toEqual(4);
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
    await client.mutate(MUTATION, {
      variables: { id: 'p1', vote: initialVote, entity: UserVoteEntity.Post },
    });
    const oldPost = await con.getRepository(Post).findOneBy({ id: 'p1' });
    expect(oldPost?.upvotes).toEqual(1);
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
  };

  it('should cancel vote', async () => {
    loggedUser = '1';
    await testCancelVote();
  });

  it('should cancel vote and NOT update source flags upvotes count', async () => {
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
    expect(updatedSource.flags.totalUpvotes).toEqual(undefined);
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
