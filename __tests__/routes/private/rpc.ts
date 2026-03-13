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
  PageIngestion,
  PostService,
  RssIngestion,
  SourceEngine,
  SourceRequestService,
  SourceService,
  TwitterAccountIngestion,
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
import nock from 'nock';
import * as cloudinary from '../../../src/common/cloudinary';
import { pubsub } from '../../../src/common/pubsub';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  nock.cleanAll();
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

afterAll(() => {
  nock.cleanAll();
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

  it('should return unauthenticated when not authorized', async () => {
    baseRpcContext.defaultValue = {
      service: false,
    };

    await expect(
      mockClient.provision({
        sourceId: 'new-source',
        ingestion: {
          case: 'rss',
          value: new RssIngestion({
            feedUrl: 'https://example.com/feed.xml',
          }),
        },
      }),
    ).rejects.toThrow(
      new ConnectError('unauthenticated', Code.Unauthenticated),
    );
  });

  it('should provision an rss source with scraped metadata and image upload', async () => {
    const uploadLogo = jest
      .spyOn(cloudinary, 'uploadLogo')
      .mockResolvedValue('https://media.daily.dev/source-logo');
    const publishMessage = jest.fn().mockResolvedValue('message-id');
    jest.spyOn(pubsub, 'topic').mockImplementation((name: string) => {
      if (name === 'source-added') {
        return {
          publishMessage,
        } as never;
      }

      return {
        publishMessage: jest.fn(),
      } as never;
    });

    nock(process.env.SCRAPER_URL)
      .get('/scrape/source')
      .query({ url: 'https://example.com' })
      .reply(200, {
        type: 'website',
        website: 'https://example.com',
        logo: 'https://assets.example.com/logo.png',
        name: 'Example',
        rss: [{ title: 'RSS', url: 'https://example.com/feed.xml' }],
      });
    nock('https://assets.example.com')
      .get('/logo.png')
      .reply(200, 'logo-binary');

    const result = await mockClient.provision(
      {
        sourceId: 'example',
        scrapeMetadata: true,
        website: 'https://example.com',
        ingestion: {
          case: 'rss',
          value: new RssIngestion({
            feedUrl: 'https://example.com/feed.xml',
          }),
        },
      },
      defaultClientAuthOptions,
    );

    expect(result.source.createdAt).toEqual(expect.any(Number));
    expect(result).toMatchObject({
      source: {
        id: 'example',
        type: SourceType.Machine,
        active: true,
        name: 'Example',
        image: 'https://media.daily.dev/source-logo',
        private: false,
        handle: 'example',
        website: 'https://example.com',
      },
      ingestion: {
        engine: SourceEngine.RSS,
        url: 'https://example.com/feed.xml',
      },
    });
    expect(uploadLogo).toHaveBeenCalledTimes(1);
    expect(publishMessage).toHaveBeenCalledWith({
      json: {
        url: 'https://example.com/feed.xml',
        source_id: 'example',
        engine_id: 'rss',
      },
    });

    const source = await con.getRepository(MachineSource).findOneByOrFail({
      id: 'example',
    });
    expect(source).toMatchObject({
      id: 'example',
      name: 'Example',
      website: 'https://example.com',
      image: 'https://media.daily.dev/source-logo',
      handle: 'example',
    });
    const sourceFeed = await con.getRepository(SourceFeed).findOneByOrFail({
      sourceId: 'example',
      feed: 'https://example.com/feed.xml',
    });
    expect(sourceFeed).toMatchObject({
      sourceId: 'example',
      feed: 'https://example.com/feed.xml',
    });
  });

  it('should provision a page source with the default selector evaluator', async () => {
    const publishMessage = jest.fn().mockResolvedValue('message-id');
    jest.spyOn(pubsub, 'topic').mockImplementation((name: string) => {
      if (name === 'source-added') {
        return {
          publishMessage,
        } as never;
      }

      return {
        publishMessage: jest.fn(),
      } as never;
    });

    const result = await mockClient.provision(
      {
        sourceId: 'page-source',
        name: 'Page Source',
        website: 'https://page.example.com',
        image: 'https://media.daily.dev/page-source',
        ingestion: {
          case: 'page',
          value: new PageIngestion({
            pageUrl: 'https://page.example.com/archive',
            extraction: {
              selector: 'a.story-link',
            },
          }),
        },
      },
      defaultClientAuthOptions,
    );

    expect(result.source.createdAt).toEqual(expect.any(Number));
    expect(result).toMatchObject({
      source: {
        id: 'page-source',
        type: SourceType.Machine,
        active: true,
        name: 'Page Source',
        image: 'https://media.daily.dev/page-source',
        private: false,
        handle: 'page-source',
        website: 'https://page.example.com',
      },
      ingestion: {
        engine: SourceEngine.PAGE,
        url: 'https://page.example.com/archive',
        selector: 'a.story-link',
        evaluator:
          '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)',
      },
    });
    expect(publishMessage).toHaveBeenCalledWith({
      json: {
        url: 'https://page.example.com/archive',
        source_id: 'page-source',
        engine_id: 'page',
        options: {
          selector: 'a.story-link',
          evaluator:
            '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)',
        },
      },
    });
  });

  it('should provision a youtube channel source', async () => {
    const publishMessage = jest.fn().mockResolvedValue('message-id');
    jest.spyOn(pubsub, 'topic').mockImplementation((name: string) => {
      if (name === 'source-added') {
        return {
          publishMessage,
        } as never;
      }

      return {
        publishMessage: jest.fn(),
      } as never;
    });

    const result = await mockClient.provision(
      {
        sourceId: 'yt-source',
        name: 'YouTube Source',
        website: 'https://youtube.com/@dailydev',
        image: 'https://media.daily.dev/yt-source',
        ingestion: {
          case: 'youtubeChannel',
          value: {
            channelUrl: 'https://youtube.com/@dailydev',
          },
        },
      },
      defaultClientAuthOptions,
    );

    expect(result.source.createdAt).toEqual(expect.any(Number));
    expect(result).toMatchObject({
      source: {
        id: 'yt-source',
        type: SourceType.Machine,
        active: true,
        name: 'YouTube Source',
        image: 'https://media.daily.dev/yt-source',
        private: false,
        handle: 'yt-source',
        website: 'https://youtube.com/@dailydev',
      },
      ingestion: {
        engine: SourceEngine.YOUTUBE_CHANNEL,
        url: 'https://youtube.com/@dailydev',
      },
    });
    expect(publishMessage).toHaveBeenCalledWith({
      json: {
        url: 'https://youtube.com/@dailydev',
        source_id: 'yt-source',
        engine_id: 'youtube:channel',
      },
    });
    await expect(
      con.getRepository(SourceFeed).findOneBy({
        sourceId: 'yt-source',
        feed: 'https://youtube.com/@dailydev',
      }),
    ).resolves.toMatchObject({
      sourceId: 'yt-source',
      feed: 'https://youtube.com/@dailydev',
    });
  });

  it('should provision an rss newsletter source with selector extraction', async () => {
    const publishMessage = jest.fn().mockResolvedValue('message-id');
    jest.spyOn(pubsub, 'topic').mockImplementation((name: string) => {
      if (name === 'source-added') {
        return {
          publishMessage,
        } as never;
      }

      return {
        publishMessage: jest.fn(),
      } as never;
    });

    const result = await mockClient.provision(
      {
        sourceId: 'newsletter-source',
        name: 'Newsletter Source',
        website: 'https://newsletter.example.com',
        image: 'https://media.daily.dev/newsletter-source',
        ingestion: {
          case: 'rssNewsletter',
          value: {
            feedUrl: 'https://newsletter.example.com/feed.xml',
            extraction: {
              selector: 'a.newsletter-link',
            },
          },
        },
      },
      defaultClientAuthOptions,
    );

    expect(result.source.createdAt).toEqual(expect.any(Number));
    expect(result).toMatchObject({
      source: {
        id: 'newsletter-source',
        type: SourceType.Machine,
        active: true,
        name: 'Newsletter Source',
        image: 'https://media.daily.dev/newsletter-source',
        private: false,
        handle: 'newsletter-source',
        website: 'https://newsletter.example.com',
      },
      ingestion: {
        engine: SourceEngine.RSS_NEWSLETTER,
        url: 'https://newsletter.example.com/feed.xml',
        selector: 'a.newsletter-link',
        evaluator:
          '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)',
      },
    });
    expect(publishMessage).toHaveBeenCalledWith({
      json: {
        url: 'https://newsletter.example.com/feed.xml',
        source_id: 'newsletter-source',
        engine_id: 'rss_newsletter',
        options: {
          selector: 'a.newsletter-link',
          evaluator:
            '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)',
        },
      },
    });
    await expect(
      con.getRepository(SourceFeed).findOneBy({
        sourceId: 'newsletter-source',
        feed: 'https://newsletter.example.com/feed.xml',
      }),
    ).resolves.toMatchObject({
      sourceId: 'newsletter-source',
      feed: 'https://newsletter.example.com/feed.xml',
    });
  });

  it('should provision a twitter source with avatar upload and audience fit', async () => {
    const uploadLogo = jest
      .spyOn(cloudinary, 'uploadLogo')
      .mockResolvedValue('https://media.daily.dev/twitter-logo');
    const publishMessage = jest.fn().mockResolvedValue('message-id');
    jest.spyOn(pubsub, 'topic').mockImplementation((name: string) => {
      if (name === 'source-added') {
        return {
          publishMessage,
        } as never;
      }

      return {
        publishMessage: jest.fn(),
      } as never;
    });

    process.env.TWITTER_BEARER_TOKEN = 'token';
    nock('https://api.x.com')
      .get('/2/users/by/username/jack')
      .query({
        'user.fields': 'profile_image_url,name',
      })
      .reply(200, {
        data: {
          id: '1',
          name: 'Jack Dorsey',
          username: 'jack',
          profile_image_url:
            'https://pbs.twimg.com/profile_images/jack_normal.jpg',
        },
      });
    nock('https://pbs.twimg.com')
      .get('/profile_images/jack_400x400.jpg')
      .reply(200, 'avatar-binary');

    const result = await mockClient.provision(
      {
        sourceId: 'jack',
        ingestion: {
          case: 'twitterAccount',
          value: new TwitterAccountIngestion({
            username: 'jack',
            audienceFitThreshold: 0.42,
          }),
        },
      },
      defaultClientAuthOptions,
    );

    expect(result.source.createdAt).toEqual(expect.any(Number));
    expect(result).toMatchObject({
      source: {
        id: 'jack',
        type: SourceType.Machine,
        active: true,
        name: 'Jack Dorsey',
        image: 'https://media.daily.dev/twitter-logo',
        private: false,
        handle: 'jack',
        twitter: 'jack',
      },
      ingestion: {
        engine: SourceEngine.TWITTER_ACCOUNT,
        url: 'https://x.com/jack',
        twitterUsername: 'jack',
      },
    });
    expect(result.ingestion.audienceFitThreshold).toBeCloseTo(0.42, 5);
    expect(uploadLogo).toHaveBeenCalledTimes(1);
    expect(publishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        json: expect.objectContaining({
          url: 'https://x.com/jack',
          source_id: 'jack',
          engine_id: 'twitter:account',
          status: 'processing',
          options: expect.objectContaining({
            twitter_account: {
              username: 'jack',
            },
          }),
        }),
      }),
    );
    expect(
      publishMessage.mock.calls[0][0].json.options.audience_fit.threshold,
    ).toBeCloseTo(0.42, 5);

    const source = await con.getRepository(MachineSource).findOneByOrFail({
      id: 'jack',
    });
    expect(source).toMatchObject({
      id: 'jack',
      name: 'Jack Dorsey',
      twitter: 'jack',
      image: 'https://media.daily.dev/twitter-logo',
      handle: 'jack',
    });
    await expect(
      con.getRepository(SourceFeed).findOneBy({
        sourceId: 'jack',
      }),
    ).resolves.toBeNull();
  });
});
