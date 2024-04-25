import { saveFixtures } from './helpers';
import { ArticlePost, Source } from '../src/entity';
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
  await saveFixtures(con, Source, sourcesFixture);
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
  });

  it('should return conflict when duplicate entry', async () => {
    const { postId } = await mockClient.create(
      {
        url: 'http://example.com/service/1',
        sourceId: 'a',
      },
      defaultClientAuthOptions,
    );
    const post = await con.getRepository(ArticlePost).findOneBy({ id: postId });
    expect(post).toBeTruthy();

    await expect(
      mockClient.create(
        {
          url: 'http://example.com/service/1',
          sourceId: 'a',
        },
        defaultClientAuthOptions,
      ),
    ).rejects.toThrow(new ConnectError('conflict', Code.AlreadyExists));
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
});
