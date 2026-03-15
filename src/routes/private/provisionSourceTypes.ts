import { ProvisionedIngestion } from '@dailydotdev/schema';

export const defaultSelectorEvaluator =
  '(selector) => Array.from(document.querySelectorAll(selector)).map((el) => el.href)';
export const placeholderLogoPath = '/logos/placeholder.jpg';
export const defaultAudienceFitThreshold = 0.4;

export type ScrapeSourceWebsite = {
  type: 'website';
  website?: string;
  rss: { title?: string; url: string }[];
  logo?: string;
  name?: string;
};

export type ScrapeSourceRss = {
  type: 'rss';
  rss: string;
  website: string;
};

export type ScrapeSourceUnavailable = {
  type: 'unavailable';
};

export type ScrapeSourceResponse =
  | ScrapeSourceWebsite
  | ScrapeSourceRss
  | ScrapeSourceUnavailable;

export type SourceAddedMessage = {
  url: string;
  source_id: string;
  engine_id: string;
  status?: string;
  options?: Record<string, unknown>;
};

export type ProvisionPlan = {
  ingestion: ProvisionedIngestion;
  publishMessage: SourceAddedMessage;
  scrapeUrl?: string;
};

export type ProvisionSourceData = {
  name: string;
  image?: string;
  twitter?: string;
  website?: string;
};

export type PartialProvisionSourceData = Partial<ProvisionSourceData>;
