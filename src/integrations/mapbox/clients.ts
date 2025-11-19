import fetch from 'node-fetch';
import { GarmrService, IGarmrService, GarmrNoopService } from '../garmr';
import { IMapboxClient, MapboxResponse } from './types';
import { isProd } from '../../common';

export class MapboxClient implements IMapboxClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  public readonly garmr: IGarmrService;

  constructor(
    baseUrl: string,
    accessToken: string,
    options?: {
      garmr?: IGarmrService;
    },
  ) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.garmr = options?.garmr || new GarmrNoopService();
  }

  async geocode(query: string): Promise<MapboxResponse> {
    return this.garmr.execute(async () => {
      // We need to set the "permanent" param to "true" to be allowed to store Mapbox results.
      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}&access_token=${this.accessToken}&permanent=${isProd}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<MapboxResponse>;
    });
  }

  async autocomplete(query: string): Promise<MapboxResponse> {
    return this.garmr.execute(async () => {
      const url = `${this.baseUrl}?q=${encodeURIComponent(query)}&types=country,place&limit=5&access_token=${this.accessToken}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<MapboxResponse>;
    });
  }
}

// Configure Garmr service for Mapbox
// Rate limiting - let Mapbox's 1000 req/min limit handle it
const garmrMapboxService = new GarmrService({
  service: 'mapbox',
  breakerOpts: {
    halfOpenAfter: 5 * 1000,
    threshold: 0.1,
    duration: 10 * 1000,
    minimumRps: 0,
  },
  retryOpts: {
    maxAttempts: 3,
    backoff: 1000,
  },
});

export const mapboxClient = new MapboxClient(
  process.env.MAPBOX_GEOCODING_URL!,
  process.env.MAPBOX_ACCESS_TOKEN!,
  {
    garmr: garmrMapboxService,
  },
);
