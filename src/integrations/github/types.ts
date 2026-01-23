import { IGarmrClient } from '../garmr';

export interface GitHubRepositoryOwner {
  login: string;
  avatar_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  owner: GitHubRepositoryOwner;
}

export interface GitHubSearchResponse {
  total_count: number;
  items: GitHubRepository[];
}

export interface GQLGitHubRepository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  image: string;
  description: string | null;
}

export interface IGitHubClient extends IGarmrClient {
  searchRepositories(
    query: string,
    limit?: number,
  ): Promise<GitHubSearchResponse>;
}
