import { GarmrService, IGarmrService } from '../integrations/garmr';
import {
  isMockEnabled,
  mockScraperPdfBuffer,
} from '../mocks/opportunity/services';

const realGarmScraperService = new GarmrService({
  service: 'daily-scraper',
  breakerOpts: {
    halfOpenAfter: 10 * 1000,
    threshold: 0.2,
    duration: 20 * 1000,
    minimumRps: 1,
  },
  retryOpts: {
    maxAttempts: 3,
  },
});

/**
 * Mock scraper service that returns a mock PDF buffer
 */
class MockScraperService implements IGarmrService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute<T>(_fn: () => Promise<T>): Promise<T> {
    // Return a mock Response object with the PDF buffer
    const buffer = mockScraperPdfBuffer();
    const response = new Response(buffer, {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
    return response as unknown as T;
  }
}

export const garmScraperService: IGarmrService = isMockEnabled()
  ? new MockScraperService()
  : realGarmScraperService;
