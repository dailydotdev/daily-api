import type { FastifyBaseLogger } from 'fastify';
import type { EntityManager } from 'typeorm';
import type {
  ArticlePost,
  CollectionPost,
  Post,
  PostContentQuality,
  PostType,
  SocialTwitterPost,
  Toc,
  YouTubePost,
} from '../../entity';
import type { TwitterReferencePost } from '../../common/twitterSocial';
import type { I18nRecord } from '../../types';

export type Data = {
  id: string;
  post_id: string;
  url: string;
  image?: string;
  title?: string;
  content_type?: string;
  reject_reason?: string;
  submission_id?: string;
  source_id?: string;
  origin?: string;
  published_at?: Date;
  updated_at?: Date;
  paid?: boolean;
  order?: number;
  collections?: string[];
  language?: string;
  alt_title?: string;
  extra?: {
    keywords?: string[];
    keywords_native?: string[];
    questions?: string[];
    summary?: string;
    description?: string;
    read_time?: number;
    canonical_url?: string;
    site_twitter?: string;
    creator_twitter?: string;
    toc?: Toc;
    content_curation?: string[];
    origin_entries?: string[];
    content?: string;
    video_id?: string;
    duration?: number;
    author_username?: string;
    author_name?: string;
    author_avatar?: string;
  };
  meta?: {
    scraped_html?: string;
    cleaned_trafilatura_xml?: string;
    translate_title?: {
      translations?: I18nRecord;
    };
    stored_code_snippets?: string;
    channels?: string[];
    social_twitter?: {
      creator?: {
        handle?: string;
        name?: string;
        profile_image?: string;
      };
    };
  };
  content_quality?: PostContentQuality;
};

export type HandleRejectionProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};

export type CreatePostProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  mergedKeywords: string[];
  questions: string[];
  smartTitle?: string;
};

export type CheckExistingPostProps = {
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  logger: FastifyBaseLogger;
  errorMsg: string;
  excludeId?: string;
};

export type UpdatePostProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Partial<ArticlePost>;
  id: string;
  mergedKeywords: string[];
  questions: string[];
  content_type: PostType;
  smartTitle?: string;
};

export type GetSourcePrivacyProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};

export type FixDataProps = {
  logger: FastifyBaseLogger;
  entityManager: EntityManager;
  data: Data;
};

export type FixData = {
  mergedKeywords: string[];
  questions: string[];
  content_type: PostType;
  fixedData: Partial<ArticlePost> &
    Partial<CollectionPost> &
    Partial<YouTubePost> &
    Partial<SocialTwitterPost> &
    Partial<Post>;
  smartTitle?: string;
  twitterReference?: TwitterReferencePost;
};
