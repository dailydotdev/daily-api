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
        { post_id: 'p1', title: 'Hello', summary: 'Summary', tags: ['rust'] },
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
