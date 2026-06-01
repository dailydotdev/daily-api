import fetch from 'node-fetch';
import { GarmrService, IGarmrService, GarmrNoopService } from '../garmr';
import type { Gif } from '../../entity/UserIntegration';
import {
  IKlipyClient,
  KlipySearchParams,
  KlipySearchResult,
  KlipySearchResponse,
  KlipyGif,
} from './types';
import { getRedisObject, setRedisObjectWithExpiry } from '../../redis';

const KLIPY_CACHE_TTL_SECONDS = 3 * 60 * 60; // 3 hours
const KLIPY_CACHE_KEY_PREFIX = 'klipy:search';

const generateCacheKey = (params: KlipySearchParams): string => {
  const { q, limit = 10, pos } = params;
  const parts = [KLIPY_CACHE_KEY_PREFIX, q, limit.toString()];
  if (pos) {
    parts.push(pos);
  }
  return parts.join(':');
};

export class KlipyClient implements IKlipyClient {
  private readonly apiKey: string;
  public readonly garmr: IGarmrService;

  constructor(
    apiKey: string,
    options?: {
      garmr?: IGarmrService;
    },
  ) {
    this.apiKey = apiKey;
    this.garmr = options?.garmr || new GarmrNoopService();
  }

  async search(params: KlipySearchParams): Promise<KlipySearchResult> {
    const { q, limit = 10, pos } = params;

    if (!q) {
      return { gifs: [], next: undefined };
    }

    const cacheKey = generateCacheKey(params);

    const cached = await getRedisObject(cacheKey);
    if (cached) {
      return JSON.parse(cached) as KlipySearchResult;
    }

    return this.garmr.execute(async () => {
      const searchParams = new URLSearchParams({
        q,
        key: this.apiKey,
        limit: limit.toString(),
      });

      if (pos) {
        searchParams.append('pos', pos);
      }

      const response = await fetch(
        `${process.env.KLIPY_GIF_SEARCH_URL}?${searchParams.toString()}`,
      );

      if (response.status === 429) {
        // if rate limited, return empty result but preserve pagination position
        return { gifs: [], next: pos };
      }

      if (!response.ok) {
        throw new Error(
          `Klipy API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as KlipySearchResponse;

      const gifs: Gif[] = data.results.map((item: KlipyGif) => ({
        id: item.id,
        url: item.media_formats.gif?.url || '',
        preview:
          item.media_formats.mediumgif?.url ||
          item.media_formats.gif?.url ||
          '',
        title: item.content_description || item.title || '',
      }));

      const result: KlipySearchResult = {
        gifs,
        next: data.next,
      };

      await setRedisObjectWithExpiry(
        cacheKey,
        JSON.stringify(result),
        KLIPY_CACHE_TTL_SECONDS,
      );

      return result;
    });
  }
}

const garmrKlipyService = new GarmrService({
  service: 'klipy',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
    minimumRps: 0,
  },
  retryOpts: {
    maxAttempts: 2,
    backoff: 100,
  },
});

export const klipyClient = new KlipyClient(process.env.KLIPY_API_KEY!, {
  garmr: garmrKlipyService,
});
