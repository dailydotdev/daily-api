import { DataSource } from 'typeorm';
import { saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { ArticlePost, PostTag, Source, User } from '../../src/entity';
import { sourcesFixture } from '../fixture/source';
import { postsFixture, postTagsFixture } from '../fixture/post';
import {
  IPostsMetadataRepository,
  IPostsRepository,
  PostsMetadataRepository,
  PostsRepository,
  TinybirdExportService,
  TinybirdPost,
} from '../../src/cron/exportToTinybird';
import * as fs from 'fs';
import * as path from 'path';
import {
  ITinybirdClient,
  TinybirdDatasourceMode,
  PostDatasourceResult,
  QueryResult,
} from '../../src/common/tinybird';
import { FastifyBaseLogger } from 'fastify';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
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

describe('PostsRepository', () => {
  it('should return posts to export to tinybird with specific properties', async () => {
    const now = new Date();
    const latest = new Date(now.getTime() - 10000);
    const repo = new PostsRepository(con);

    const posts = await repo.getForTinybirdExport(latest);
    posts.forEach((post) => {
      post.created_at = '';
      post.metadata_changed_at = '';
    });
    expect(posts).toMatchSnapshot();
  });
});

describe('PostsMetadataRepository', () => {
  const dataSource = 'datasource_mock';

  it('append success', async () => {
    const expectedCsv = fs
      .readFileSync(
        path.resolve(__dirname, './testdata/expected_tinybird_export.csv'),
      )
      .toString();

    const tinybirdMock = {
      postToDatasource: async (
        datasource: string,
        mode: TinybirdDatasourceMode,
        csv: string,
      ): Promise<PostDatasourceResult> => {
        expect(datasource).toEqual(dataSource);
        expect(mode).toEqual(TinybirdDatasourceMode.APPEND);
        expect(csv).toEqual(expectedCsv);

        return {} as PostDatasourceResult;
      },
    } as ITinybirdClient;

    const postsMetadataRepository = new PostsMetadataRepository(
      tinybirdMock,
      dataSource,
    );

    const posts: TinybirdPost[] = [
      {
        id: 'id1',
        author_id: 'author_id1',
        created_at: 'created_at',
        metadata_changed_at: 'metadata_changed_at',
        creator_twitter: 'creator_twitter',
        source_id: 'source_id',
        tags_str: 'tags_str',
        post_type: 'post_type',
        post_private: 1,
        content_curation: ['content_curation'],
        source_type: 'source_type',
      },
      {
        id: 'id2',
        author_id: 'author_id2',
        created_at: 'created_at2',
        metadata_changed_at: 'metadata_changed_at2',
        creator_twitter: 'creator_twitter2',
        source_id: 'source_id2',
        tags_str: 'tags_str2',
        post_type: 'post_type2',
        post_private: 1,
        content_curation: ['content_curation1', 'content_curation2'],
        source_type: 'source_type2',
      },
    ];

    await postsMetadataRepository.append(posts);
  });

  it('latest success', async () => {
    const time = '2023-07-27T17:11:23Z';
    const tinybirdClientMock = {
      query: async (): Promise<QueryResult<unknown>> => {
        return {
          rows: 1,
          data: [
            {
              latest: time,
            },
          ],
        } as QueryResult<unknown>;
      },
    } as unknown as ITinybirdClient;

    const postsMetadataRepository = new PostsMetadataRepository(
      tinybirdClientMock,
      dataSource,
    );

    const latest = await postsMetadataRepository.latest();
    expect(latest).toEqual(new Date(time));
  });

  it('latest tinybird returned zero rows', async () => {
    const tinybirdClientMock = {
      query: async (): Promise<QueryResult<unknown>> => {
        return {
          rows: 0,
        } as QueryResult<unknown>;
      },
    } as unknown as ITinybirdClient;

    const postsMetadataRepository = new PostsMetadataRepository(
      tinybirdClientMock,
      dataSource,
    );

    await expect(async () => {
      await postsMetadataRepository.latest();
    }).rejects.toThrow('no rows returned');
  });
});

describe('TinybirdExportService', () => {
  const mockLatest = new Date('2023-04-11 13:52:32.842861');

  it('should export correctly', async () => {
    const logger = {} as FastifyBaseLogger;
    const mockPosts = [
      {
        id: 'id',
      } as TinybirdPost,
    ];

    const postsRepositoryMock = {
      async getForTinybirdExport(latest: Date): Promise<TinybirdPost[]> {
        expect(latest).toEqual(mockLatest);
        return mockPosts;
      },
    } as IPostsRepository;

    const postsMetadataRepositoryMock = {
      async latest(): Promise<Date> {
        return mockLatest;
      },
      async append(posts: TinybirdPost[]): Promise<PostDatasourceResult> {
        expect(posts).toEqual(mockPosts);
        return {} as PostDatasourceResult;
      },
    } as IPostsMetadataRepository;

    const service = new TinybirdExportService(
      logger,
      postsRepositoryMock,
      postsMetadataRepositoryMock,
    );

    const result = await service.export();
    expect(result).toEqual({
      exported: 1,
      since: mockLatest,
      tinybird: {},
    });
  });

  it("shouldn't export if posts repository returned 0 posts", async () => {
    const logger = {} as FastifyBaseLogger;
    const postsRepositoryMock = {
      async getForTinybirdExport(): Promise<TinybirdPost[]> {
        return [];
      },
    } as IPostsRepository;

    const postsMetadataRepositoryMock = {
      async latest(): Promise<Date> {
        return mockLatest;
      },
    } as IPostsMetadataRepository;

    const service = new TinybirdExportService(
      logger,
      postsRepositoryMock,
      postsMetadataRepositoryMock,
    );

    const result = await service.export();
    expect(result).toEqual({
      exported: 0,
      since: mockLatest,
      tinybird: null,
    });
  });

  it('should log exception if occurred', async () => {
    const logger = {
      error: (obj, msg) => {
        expect(obj.error).toEqual('ooops!');
        expect(obj.stack).toBeDefined();
        expect(msg).toEqual('failed to replicate posts to tinybird');
      },
    } as FastifyBaseLogger;
    const postsRepositoryMock = {} as IPostsRepository;

    const postsMetadataRepositoryMock = {
      async latest(): Promise<Date> {
        throw new Error('ooops!');
      },
    } as IPostsMetadataRepository;

    const service = new TinybirdExportService(
      logger,
      postsRepositoryMock,
      postsMetadataRepositoryMock,
    );

    await service.exportAndLog();
  });

  it('should log if no posts to be exported', async () => {
    const logger = {
      info: (obj, msg) => {
        expect(obj).toEqual({
          exported: 0,
          since: mockLatest,
          tinybird: null,
        });
        expect(msg).toEqual('no posts to replicate');
      },
    } as FastifyBaseLogger;
    const postsRepositoryMock = {
      async getForTinybirdExport(): Promise<TinybirdPost[]> {
        return [];
      },
    } as IPostsRepository;
    const postsMetadataRepositoryMock = {
      async latest(): Promise<Date> {
        return mockLatest;
      },
    } as IPostsMetadataRepository;

    const service = new TinybirdExportService(
      logger,
      postsRepositoryMock,
      postsMetadataRepositoryMock,
    );

    await service.exportAndLog();
  });

  it('should log about posts successfully replicated', async () => {
    const logger = {
      info: (obj, msg) => {
        expect(obj).toEqual({
          exported: 1,
          since: mockLatest,
          tinybird: {},
        });
        expect(msg).toEqual('posts replicated successfully to tinybird');
      },
    } as FastifyBaseLogger;
    const postsRepositoryMock = {
      async getForTinybirdExport(): Promise<TinybirdPost[]> {
        return [{} as TinybirdPost];
      },
    } as IPostsRepository;
    const postsMetadataRepositoryMock = {
      async latest(): Promise<Date> {
        return mockLatest;
      },
      async append(): Promise<PostDatasourceResult> {
        return {} as PostDatasourceResult;
      },
    } as IPostsMetadataRepository;

    const service = new TinybirdExportService(
      logger,
      postsRepositoryMock,
      postsMetadataRepositoryMock,
    );

    await service.exportAndLog();
  });
});
