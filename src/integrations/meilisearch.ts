import { retryFetchParse } from './retry';
import { fetchOptions } from '../http';
import { Headers } from 'node-fetch';

const meiliOrigin = process.env.MEILI_ORIGIN;
const meiliToken = process.env.MEILI_TOKEN;
const meiliIndex = process.env.MEILI_INDEX;

type Meili = {
  post_id: string;
};
interface MeiliResponse {
  hits: Meili[];
}
export const searchMeili = async (params: string): Promise<Meili[]> => {
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
  return res.hits;
};
