import { saveFixtures } from './helpers';
import { ArticlePost, Source, SourceType } from '../src/entity';
import { sourcesFixture } from './fixture/source';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../src/db';
import { PostService } from '@dailydotdev/schema';
import {
  CallOptions,
  Code,
  ConnectError,
  createPromiseClient,
  createRouterTransport,
} from '@connectrpc/connect';
import privateRpc from '../src/routes/privateRpc';
import { baseRpcContext } from '../src/common/connectRpc';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
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
const mockClient = createPromiseClient(PostService, mockTransport);
const defaultClientAuthOptions: CallOptions = {
  headers: {
    Authorization: `Service ${process.env.SERVICE_SECRET}`,
  },
};

describe('PostService', () => {
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
      sentAnalyticsReport: false,
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
  });
});
