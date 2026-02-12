import { GarmrService, IGarmrService, GarmrNoopService } from '../garmr';
import { IGitHubClient, GitHubSearchResponse } from './types';

export class GitHubClient implements IGitHubClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  public readonly garmr: IGarmrService;

  constructor(
    baseUrl: string,
    token?: string,
    options?: {
      garmr?: IGarmrService;
    },
  ) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.garmr = options?.garmr || new GarmrNoopService();
  }

  async searchRepositories(
    query: string,
    limit = 10,
  ): Promise<GitHubSearchResponse> {
    return this.garmr.execute(async () => {
      const url = `${this.baseUrl}/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}&sort=stars&order=desc`;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'daily.dev',
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`,
        );
      }

      return response.json() as Promise<GitHubSearchResponse>;
    });
  }
}

// Configure Garmr service for GitHub
// Rate limiting - GitHub allows 10 req/min unauthenticated, 30 req/min authenticated for search
const garmrGitHubService = new GarmrService({
  service: 'github',
  breakerOpts: {
    halfOpenAfter: 10 * 1000,
    threshold: 0.1,
    duration: 60 * 1000,
    minimumRps: 0,
  },
  retryOpts: {
    maxAttempts: 2,
    backoff: 500,
  },
});

export const gitHubClient = new GitHubClient(
  process.env.GITHUB_API_URL || 'https://api.github.com',
  process.env.GITHUB_API_TOKEN,
  {
    garmr: garmrGitHubService,
  },
);
