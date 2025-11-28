import fetch from 'node-fetch';
import { GarmrService, IGarmrService, GarmrNoopService } from '../garmr';
import { IAnthropicClient, AnthropicRequest, AnthropicResponse } from './types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicClient implements IAnthropicClient {
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

  async createMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    return this.garmr.execute(async () => {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      return response.json() as Promise<AnthropicResponse>;
    });
  }
}

const garmrAnthropicService = new GarmrService({
  service: 'anthropic',
  breakerOpts: {
    halfOpenAfter: 10 * 1000,
    threshold: 0.2,
    duration: 30 * 1000,
    minimumRps: 0,
  },
  retryOpts: {
    maxAttempts: 3,
    backoff: 500,
  },
});

export const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new AnthropicClient(process.env.ANTHROPIC_API_KEY, {
      garmr: garmrAnthropicService,
    })
  : null;
