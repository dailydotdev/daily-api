import { RequestInit } from 'node-fetch';
import { promisify } from 'util';
import jsonexport from 'jsonexport';
import { forEach } from 'lodash';

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

const json2csv = promisify(jsonexport);
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

  public static async json2csv<T extends object>(
    records: T[],
    headers?: string[],
  ): Promise<string> {
    if (records.length === 0) {
      throw new Error('records length is 0');
    }

    if (headers && Object.keys(records[0]).length !== headers.length) {
      throw new Error('object has more properties than specified in header');
    }

    forEach(headers, (column: string): void => {
      if (!(column in records[0])) {
        throw new Error(`${column} is not defined in object`);
      }
    });

    return await json2csv(records, {
      headers: headers,
      includeHeaders: false,
      typeHandlers: {
        Date: (date: Date) => date.toISOString(),
        Array: (arr: string[]): string => {
          return '[' + arr.map((x) => `'${x}'`).join(', ') + ']';
        },
      },
    });
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
