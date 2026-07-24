import type { FastifyBaseLogger } from 'fastify';
import { anthropicClient } from '../../../src/integrations/anthropic/client';
import { discoverExternalUrls } from '../../../src/common/interest/discoverExternalUrls';

const logger = {
  child: () => ({ info: jest.fn(), warn: jest.fn() }),
} as unknown as FastifyBaseLogger;

const interest = {
  id: 'i1',
  query: 'cool zig projects',
};

const mockContent = (text: string) =>
  jest
    .spyOn(anthropicClient, 'createMessage')
    .mockResolvedValue({ content: [{ type: 'text', text }] } as never);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('discoverExternalUrls', () => {
  it('parses a JSON array of candidates from the model reply', async () => {
    mockContent(
      '[{"url":"https://a.com","title":"A","rationale":"r","score":0.9}]',
    );
    const result = await discoverExternalUrls({
      interest,
      query: 'zig',
      logger,
    });
    expect(result).toEqual([
      { url: 'https://a.com', title: 'A', rationale: 'r', score: 0.9 },
    ]);
  });

  it('drops non-http entries and de-duplicates urls', async () => {
    mockContent(
      JSON.stringify([
        { url: 'https://a.com', title: 'A', rationale: 'r', score: 0.8 },
        { url: 'https://a.com', title: 'dup', rationale: 'r', score: 0.8 },
        { url: 'ftp://b.com', title: 'B', rationale: 'r', score: 0.8 },
        { url: 42, title: 'C', rationale: 'r', score: 0.8 },
      ]),
    );
    const result = await discoverExternalUrls({
      interest,
      query: 'zig',
      logger,
    });
    expect(result.map((r) => r.url)).toEqual(['https://a.com']);
  });

  it('drops daily.dev urls so the agent cannot ingest our own content', async () => {
    mockContent(
      JSON.stringify([
        {
          url: 'https://daily.dev/posts/x',
          title: 'own',
          rationale: 'r',
          score: 0.9,
        },
        {
          url: 'https://app.daily.dev/posts/y',
          title: 'own2',
          rationale: 'r',
          score: 0.9,
        },
        {
          url: 'https://external.com/a',
          title: 'ext',
          rationale: 'r',
          score: 0.9,
        },
      ]),
    );
    const result = await discoverExternalUrls({
      interest,
      query: 'zig',
      logger,
    });
    expect(result.map((r) => r.url)).toEqual(['https://external.com/a']);
  });

  it('returns an empty array when the reply is not a JSON array', async () => {
    mockContent('I could not find anything relevant.');
    const result = await discoverExternalUrls({
      interest,
      query: 'zig',
      logger,
    });
    expect(result).toEqual([]);
  });

  it('returns an empty array (does not throw) when the client fails', async () => {
    jest
      .spyOn(anthropicClient, 'createMessage')
      .mockRejectedValue(new Error('boom'));
    const result = await discoverExternalUrls({
      interest,
      query: 'zig',
      logger,
    });
    expect(result).toEqual([]);
  });

  it('issues a generic web_search tool with no domain restriction', async () => {
    const spy = mockContent('[]');
    await discoverExternalUrls({ interest, query: 'zig', logger });
    const request = spy.mock.calls[0][0] as {
      tools: Array<{ name?: string; allowed_domains?: string[] }>;
    };
    expect(request.tools[0].name).toBe('web_search');
    expect(request.tools[0].allowed_domains).toBeUndefined();
  });
});
