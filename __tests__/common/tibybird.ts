import {
  fetchfn,
  TinybirdClient,
  TinybirdDatasourceMode,
} from '../../src/common/tinybird';
import { RequestInit } from 'node-fetch';

describe('TinybirdClient', () => {
  const mockAccessToken = 'token';
  const mockHost = 'https://tinybird.co';
  const mockQuery = 'query';

  it('query success', async () => {
    const mockFetch = async (
      url: RequestInfo,
      init?: RequestInit,
    ): Promise<Response> => {
      expect(url).toEqual('https://tinybird.co/v0/sql');
      expect(init).toEqual({
        headers: {
          Authorization: 'Bearer token',
        },
        method: 'POST',
        body: mockQuery,
      });

      return {
        ok: true,
        json: async () => {
          return {
            data: [
              {
                foo: 'bar',
              },
            ],
            rows: 1,
          };
        },
      } as Response;
    };

    const client = new TinybirdClient(
      mockAccessToken,
      mockHost,
      mockFetch as unknown as fetchfn,
    );

    const result = await client.query(mockQuery);
    expect(result.rows).toEqual(1);
    expect(result.data).toEqual([
      {
        foo: 'bar',
      },
    ]);
  });

  it('query error', async () => {
    const mockFetch = async (): Promise<Response> => {
      return {
        ok: false,
        text: async (): Promise<string> => {
          return 'oops!';
        },
        status: 500,
      } as Response;
    };

    const client = new TinybirdClient(
      mockAccessToken,
      mockHost,
      mockFetch as unknown as fetchfn,
    );

    await expect(async () => {
      await client.query(mockQuery);
    }).rejects.toThrow('tinybird response 500: oops!');
  });

  const mockDatasource = 'datasouce';
  const mockCsv = 'csv content';
  const expectedMode = TinybirdDatasourceMode.APPEND;

  it('postToDatasource success', async () => {
    const mockFetch = async (
      url: RequestInfo,
      init?: RequestInit,
    ): Promise<Response> => {
      expect(url).toEqual(
        'https://tinybird.co/v0/datasources?name=datasouce&mode=append',
      );
      expect(init).toEqual({
        headers: {
          Authorization: 'Bearer token',
        },
        method: 'POST',
        body: mockCsv,
      });

      return {
        ok: true,
        json: async () => {
          return {
            data: 'dummy data',
          };
        },
      } as Response;
    };

    const client = new TinybirdClient(
      mockAccessToken,
      mockHost,
      mockFetch as unknown as fetchfn,
    );

    const result = await client.postToDatasource(
      mockDatasource,
      expectedMode,
      mockCsv,
    );

    expect(result).toEqual({
      data: 'dummy data',
    });
  });

  it('postToDatasource error', async () => {
    const mockFetch = async (): Promise<Response> => {
      return {
        ok: false,
        text: async (): Promise<string> => {
          return 'oops!';
        },
        status: 500,
      } as Response;
    };

    const client = new TinybirdClient(
      mockAccessToken,
      mockHost,
      mockFetch as unknown as fetchfn,
    );

    await expect(async () => {
      await client.postToDatasource(mockDatasource, expectedMode, mockCsv);
    }).rejects.toThrow('tinybird response 500: oops!');
  });

  it('json2csv date', async () => {
    const records = [
      {
        column1: 'test',
        column2: new Date('2023-07-27T16:47:33+0000'),
      },
    ];

    const expectedCsv = 'test,2023-07-27T16:47:33.000Z';

    const got = await TinybirdClient.json2csv(records);
    expect(got).toEqual(expectedCsv);
  });

  it('json2csv arrays', async () => {
    const records = [
      {
        column1: 'test',
        column2: ['foo', 'bar'],
      },
    ];

    const expectedCsv = "test,\"['foo', 'bar']\"";

    const got = await TinybirdClient.json2csv(records);
    expect(got).toEqual(expectedCsv);
  });

  it('json2csv empty input', async () => {
    await expect(async () => {
      await TinybirdClient.json2csv([]);
    }).rejects.toThrow('records length is 0');
  });

  it('json2csv should respect column orders', async () => {
    const records = [
      {
        column1: 'test',
        column2: new Date('2023-07-27T16:47:33+0000'),
      },
    ];

    const expectedCsv = '2023-07-27T16:47:33.000Z,test';

    const columns = ['column2', 'column1'];
    const got = await TinybirdClient.json2csv(records, columns);
    expect(got).toEqual(expectedCsv);
  });

  it('json2csv should throw an exception if headers specified wrong', async () => {
    const records = [
      {
        column1: 'test',
        column2: new Date('2023-07-27T16:47:33+0000'),
      },
    ];

    const columns = ['column2'];
    await expect(async () => {
      await TinybirdClient.json2csv(records, columns);
    }).rejects.toThrow(
      'object has different properties than specified in header',
    );
  });

  it('json2csv should throw an exception if headers is not defined in a object', async () => {
    const records = [
      {
        column1: 'test',
      },
    ];

    const columns = ['column2'];
    await expect(async () => {
      await TinybirdClient.json2csv(records, columns);
    }).rejects.toThrow('column2 is not defined in object');
  });
});
