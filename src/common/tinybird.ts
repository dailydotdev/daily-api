import { RequestInit } from 'node-fetch';
import { promisify } from 'util';
import jsonexport from 'jsonexport';

export type fetchfn = (
  url: RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

export enum TinybirdDatasourceMode {
  APPEND = 'append',
}

export interface ITinybirdClient {
  query<T>(query: string): Promise<QueryResult<T>>;

  postToDatasource(
    datasource: string,
    mode: TinybirdDatasourceMode,
    csv: string,
  ): Promise<PostDatasourceResult>;
}

export class QueryResult<T> {
  data: T[] | null;
  rows: number | null;
}

export interface PostDatasourceResult {
  import_id: string;
  datasource: Datasource;
  quarantine_rows: number;
  invalid_lines: number;
  error: boolean;
  headers: unknown;
  type: string;
}

interface Datasource {
  id: string;
  name: string;
  cluster: string;
  tags: unknown;
  created_at: string;
  updated_at: string;
  replicated: boolean;
  version: number;
  // can be extended if needed
  // https://www.tinybird.co/docs/api-reference/datasource-api.html
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

  public async query<T>(query: string): Promise<QueryResult<T>> {
    const url = `${this.host}/v0/sql`;

    const response = await this.fetch(url, {
      headers: this.headers(),
      body: query,
      method: 'POST',
    } as RequestInit);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`tinybird response ${response.status}: ${text}`);
    }

    return (await response.json()) as QueryResult<T>;
  }

  public async postToDatasource(
    datasource: string,
    mode: TinybirdDatasourceMode,
    csv: string,
  ): Promise<PostDatasourceResult> {
    const params = TinybirdClient.queryParams({
      name: datasource,
      mode: mode,
    });

    const url = `${this.host}/v0/datasources?${params}`;
    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: csv,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`tinybird response ${response.status}: ${text}}`);
    }

    return (await response.json()) as PostDatasourceResult;
  }

  public static async Json2Csv<T>(records: T[]): Promise<string> {
    if (records.length === 0) {
      throw new Error('records length is 0');
    }

    const csv = await json2csv(records, {
      includeHeaders: false,
      typeHandlers: {
        Date: (date: Date) => date.toISOString(),
        Array: (arr: string[]) => {
          return '[' + arr.map((x) => `'${x}'`).join(', ') + ']';
        },
      },
    });

    return csv + '\n'; // according to standard, csv should end with crlf
  }

  private headers(): NonNullable<unknown> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  private static queryParams(params: NonNullable<unknown>): string {
    return Object.keys(params)
      .map(
        (key: string): string =>
          encodeURIComponent(key) + '=' + encodeURIComponent(params[key]),
      )
      .join('&');
  }
}

const json2csv = promisify(jsonexport);
