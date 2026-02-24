import { RequestInit } from 'node-fetch';
import { fetchOptions as globalFetchOptions } from '../../http';
import { GarmrNoopService, GarmrService, IGarmrService } from '../garmr';
import { retryFetchParse } from '../retry';
import type {
  HighlightsParams,
  HighlightsResponse,
  TimeSeriesParams,
  TimeSeriesResponse,
} from './types';

export class YggdrasilSentimentClient {
  private readonly fetchOptions: RequestInit;
  private readonly garmr: IGarmrService;

  constructor(
    private readonly url: string,
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

  getTimeSeries(params: TimeSeriesParams): Promise<TimeSeriesResponse> {
    const searchParams = new URLSearchParams({
      resolution: params.resolution,
    });
    if (params.entity) {
      searchParams.set('entity', params.entity);
    }
    if (params.groupId) {
      searchParams.set('group_id', params.groupId);
    }
    if (params.lookback) {
      searchParams.set('lookback', params.lookback);
    }

    return this.garmr.execute(() =>
      retryFetchParse<TimeSeriesResponse>(
        `${this.url}/api/sentiment/timeseries?${searchParams.toString()}`,
        {
          ...this.fetchOptions,
          method: 'GET',
        },
      ),
    );
  }

  getHighlights(params: HighlightsParams): Promise<HighlightsResponse> {
    const searchParams = new URLSearchParams();
    if (params.entity) {
      searchParams.set('entity', params.entity);
    }
    if (params.groupId) {
      searchParams.set('group_id', params.groupId);
    }
    if (params.limit) {
      searchParams.set('limit', String(params.limit));
    }
    if (params.after) {
      searchParams.set('after', params.after);
    }
    if (params.orderBy) {
      searchParams.set('order_by', params.orderBy);
    }

    return this.garmr.execute(() =>
      retryFetchParse<HighlightsResponse>(
        `${this.url}/api/sentiment/highlights?${searchParams.toString()}`,
        {
          ...this.fetchOptions,
          method: 'GET',
        },
      ),
    );
  }
}

const yggdrasilSentimentOrigin = process.env.YGGDRASIL_SENTIMENT_ORIGIN;
if (!yggdrasilSentimentOrigin) {
  throw new Error('Missing YGGDRASIL_SENTIMENT_ORIGIN');
}

export const yggdrasilSentimentClient = new YggdrasilSentimentClient(
  yggdrasilSentimentOrigin,
  {
    garmr: new GarmrService({
      service: 'YggdrasilSentiment',
      breakerOpts: {
        halfOpenAfter: 5_000,
        threshold: 0.1,
        duration: 10_000,
      },
    }),
  },
);
