import type { RequestInit } from 'node-fetch';
import { GarmrNoopService, GarmrService, type IGarmrService } from '../garmr';
import { fetchOptions as globalFetchOptions } from '../../http';
import { AbortError, HttpError, retryFetch } from '../retry';
import type { LiveRoomMode } from '../../common/schema/liveRooms';

export class FlytingClient {
  private readonly fetchOptions: RequestInit;
  private readonly garmr: IGarmrService;

  constructor(
    private readonly url: string,
    private readonly internalApiKey: string,
    options?: {
      fetchOptions?: RequestInit;
      garmr?: IGarmrService;
    },
  ) {
    const {
      fetchOptions = globalFetchOptions,
      garmr = new GarmrNoopService(),
    } = options || {};

    this.fetchOptions = fetchOptions;
    this.garmr = garmr;
  }

  async prepareRoom(input: {
    mode: LiveRoomMode;
    roomId: string;
  }): Promise<void> {
    await this.garmr.execute(async () => {
      const response = await retryFetch(
        `${this.url}/internal/live-rooms/${input.roomId}/prepare`,
        {
          ...this.fetchOptions,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-flyting-internal-key': this.internalApiKey,
          },
          body: JSON.stringify({
            mode: input.mode,
          }),
        },
      );

      if (response.ok) {
        return;
      }

      throw new HttpError(response.url, response.status, await response.text());
    });
  }

  async endRoom(input: { roomId: string }): Promise<{ found: boolean }> {
    return this.garmr.execute(async () => {
      try {
        await retryFetch(
          `${this.url}/internal/live-rooms/${input.roomId}/end`,
          {
            ...this.fetchOptions,
            method: 'POST',
            headers: {
              'x-flyting-internal-key': this.internalApiKey,
            },
          },
        );

        return { found: true };
      } catch (error) {
        if (
          error instanceof AbortError &&
          error.originalError instanceof HttpError &&
          error.originalError.statusCode === 404
        ) {
          return { found: false };
        }

        throw error;
      }
    });
  }

  async getJoinEligibility(input: {
    participantId: string;
    roomId: string;
  }): Promise<{
    canJoin: boolean;
    participantId: string;
    reason?: 'kicked';
    roomId: string;
  }> {
    return this.garmr.execute(async () => {
      const response = await retryFetch(
        `${this.url}/internal/live-rooms/${encodeURIComponent(
          input.roomId,
        )}/participants/${encodeURIComponent(input.participantId)}/join-eligibility`,
        {
          ...this.fetchOptions,
          method: 'GET',
          headers: {
            'x-flyting-internal-key': this.internalApiKey,
          },
        },
      );

      if (response.ok) {
        return response.json();
      }

      throw new HttpError(response.url, response.status, await response.text());
    });
  }
}

const garmrFlytingService = new GarmrService({
  service: FlytingClient.name,
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
  },
});

export const getFlytingClient = (): FlytingClient =>
  new FlytingClient(
    process.env.FLYTING_ORIGIN || '',
    process.env.FLYTING_INTERNAL_KEY || '',
    {
      garmr: garmrFlytingService,
    },
  );
