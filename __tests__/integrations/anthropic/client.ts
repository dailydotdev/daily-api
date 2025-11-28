import nock from 'nock';
import { AnthropicClient } from '../../../src/integrations/anthropic/client';
import {
  GarmrService,
  GarmrNoopService,
} from '../../../src/integrations/garmr';
import type { AnthropicResponse } from '../../../src/integrations/anthropic/types';

describe('AnthropicClient', () => {
  const API_KEY = 'test-api-key';
  let client: AnthropicClient;

  beforeEach(() => {
    nock.cleanAll();
    client = new AnthropicClient(API_KEY);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('should use GarmrNoopService by default', () => {
      const defaultClient = new AnthropicClient(API_KEY);
      expect(defaultClient.garmr).toBeInstanceOf(GarmrNoopService);
    });

    it('should use provided Garmr service', () => {
      const customGarmr = new GarmrService({
        service: 'test',
        breakerOpts: {
          halfOpenAfter: 10000,
          threshold: 0.2,
          duration: 30000,
        },
        retryOpts: {
          maxAttempts: 3,
          backoff: 500,
        },
      });

      const customClient = new AnthropicClient(API_KEY, { garmr: customGarmr });
      expect(customClient.garmr).toBe(customGarmr);
    });
  });

  describe('createMessage', () => {
    const mockResponse: AnthropicResponse = {
      content: [
        {
          input: {},
        },
      ],
    };

    it('should send request with correct headers', async () => {
      const scope = nock('https://api.anthropic.com')
        .post('/v1/messages')
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('x-api-key', API_KEY)
        .matchHeader('anthropic-version', '2023-06-01')
        .reply(200, mockResponse);

      await client.createMessage({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(scope.isDone()).toBe(true);
    });

    it('should return parsed response on success', async () => {
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, mockResponse);

      const result = await client.createMessage({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle tool use response', async () => {
      const toolUseResponse: AnthropicResponse = {
        content: [
          {
            input: {
              englishName: 'Google',
              nativeName: 'Google',
              domain: 'google.com',
            },
          },
        ],
      };

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, toolUseResponse);

      const result = await client.createMessage({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Google' }],
        tools: [
          {
            name: 'organization_info',
            description: 'Gets information about the given organization',
            input_schema: {
              type: 'object',
              properties: {
                englishName: { type: 'string' },
                nativeName: { type: 'string' },
                domain: { type: 'string' },
              },
              required: ['englishName', 'nativeName', 'domain'],
            },
          },
        ],
        tool_choice: {
          type: 'tool',
          name: 'organization_info',
        },
      });

      expect(result.content[0].input).toEqual({
        englishName: 'Google',
        nativeName: 'Google',
        domain: 'google.com',
      });
    });

    it('should throw error on API failure', async () => {
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(400, 'Bad Request');

      await expect(
        client.createMessage({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('Anthropic API error: 400 Bad Request - Bad Request');
    });

    it('should throw error on 401 unauthorized', async () => {
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(401, 'Unauthorized');

      await expect(
        client.createMessage({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow('Anthropic API error: 401 Unauthorized - Unauthorized');
    });

    it('should throw error on 429 rate limit', async () => {
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(429, 'Rate limit exceeded');

      await expect(
        client.createMessage({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow(
        'Anthropic API error: 429 Too Many Requests - Rate limit exceeded',
      );
    });

    it('should throw error on 500 server error', async () => {
      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(500, 'Internal Server Error');

      await expect(
        client.createMessage({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow(
        'Anthropic API error: 500 Internal Server Error - Internal Server Error',
      );
    });

    it('should include error details in error message', async () => {
      const errorResponse = JSON.stringify({
        error: {
          type: 'invalid_request_error',
          message: 'max_tokens must be greater than 0',
        },
      });

      nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(400, errorResponse);

      await expect(
        client.createMessage({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 0,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      ).rejects.toThrow(errorResponse);
    });
  });
});
