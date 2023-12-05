import { Cron } from './cron';
import { DataSource } from 'typeorm';
import { PostType, UNKNOWN_SOURCE } from '../entity';
import { FastifyBaseLogger } from 'fastify';
import {
  fetchfn,
  ITinybirdClient,
  PostDatasourceResult,
  TinybirdClient,
  TinybirdDatasourceMode,
} from '../common/tinybird';

export interface TinybirdPost {
  id: string;
  author_id: string | null;
  created_at: string;
  metadata_changed_at: string;
  creator_twitter: string | null;
  source_id: string;
  tags_str: string | null;
  post_type: string;
  post_private: number;
  content_curation: string[];
  source_type: string;
  banned: number;
  flags_json_str: string;
}

export interface PostsRepositoryDependency {
  getForTinybirdExport(latest: Date): Promise<TinybirdPost[]>;
}

export class PostsRepository implements PostsRepositoryDependency {
  private readonly con: DataSource;

  constructor(con: DataSource) {
    this.con = con;
  }

  public async getForTinybirdExport(latest: Date): Promise<TinybirdPost[]> {
    // remember to keep updated with columns in csv
    return await this.con.query(
      `SELECT "id",
              COALESCE("scoutId", "authorId") AS "author_id",
              "createdAt"         AS "created_at",
              "metadataChangedAt" AS "metadata_changed_at",
              "creatorTwitter"    AS "creator_twitter",
              "sourceId"          AS "source_id",
              "tagsStr"           AS "tags_str",
              ("banned" or "deleted" or not "showOnFeed")::int AS "banned",
              "type"              AS "post_type",
              "private"::int      AS "post_private",
              "contentCuration"   AS "content_curation",
              (SELECT "s"."type" FROM "source" AS "s" WHERE "s"."id" = "sourceId") AS "source_type",
              flags::varchar      AS flags_json_str
       FROM "post"
       WHERE "metadataChangedAt" > $1
         and "sourceId" != '${UNKNOWN_SOURCE}'
         and "visible" = true
         and "type" != '${PostType.Welcome}'
      `,
      [latest],
    );
  }
}

export interface PostsMetadataRepositoryDependency {
  latest(): Promise<Date>;

  append(posts: TinybirdPost[]): Promise<PostDatasourceResult>;
}

export class PostsMetadataRepository
  implements PostsMetadataRepositoryDependency
{
  private readonly tinybirdClient: ITinybirdClient;
  private readonly datasource: string;
  private readonly latestQuery: string;

  constructor(tinybirdClient: ITinybirdClient, datasource: string) {
    this.tinybirdClient = tinybirdClient;
    this.datasource = datasource;

    this.latestQuery = `
      SELECT
          max(metadata_changed_at) as latest
      FROM ${datasource}
      FORMAT JSON
    `;
  }

  public async latest(): Promise<Date> {
    interface latest {
      latest: string;
    }

    const result = await this.tinybirdClient.query<latest>(this.latestQuery);
    if (result.rows === 0) {
      throw new Error('no rows returned');
    }

    return new Date(result.data[0].latest);
  }

  // Important! make sure columns are following tinybird schema
  // tinybird accepts csv files without headers
  // To prevent silently consuming csv with a wrong column order,
  // it set explicitly.
  // If more columns exist, they will be added anyway
  private readonly csv_header: string[] = [
    'id',
    'author_id',
    'created_at',
    'metadata_changed_at',
    'creator_twitter',
    'source_id',
    'tags_str',
    'banned',
    'post_type',
    'post_private',
    'content_curation',
    'source_type',
    'flags_json_str',
  ];

  public async append(posts: TinybirdPost[]): Promise<PostDatasourceResult> {
    const csv: string = await TinybirdClient.json2csv(posts, this.csv_header);

    return await this.tinybirdClient.postToDatasource(
      this.datasource,
      TinybirdDatasourceMode.APPEND,
      csv,
    );
  }
}

export interface TinybirdExportResult {
  exported: number;
  since: Date;
  tinybird: PostDatasourceResult;
}

export class TinybirdExportService {
  private readonly logger: FastifyBaseLogger;
  private readonly postsRepository: PostsRepositoryDependency;
  private readonly postsMetadataRepository: PostsMetadataRepositoryDependency;

  constructor(
    logger: FastifyBaseLogger,
    postsRepository: PostsRepositoryDependency,
    postsMetadataRepository: PostsMetadataRepositoryDependency,
  ) {
    this.logger = logger;
    this.postsRepository = postsRepository;
    this.postsMetadataRepository = postsMetadataRepository;
  }

  public async export(): Promise<TinybirdExportResult> {
    const latest = await this.postsMetadataRepository.latest();
    const postsToExport =
      await this.postsRepository.getForTinybirdExport(latest);

    if (postsToExport.length === 0) {
      return {
        since: latest,
        exported: 0,
        tinybird: null,
      };
    }

    const tinybirdResult =
      await this.postsMetadataRepository.append(postsToExport);

    return {
      since: latest,
      exported: postsToExport.length,
      tinybird: tinybirdResult,
    };
  }

  public async exportAndLog(): Promise<void> {
    let result: TinybirdExportResult;

    try {
      result = await this.export();
    } catch (err) {
      this.logger.error({ err }, 'failed to replicate posts to tinybird');
      return;
    }

    if (result.exported === 0) {
      this.logger.info(result, 'no posts to replicate');
      return;
    }

    this.logger.info(result, 'posts replicated successfully to tinybird');
    return;
  }
}

const cron: Cron = {
  name: 'export-to-tinybird',
  handler: async (con, logger) => {
    const postsRepository = new PostsRepository(con);
    const tinybirdClient = new TinybirdClient(
      process.env.TINYBIRD_TOKEN,
      process.env.TINYBIRD_HOST,
      fetch as unknown as fetchfn,
    );
    const postsMetadataRepository = new PostsMetadataRepository(
      tinybirdClient,
      'posts_metadata',
    );
    const exportService = new TinybirdExportService(
      logger,
      postsRepository,
      postsMetadataRepository,
    );

    await exportService.exportAndLog();
  },
};
export default cron;
