import { saveFixtures } from '../../helpers';
import {
  ArticlePost,
  MachineSource,
  Source,
  SourceFeed,
  SourceRequest,
  SourceType,
} from '../../../src/entity';
import { sourcesFixture } from '../../fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../../src/db';
import {
  PostService,
  SourceRequestService,
  SourceService,
} from '@dailydotdev/schema';
import {
  CallOptions,
  Code,
  ConnectError,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import privateRpc from '../../../src/routes/private/rpc';
import { baseRpcContext } from '../../../src/common/connectRpc';
import { uploadLogo } from '../../../src/common';

let con: DataSource;

jest.mock('../../../src/common', () => ({
  ...(jest.requireActual('../../../src/common') as Record<string, unknown>),
  uploadLogo: jest.fn(),
}));

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  process.env.SCRAPER_URL = 'http://daily-scraper.test';

  await saveFixtures(con, Source, [
    ...sourcesFixture,
    {
      id: 'collections',
      name: 'Collections',
      image: 'http://image.com/collections',
      handle: 'collections',
      type: SourceType.Machine,
    },
  ]);
});

const mockTransport = createRouterTransport(privateRpc, {
  router: {
    interceptors: [
      (next) => {
        return async (req) => {
          if (
            req.header.get('Authorization') ===
            `Service ${process.env.SERVICE_SECRET}`
          ) {
            req.contextValues.set(baseRpcContext, {
              service: true,
            });
          }

          return next(req);
        };
      },
    ],
  },
});
const defaultClientAuthOptions: CallOptions = {
  headers: {
    Authorization: `Service ${process.env.SERVICE_SECRET}`,
  },
};

describe('PostService', () => {
  const mockClient = createClient(PostService, mockTransport);
  it('should return not found when not authorized', async () => {
    baseRpcContext.defaultValue = {
      service: false,
    };

    await expect(
      mockClient.create({
        url: 'http://example.com/service/1',
        sourceId: 'a',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should create post', async () => {
    const result = await mockClient.create(
      {
        url: 'http://example.com/service/1',
        sourceId: 'a',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      postId: expect.any(String),
      url: 'http://example.com/service/1',
    });
    const post = await con
      .getRepository(ArticlePost)
      .findOneBy({ id: result.postId });
    expect(post).toBeTruthy();
    expect(post).toMatchObject({
      id: expect.any(String),
      sourceId: 'a',
      visible: false,
      showOnFeed: false,
    });
  });

  it('should return duplicate entry', async () => {
    const { postId } = await mockClient.create(
      {
        url: 'http://example.com/service/1',
        sourceId: 'a',
      },
      defaultClientAuthOptions,
    );
    const post = await con.getRepository(ArticlePost).findOneBy({ id: postId });
    expect(post).toBeTruthy();

    const result = await mockClient.create(
      {
        url: 'http://example.com/service/1',
        sourceId: 'a',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      postId,
      url: 'http://example.com/service/1',
    });
  });

  it('should throw on invalid source', async () => {
    await expect(
      mockClient.create(
        {
          url: 'http://example.com/service/1',
          sourceId: 'sourceDoestNotExist',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('source not found', Code.NotFound));
  });

  it('should clean url', async () => {
    const result = await mockClient.create(
      {
        url: 'http://example.com/service/1?utm_source=foo',
        sourceId: 'a',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      postId: expect.any(String),
      url: 'http://example.com/service/1',
    });
    const post = await con
      .getRepository(ArticlePost)
      .findOneBy({ id: result.postId });
    expect(post).toBeTruthy();
    expect(post!.url).toEqual('http://example.com/service/1');
  });

  it('should throw on invalid url', async () => {
    await expect(
      mockClient.create(
        {
          url: 'thisIsNotUrl',
          sourceId: 'a',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('invalid url', Code.InvalidArgument));
  });

  it('should throw on missing url', async () => {
    await expect(
      mockClient.create(
        {
          sourceId: 'a',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('invalid url', Code.InvalidArgument));
  });

  it('should save yggdrasilId', async () => {
    const result = await mockClient.create(
      {
        url: 'http://example.com/service/1',
        sourceId: 'a',
        yggdrasilId: 'a7edf0c8-aec7-4586-b411-b1dd431ce8d6',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      postId: expect.any(String),
      url: 'http://example.com/service/1',
    });
    const post = await con
      .getRepository(ArticlePost)
      .findOneBy({ id: result.postId });
    expect(post).toBeTruthy();
    expect(post!.yggdrasilId).toEqual('a7edf0c8-aec7-4586-b411-b1dd431ce8d6');
  });

  it('should return duplicate entry per yggdrasilId', async () => {
    const { postId } = await mockClient.create(
      {
        url: 'http://example.com/service/1',
        sourceId: 'a',
        yggdrasilId: '95ba892c-d641-4b94-ba47-be03c4c6cc8b',
      },
      defaultClientAuthOptions,
    );
    const post = await con.getRepository(ArticlePost).findOneBy({ id: postId });
    expect(post).toBeTruthy();

    const result = await mockClient.create(
      {
        url: 'http://example.com/service/123',
        sourceId: 'a',
        yggdrasilId: '95ba892c-d641-4b94-ba47-be03c4c6cc8b',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      postId,
      url: 'http://example.com/service/1',
    });
  });

  it('should require yggdrasilId for source collections', async () => {
    await expect(
      mockClient.create(
        {
          url: 'http://example.com/service/1',
          sourceId: 'collections',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(
      new ConnectError(
        'yggdrasil id required for collections',
        Code.InvalidArgument,
      ),
    );
  });

  it('should allow source collections without url', async () => {
    const result = await mockClient.create(
      {
        sourceId: 'collections',
        yggdrasilId: '95ba892c-d641-4b94-ba47-be03c4c6cc8b',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      postId: expect.any(String),
      url: '',
    });
    const post = await con
      .getRepository(ArticlePost)
      .findOneBy({ id: result.postId });
    expect(post).toBeTruthy();
    expect(post!.yggdrasilId).toEqual('95ba892c-d641-4b94-ba47-be03c4c6cc8b');
    expect(post!.url).toBeNull();
  });
});

describe('SourceRequestService', () => {
  const mockClient = createClient(SourceRequestService, mockTransport);
  it('should return not found when not authorized', async () => {
    baseRpcContext.defaultValue = {
      service: false,
    };

    await expect(
      mockClient.create({
        url: 'http://example.com/service/1',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should create source request', async () => {
    const result = await mockClient.create(
      {
        url: 'http://example.com/service/1',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      id: expect.any(String),
    });
    const sourceRequest = await con
      .getRepository(SourceRequest)
      .findOneBy({ id: result.id });
    expect(sourceRequest).toBeTruthy();
    expect(sourceRequest!.userId).toEqual('yggdrasil');
    expect(sourceRequest!.sourceUrl).toEqual('http://example.com/service/1');
  });

  it('should throw on invalid url', async () => {
    await expect(
      mockClient.create(
        {
          url: 'thisIsNotUrl',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('invalid url', Code.InvalidArgument));
  });
});

describe('SourceService', () => {
  const mockClient = createClient(SourceService, mockTransport);

  it('should return unauthenticated when not authorized for scrape', async () => {
    baseRpcContext.defaultValue = {
      service: false,
    };

    await expect(
      mockClient.scrapeSource({
        url: 'https://example.com',
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should scrape a source', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'website',
          name: 'Example',
          logo: 'https://example.com/logo.png',
          website: 'https://example.com',
          rss: [
            {
              url: 'https://example.com/feed.xml',
              title: 'Main feed',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const result = await mockClient.scrapeSource(
      {
        url: 'https://example.com?utm_source=test',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      type: 'website',
      name: 'Example',
      logo: 'https://example.com/logo.png',
      website: 'https://example.com',
      feeds: [
        {
          url: 'https://example.com/feed.xml',
          title: 'Main feed',
        },
      ],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      new URL(
        '/scrape/source?url=https%3A%2F%2Fexample.com',
        'http://daily-scraper.test',
      ),
    );
  });

  it('should propagate unavailable scraper responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ type: 'unavailable' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await mockClient.scrapeSource(
      {
        url: 'https://example.com',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      type: 'unavailable',
      feeds: [],
    });
  });

  it('should create a source', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('logo', { status: 200 }));
    jest
      .mocked(uploadLogo)
      .mockResolvedValueOnce('https://media.daily.dev/image/upload/logo');

    const result = await mockClient.createSource(
      {
        id: 'source-rpc',
        name: 'Source RPC',
        image: 'https://example.com/logo.png',
        twitter: 'source_rpc',
        website: 'https://example.com?utm_source=test',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      source: {
        id: 'source-rpc',
        type: 'machine',
        createdAt: expect.any(Number),
        active: true,
        name: 'Source RPC',
        image: 'https://media.daily.dev/image/upload/logo',
        private: false,
        handle: 'source-rpc',
        twitter: 'source_rpc',
        website: 'https://example.com',
      },
    });

    const source = await con.getRepository(MachineSource).findOneByOrFail({
      id: 'source-rpc',
    });
    expect(source).toMatchObject({
      id: 'source-rpc',
      type: SourceType.Machine,
      name: 'Source RPC',
      image: 'https://media.daily.dev/image/upload/logo',
      handle: 'source-rpc',
      twitter: 'source_rpc',
      website: 'https://example.com',
    });
  });

  it('should reject duplicate sources', async () => {
    await con.getRepository(MachineSource).save({
      id: 'duplicate-source',
      name: 'Duplicate source',
      image: 'https://media.daily.dev/image/upload/logo',
      handle: 'duplicate-source',
    });

    await expect(
      mockClient.createSource(
        {
          id: 'duplicate-source',
          name: 'Duplicate source',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(
      new ConnectError('source already exists', Code.AlreadyExists),
    );
  });

  it('should add a source feed', async () => {
    const result = await mockClient.addSourceFeed(
      {
        sourceId: 'a',
        feed: 'https://example.com/feed.xml',
      },
      defaultClientAuthOptions,
    );

    expect(result).toEqual({
      sourceId: 'a',
      feed: 'https://example.com/feed.xml',
    });

    const sourceFeed = await con.getRepository(SourceFeed).findOneByOrFail({
      feed: 'https://example.com/feed.xml',
    });
    expect(sourceFeed).toEqual({
      sourceId: 'a',
      feed: 'https://example.com/feed.xml',
      lastFetched: null,
    });
  });

  it('should return not found for a missing source when adding a feed', async () => {
    await expect(
      mockClient.addSourceFeed(
        {
          sourceId: 'does-not-exist',
          feed: 'https://example.com/feed.xml',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('source not found', Code.NotFound));
  });

  it('should reject duplicate feeds', async () => {
    await con.getRepository(SourceFeed).save({
      sourceId: 'a',
      feed: 'https://example.com/feed.xml',
    });

    await expect(
      mockClient.addSourceFeed(
        {
          sourceId: 'a',
          feed: 'https://example.com/feed.xml',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(
      new ConnectError('source feed already exists', Code.AlreadyExists),
    );
  });
});
