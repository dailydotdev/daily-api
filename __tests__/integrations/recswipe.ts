import nock from 'nock';
import { RecswipeClient } from '../../src/integrations/recswipe/clients';
import { HttpError } from '../../src/integrations/retry';

const url = 'http://recswipe.local:8000';

beforeEach(() => {
  nock.cleanAll();
});

describe('RecswipeClient.discoverPosts', () => {
  it('should POST snake_case body with defaults to /api/discover-posts', async () => {
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string | string[]> = {};

    nock(url)
      .post('/api/discover-posts', (body) => {
        capturedBody = body;
        return true;
      })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [
          200,
          {
            posts: [
              {
                post_id: 'p1',
                title: 'Hello',
                summary: 'Summary',
                tags: ['rust'],
                url: 'https://example.com/p1',
                source_id: 'src-1',
              },
            ],
            sub_prompts: ['rust developer'],
          },
        ];
      });

    const client = new RecswipeClient(url);
    const response = await client.discoverPosts('user-1', { prompt: 'rust' });

    expect(capturedBody).toEqual({
      prompt: 'rust',
      selected_tags: [],
      confirmed_tags: [],
      liked_titles: [],
      exclude_ids: [],
      saturated_tags: [],
      n: 8,
    });
    expect(capturedHeaders['x-user-id']).toEqual(
      expect.arrayContaining(['user-1']),
    );
    expect(capturedHeaders['content-type']).toEqual(
      expect.arrayContaining(['application/json']),
    );
    expect(response).toEqual({
      posts: [
        {
          post_id: 'p1',
          title: 'Hello',
          summary: 'Summary',
          tags: ['rust'],
          url: 'https://example.com/p1',
          source_id: 'src-1',
        },
      ],
      sub_prompts: ['rust developer'],
    });
  });

  it('should forward all camelCase params as snake_case', async () => {
    let capturedBody: unknown;

    nock(url)
      .post('/api/discover-posts', (body) => {
        capturedBody = body;
        return true;
      })
      .reply(200, { posts: [], sub_prompts: [] });

    const client = new RecswipeClient(url);
    await client.discoverPosts('user-1', {
      prompt: 'go',
      selectedTags: ['go'],
      confirmedTags: ['backend'],
      likedTitles: ['Title A'],
      excludeIds: ['p1', 'p2'],
      saturatedTags: ['javascript'],
      n: 4,
    });

    expect(capturedBody).toEqual({
      prompt: 'go',
      selected_tags: ['go'],
      confirmed_tags: ['backend'],
      liked_titles: ['Title A'],
      exclude_ids: ['p1', 'p2'],
      saturated_tags: ['javascript'],
      n: 4,
    });
  });

  it('should omit X-User-Id header when userId is undefined', async () => {
    let capturedHeaders: Record<string, string | string[]> = {};

    nock(url)
      .post('/api/discover-posts')
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [200, { posts: [], sub_prompts: [] }];
      });

    const client = new RecswipeClient(url);
    await client.discoverPosts(undefined, { prompt: 'go' });

    expect(capturedHeaders['x-user-id']).toBeUndefined();
  });

  it('should propagate HttpError on 4xx responses', async () => {
    nock(url).post('/api/discover-posts').reply(400, 'bad request');

    const client = new RecswipeClient(url);
    await expect(
      client.discoverPosts('user-1', { prompt: 'rust' }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe('RecswipeClient.extractTags', () => {
  it('should POST prompt body to /api/extract-tags and return tags', async () => {
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string | string[]> = {};

    nock(url)
      .post('/api/extract-tags', (body) => {
        capturedBody = body;
        return true;
      })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [200, { tags: ['rust', 'systems'] }];
      });

    const client = new RecswipeClient(url);
    const response = await client.extractTags('user-1', {
      prompt: 'I like rust and systems programming',
    });

    expect(capturedBody).toEqual({
      prompt: 'I like rust and systems programming',
    });
    expect(capturedHeaders['x-user-id']).toEqual(
      expect.arrayContaining(['user-1']),
    );
    expect(capturedHeaders['content-type']).toEqual(
      expect.arrayContaining(['application/json']),
    );
    expect(response).toEqual({ tags: ['rust', 'systems'] });
  });

  it('should omit X-User-Id header when userId is undefined', async () => {
    let capturedHeaders: Record<string, string | string[]> = {};

    nock(url)
      .post('/api/extract-tags')
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [200, { tags: [] }];
      });

    const client = new RecswipeClient(url);
    await client.extractTags(undefined, { prompt: 'go' });

    expect(capturedHeaders['x-user-id']).toBeUndefined();
  });

  it('should throw when RECSWIPE_ORIGIN is missing', () => {
    const client = new RecswipeClient(undefined);
    expect(() => client.extractTags('user-1', { prompt: 'rust' })).toThrow(
      'Missing RECSWIPE_ORIGIN',
    );
  });

  it('should propagate HttpError on 4xx responses', async () => {
    nock(url).post('/api/extract-tags').reply(400, 'bad request');

    const client = new RecswipeClient(url);
    await expect(
      client.extractTags('user-1', { prompt: 'rust' }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});

describe('RecswipeClient.recommendTags', () => {
  it('should POST snake_case body with default n to /api/recommend-tags and return ranked tags', async () => {
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string | string[]> = {};

    nock(url)
      .post('/api/recommend-tags', (body) => {
        capturedBody = body;
        return true;
      })
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [
          200,
          {
            recommended_tags: [
              { tag: 'rust', score: 0.9 },
              { tag: 'systems', score: 0.7 },
            ],
          },
        ];
      });

    const client = new RecswipeClient(url);
    const response = await client.recommendTags('user-1', {
      selectedTags: ['rust'],
    });

    expect(capturedBody).toEqual({
      selected_tags: ['rust'],
      n: 20,
    });
    expect(capturedHeaders['x-user-id']).toEqual(
      expect.arrayContaining(['user-1']),
    );
    expect(capturedHeaders['content-type']).toEqual(
      expect.arrayContaining(['application/json']),
    );
    expect(response).toEqual({
      recommended_tags: [
        { tag: 'rust', score: 0.9 },
        { tag: 'systems', score: 0.7 },
      ],
    });
  });

  it('should forward an explicit n value', async () => {
    let capturedBody: unknown;

    nock(url)
      .post('/api/recommend-tags', (body) => {
        capturedBody = body;
        return true;
      })
      .reply(200, { recommended_tags: [] });

    const client = new RecswipeClient(url);
    await client.recommendTags('user-1', {
      selectedTags: ['rust', 'systems'],
      n: 5,
    });

    expect(capturedBody).toEqual({
      selected_tags: ['rust', 'systems'],
      n: 5,
    });
  });

  it('should omit X-User-Id header when userId is undefined', async () => {
    let capturedHeaders: Record<string, string | string[]> = {};

    nock(url)
      .post('/api/recommend-tags')
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [200, { recommended_tags: [] }];
      });

    const client = new RecswipeClient(url);
    await client.recommendTags(undefined, { selectedTags: ['rust'] });

    expect(capturedHeaders['x-user-id']).toBeUndefined();
  });

  it('should throw when RECSWIPE_ORIGIN is missing', () => {
    const client = new RecswipeClient(undefined);
    expect(() =>
      client.recommendTags('user-1', { selectedTags: ['rust'] }),
    ).toThrow('Missing RECSWIPE_ORIGIN');
  });

  it('should propagate HttpError on 4xx responses', async () => {
    nock(url).post('/api/recommend-tags').reply(400, 'bad request');

    const client = new RecswipeClient(url);
    await expect(
      client.recommendTags('user-1', { selectedTags: ['rust'] }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
