import { IGarmrClient } from '../garmr';
import type { Gif } from '../../entity/UserIntegration';

export type TenorMediaFormat = {
  url?: string;
};

export type TenorGif = {
  id: string;
  title: string;
  media_formats: Record<string, TenorMediaFormat>;
  content_description: string;
  url: string;
};

export type TenorSearchResponse = {
  results: TenorGif[];
  next?: string;
};

export type TenorSearchParams = {
  q: string;
  limit?: number;
  pos?: string;
};

export type TenorSearchResult = {
  gifs: Gif[];
  next?: string;
};

export interface ITenorClient extends IGarmrClient {
  search(params: TenorSearchParams): Promise<TenorSearchResult>;
}
