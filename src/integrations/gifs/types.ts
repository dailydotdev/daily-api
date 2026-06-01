import { IGarmrClient } from '../garmr';
import type { Gif } from '../../entity/UserIntegration';

export type KlipyMediaFormat = {
  url?: string;
};

export type KlipyGif = {
  id: string;
  title: string;
  media_formats: Record<string, KlipyMediaFormat>;
  content_description: string;
  url: string;
};

export type KlipySearchResponse = {
  results: KlipyGif[];
  next?: string;
};

export type KlipySearchParams = {
  q: string;
  limit?: number;
  pos?: string;
};

export type KlipySearchResult = {
  gifs: Gif[];
  next?: string;
};

export interface IKlipyClient extends IGarmrClient {
  search(params: KlipySearchParams): Promise<KlipySearchResult>;
}
