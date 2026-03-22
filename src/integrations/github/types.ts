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

export type GitHubUserRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  owner: GitHubRepositoryOwner;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  fork: boolean;
  updated_at: string;
};

export type GQLGitHubUserRepository = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  updatedAt: string;
};

export interface IGitHubClient extends IGarmrClient {
  searchRepositories(
    query: string,
    limit?: number,
  ): Promise<GitHubSearchResponse>;
  listUserRepositories(
    username: string,
    limit?: number,
  ): Promise<GitHubUserRepository[]>;
}
