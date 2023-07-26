import { Cron } from './cron';
import fetch, { RequestInit } from 'node-fetch';
import jsonexport from 'jsonexport';
import FormData from 'form-data';
import { DataSource } from 'typeorm';
import { PostType, UNKNOWN_SOURCE } from '../entity';
import { promisify } from 'util';
import { FastifyBaseLogger } from 'fastify';

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
}
export interface IPostsRepository {
  getForTinybirdExport(latest: Date): Promise<TinybirdPost[]>;
}

export class PostsRepository implements IPostsRepository {
  private readonly con: DataSource;

  constructor(con: DataSource) {
    this.con = con;
  }

  public async getForTinybirdExport(latest: Date): Promise<TinybirdPost[]> {
    return await this.con.query(
      `SELECT "id",
              "authorId"          AS "author_id",
              "createdAt"         AS "created_at",
              "metadataChangedAt" AS "metadata_changed_at",
              "creatorTwitter"    AS "creator_twitter",
              "sourceId"          AS "source_id",
              "tagsStr"           AS "tags_str",
              ("banned" or "deleted" or not "showOnFeed")::int AS "banned", "type" AS "post_type",
              "private"::int      AS "post_private",
              "contentCuration"   AS "content_curation",
              (SELECT "s"."type" FROM "source" AS "s" WHERE "s"."id" = "sourceId") AS "source_type"
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

const jsonexportPromise = promisify(jsonexport);

export type fetchfn = (
  url: RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

export enum TinybirdDatasourceMode {
  APPEND = 'append',
}

export interface ITinybirdClient {
  query<T>(query: string): Promise<TinybirdQueryResult<T>>;
  postToDatasource(
    datasource: string,
    mode: TinybirdDatasourceMode,
    csv: string,
  ): Promise<null | TinybirdError>;
}

export class TinybirdError {
  text: string;
  status: number;
}

export class TinybirdQueryResult<T> {
  error: TinybirdError | null;
  data: T[] | null;
  rows: number | null;
}

export class TinybirdClient implements ITinybirdClient {
  private readonly accessToken: string;
  private readonly host: string;
  private readonly fetch: fetchfn;
  constructor(accessToken: string, host: string, fetch: fetchfn) {
    this.accessToken = accessToken;
    this.host = host;
    this.fetch = fetch;
  }
  public async query<T>(query: string): Promise<TinybirdQueryResult<T>> {
    const url = `${this.host}/v0/sql`;

    const response = await this.fetch(url, {
      headers: this.headers(),
      body: query,
      method: 'POST',
    } as RequestInit);

    if (!response.ok) {
      const text = await response.text();
      return {
        error: {
          text: text,
          status: response.status,
        },
        data: null,
        rows: 0,
      };
    }

    const body = await response.json();
    return {
      error: null,
      data: body.data,
      rows: body.rows,
    };
  }

  public async postToDatasource(
    datasource: string,
    mode: TinybirdDatasourceMode,
    csv: string,
  ): Promise<null | TinybirdError> {
    const params = TinybirdClient.queryParams({
      name: datasource,
      mode: mode,
    });

    const url = `${this.host}/v0/datasources?${params}`;
    const body = new FormData();
    body.append('csv', csv);

    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: body,
    } as RequestInit);

    if (!response.ok) {
      const text = await response.text();
      return {
        text: text,
        status: response.status,
      } as TinybirdError;
    }

    return null;
  }

  private headers(): NonNullable<unknown> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  private static queryParams(params: NonNullable<unknown>): string {
    return Object.keys(params)
      .map(
        (key) =>
          encodeURIComponent(key) + '=' + encodeURIComponent(params[key]),
      )
      .join('&');
  }
}

interface LatestResult {
  error: TinybirdError | null;
  latest: Date | null;
}

export interface IPostsMetadataRepository {
  latest(): Promise<LatestResult>;
  append(posts: TinybirdPost[]): Promise<TinybirdError | null>;
}

export class PostsMetadataRepository implements IPostsMetadataRepository {
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

  public async latest(): Promise<LatestResult> {
    interface latest {
      latest: string;
    }

    const result = await this.tinybirdClient.query<latest>(this.latestQuery);
    if (result.error) {
      return {
        error: result.error,
        latest: null,
      };
    }

    if (result.rows === 0) {
      return {
        error: null,
        latest: null,
      };
    }

    return {
      error: null,
      latest: new Date(result.data[0].latest),
    };
  }

  public async append(posts: TinybirdPost[]): Promise<TinybirdError | null> {
    const csv: string = await jsonexportPromise(posts, {
      includeHeaders: false,
      typeHandlers: {
        Date: (date: Date) => date.toISOString(),
        Array: (arr: string[]) => {
          return '[' + arr.map((x) => `'${x}'`).join(', ') + ']';
        },
      },
    });

    return await this.tinybirdClient.postToDatasource(
      this.datasource,
      TinybirdDatasourceMode.APPEND,
      csv,
    );
  }
}

interface ExportResult {
  count: number | null;
  error: string | null;
}

export class TinybirdExportService {
  private readonly logger: FastifyBaseLogger;
  private readonly postsRepository: IPostsRepository;
  private readonly postsMetadataRepository: IPostsMetadataRepository;

  constructor(
    logger: FastifyBaseLogger,
    postsRepository: IPostsRepository,
    postsMetadataRepository: IPostsMetadataRepository,
  ) {
    this.logger = logger;
    this.postsRepository = postsRepository;
    this.postsMetadataRepository = postsMetadataRepository;
  }

  public async export(): Promise<ExportResult> {
    const latestResult = await this.postsMetadataRepository.latest();
    if (latestResult.error) {
      return {
        error: latestResult.error.text,
      } as ExportResult;
    }

    if (!latestResult.latest) {
      return {
        error: 'latest value is null',
      } as ExportResult;
    }

    const postsToExport = await this.postsRepository.getForTinybirdExport(
      latestResult.latest,
    );

    if (!postsToExport) {
      return {
        count: 0,
      } as ExportResult;
    }

    const appendResultError = await this.postsMetadataRepository.append(
      postsToExport,
    );

    if (appendResultError) {
      return {
        error: appendResultError.text,
      } as ExportResult;
    }

    return {
      count: postsToExport.length,
    } as ExportResult;
  }

  public async exportAndLog(): Promise<void> {
    const result = await this.export();
    if (result.error) {
      this.logger.error(
        { tinybirdResponse: result.error },
        `failed to replicate posts to tinybird`,
      );
      return;
    }

    if (result.count === 0) {
      this.logger.info('no posts to replicate');
      return;
    }

    this.logger.info(
      `${result.count} posts replicated successfully to tinybird`,
    );

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
