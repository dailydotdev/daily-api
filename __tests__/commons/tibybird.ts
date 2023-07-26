import { fetchfn, TinybirdClient } from '../../src/common/tinybird';
import { RequestInit } from 'node-fetch';

describe('TinybirdClient', () => {
  it('query success', async () => {
    const mockAccessToken = 'token';
    const mockHost = 'https://tinybird.co';
    const mockQuery = 'query';
    const mockFetch = async (
      url: RequestInfo,
      init?: RequestInit,
    ): Promise<Response> => {
      expect(url).toEqual('https://tinybird.co/v0/sql');
      expect(init.headers).toEqual({
        Authorization: 'Bearer token',
      });
      expect(init.method).toEqual('POST');
      expect(init.body).toEqual(mockQuery);

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
});
