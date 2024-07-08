import { retryFetchParse } from './retry';
import { fetchOptions } from '../http';
import { Headers } from 'node-fetch';

export const meiliOrigin = process.env.MEILI_ORIGIN;
export const meiliToken = process.env.MEILI_TOKEN;
export const meiliIndex = process.env.MEILI_INDEX;

type Meili = {
  post_id: string;
  title?: string;
};
interface MeiliResponse {
  hits: Meili[];
  limit: number;
  offset: number;
  estimatedTotalHits: number;
}
export const searchMeili = async (
  params: string,
): Promise<{
  hits: Meili[];
  pagination: { limit: number; offset: number; total: number };
}> => {
  const headers = new Headers({
    Authorization: `Bearer ${meiliToken}`,
  });
  const requestOptions = {
    method: 'GET',
    headers,
  };
  const res = await retryFetchParse<MeiliResponse>(
    `${meiliOrigin}indexes/${meiliIndex}/search?${params}`,
    {
      ...fetchOptions,
      ...requestOptions,
    },
  );
  return {
    pagination: {
      limit: res.limit,
      offset: res.offset,
      total: res.estimatedTotalHits,
    },
    hits: res.hits,
  };
};
