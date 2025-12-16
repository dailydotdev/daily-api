import nock from 'nock';
import { TenorClient } from '../../../src/integrations/tenor/clients';
import { GarmrNoopService } from '../../../src/integrations/garmr';
import {
  deleteKeysByPattern,
  getRedisObject,
  getRedisObjectExpiry,
} from '../../../src/redis';

const TENOR_API_URL = 'https://tenor.googleapis.com';
const TENOR_SEARCH_PATH = '/v2/search';

describe('TenorClient', () => {
  const API_KEY = 'test-api-key';
  let client: TenorClient;

  beforeAll(() => {
    process.env.TENOR_GIF_SEARCH_URL = `${TENOR_API_URL}${TENOR_SEARCH_PATH}`;
  });

  beforeEach(async () => {
    nock.cleanAll();
    await deleteKeysByPattern('tenor:search:*');
    client = new TenorClient(API_KEY, { garmr: new GarmrNoopService() });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await deleteKeysByPattern('tenor:search:*');
  });

  describe('search', () => {
    const mockTenorResponse = {
      results: [
        {
          id: 'gif1',
          title: 'Funny cat',
          content_description: 'A funny cat',
          url: 'https://tenor.com/gif1',
          media_formats: {
            gif: { url: 'https://media.tenor.com/gif1.gif' },
            mediumgif: { url: 'https://media.tenor.com/gif1-medium.gif' },
          },
        },
        {
          id: 'gif2',
          title: 'Dancing dog',
          content_description: 'A dancing dog',
          url: 'https://tenor.com/gif2',
          media_formats: {
            gif: { url: 'https://media.tenor.com/gif2.gif' },
          },
        },
      ],
      next: 'next-page-token',
    };

    it('should return empty result for empty query', async () => {
      const result = await client.search({ q: '' });

      expect(result).toEqual({ gifs: [], next: undefined });
    });

    it('should fetch from API on cache miss', async () => {
      const scope = nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'cats',
          key: API_KEY,
          limit: '10',
        })
        .reply(200, mockTenorResponse);

      const result = await client.search({ q: 'cats' });

      expect(scope.isDone()).toBe(true);
      expect(result.gifs).toHaveLength(2);
      expect(result.gifs[0]).toEqual({
        id: 'gif1',
        url: 'https://media.tenor.com/gif1.gif',
        preview: 'https://media.tenor.com/gif1-medium.gif',
        title: 'A funny cat',
      });
      expect(result.next).toBe('next-page-token');
    });

    it('should cache results after API call', async () => {
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'dogs',
          key: API_KEY,
          limit: '10',
        })
        .reply(200, mockTenorResponse);

      await client.search({ q: 'dogs' });

      const cached = await getRedisObject('tenor:search:dogs:10');
      expect(cached).not.toBeNull();

      const parsedCache = JSON.parse(cached!);
      expect(parsedCache.gifs).toHaveLength(2);
      expect(parsedCache.next).toBe('next-page-token');
    });

    it('should return cached result on cache hit without calling API', async () => {
      // First call - should hit API
      const scope = nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'birds',
          key: API_KEY,
          limit: '10',
        })
        .reply(200, mockTenorResponse);

      await client.search({ q: 'birds' });
      expect(scope.isDone()).toBe(true);

      // Second call - should use cache, not API
      const secondScope = nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'birds',
          key: API_KEY,
          limit: '10',
        })
        .reply(200, { results: [], next: undefined });

      const result = await client.search({ q: 'birds' });

      // API should NOT have been called
      expect(secondScope.isDone()).toBe(false);
      // Should return cached result
      expect(result.gifs).toHaveLength(2);
      expect(result.next).toBe('next-page-token');
    });

    it('should cache with 3 hour TTL', async () => {
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'fish',
          key: API_KEY,
          limit: '10',
        })
        .reply(200, mockTenorResponse);

      await client.search({ q: 'fish' });

      const ttl = await getRedisObjectExpiry('tenor:search:fish:10');
      const threeHoursInSeconds = 3 * 60 * 60;

      // TTL should be approximately 3 hours (allow 10 seconds tolerance)
      expect(ttl).toBeLessThanOrEqual(threeHoursInSeconds);
      expect(ttl).toBeGreaterThanOrEqual(threeHoursInSeconds - 10);
    });

    it('should NOT cache rate limited responses', async () => {
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'ratelimited',
          key: API_KEY,
          limit: '10',
        })
        .reply(429);

      const result = await client.search({ q: 'ratelimited' });

      expect(result).toEqual({ gifs: [], next: undefined });

      const cached = await getRedisObject('tenor:search:ratelimited:10');
      expect(cached).toBeNull();
    });

    it('should preserve pagination position when rate limited', async () => {
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'test',
          key: API_KEY,
          limit: '10',
          pos: 'page-2',
        })
        .reply(429);

      const result = await client.search({ q: 'test', pos: 'page-2' });

      expect(result).toEqual({ gifs: [], next: 'page-2' });
    });

    it('should use separate cache keys for different pagination positions', async () => {
      // First page
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'animals',
          key: API_KEY,
          limit: '10',
        })
        .reply(200, {
          results: [mockTenorResponse.results[0]],
          next: 'page-2',
        });

      // Second page
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'animals',
          key: API_KEY,
          limit: '10',
          pos: 'page-2',
        })
        .reply(200, {
          results: [mockTenorResponse.results[1]],
          next: 'page-3',
        });

      const page1 = await client.search({ q: 'animals' });
      const page2 = await client.search({ q: 'animals', pos: 'page-2' });

      expect(page1.gifs).toHaveLength(1);
      expect(page1.gifs[0].id).toBe('gif1');
      expect(page1.next).toBe('page-2');

      expect(page2.gifs).toHaveLength(1);
      expect(page2.gifs[0].id).toBe('gif2');
      expect(page2.next).toBe('page-3');

      // Verify separate cache keys
      const cachedPage1 = await getRedisObject('tenor:search:animals:10');
      const cachedPage2 = await getRedisObject(
        'tenor:search:animals:10:page-2',
      );

      expect(cachedPage1).not.toBeNull();
      expect(cachedPage2).not.toBeNull();
      expect(JSON.parse(cachedPage1!).next).toBe('page-2');
      expect(JSON.parse(cachedPage2!).next).toBe('page-3');
    });

    it('should use separate cache keys for different limits', async () => {
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'test',
          key: API_KEY,
          limit: '5',
        })
        .reply(200, mockTenorResponse);

      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'test',
          key: API_KEY,
          limit: '20',
        })
        .reply(200, mockTenorResponse);

      await client.search({ q: 'test', limit: 5 });
      await client.search({ q: 'test', limit: 20 });

      const cached5 = await getRedisObject('tenor:search:test:5');
      const cached20 = await getRedisObject('tenor:search:test:20');

      expect(cached5).not.toBeNull();
      expect(cached20).not.toBeNull();
    });

    it('should throw error on API failure (non-429)', async () => {
      nock(TENOR_API_URL)
        .get(TENOR_SEARCH_PATH)
        .query({
          q: 'error',
          key: API_KEY,
          limit: '10',
        })
        .reply(500, 'Internal Server Error');

      await expect(client.search({ q: 'error' })).rejects.toThrow(
        'Tenor API error: 500 Internal Server Error',
      );

      // Should not cache error responses
      const cached = await getRedisObject('tenor:search:error:10');
      expect(cached).toBeNull();
    });
  });
});
