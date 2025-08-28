import { createClient, type ClickHouseClient } from '@clickhouse/client';
import * as clickhouseCommon from '../../src/common/clickhouse';

export const mockClickhouseClientOnce = () => {
  const clientMock = createClient({});

  jest
    .spyOn(clickhouseCommon, 'getClickHouseClient')
    .mockImplementationOnce(() => {
      return clientMock;
    });

  return clientMock;
};

export const mockClickhouseQueryJSONOnce = <T>(
  client: ClickHouseClient,
  data: T,
): jest.SpyInstance => {
  return jest.spyOn(client, 'query').mockImplementationOnce(() => {
    return {
      json: async () => {
        return data;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });
};
