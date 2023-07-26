import { RequestInit } from 'node-fetch';
import FormData from 'form-data';
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
  query<T>(query: string): Promise<TinybirdQueryResult<T>>;
  postToDatasource(
    datasource: string,
    mode: TinybirdDatasourceMode,
    csv: string,
  ): Promise<TinybirdPostDatasourceResult>;
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

export interface TinybirdPostDatasourceSuccess {
  datasources: TinybirdPostDatasources[];
}

export interface TinybirdPostDatasources {
  id: string;
  name: string;
  // can be extended if needed
  // https://www.tinybird.co/docs/api-reference/datasource-api.html
}

export class TinybirdPostDatasourceResult {
  error: TinybirdError | null;
  success: TinybirdPostDatasourceSuccess | null;
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
  ): Promise<TinybirdPostDatasourceResult> {
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
        error: {
          text: text,
          status: response.status,
        },
        success: null,
      };
    }

    const success = await response.json();
    return {
      success: success as TinybirdPostDatasourceSuccess,
      error: null,
    };
  }

  public static async Json2Csv(object: unknown): Promise<string> {
    return await json2csv(object, {
      includeHeaders: false,
      typeHandlers: {
        Date: (date: Date) => date.toISOString(),
        Array: (arr: string[]) => {
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

const json2csv = promisify(jsonexport);
