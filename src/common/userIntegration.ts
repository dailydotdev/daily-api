import { LogLevel, MessageAttachment, WebClient } from '@slack/web-api';
import { DataSource } from 'typeorm';
import { Post, PostType } from '../entity/posts/Post';
import { ArticlePost } from '../entity/posts/ArticlePost';
import { FreeformPost } from '../entity/posts/FreeformPost';
import { SharePost } from '../entity/posts/SharePost';
import { WelcomePost } from '../entity/posts/WelcomePost';
import { CollectionPost } from '../entity/posts/CollectionPost';
import { YouTubePost } from '../entity/posts/YouTubePost';

import {
  UserIntegration,
  UserIntegrationSlack,
  UserIntegrationType,
} from '../entity/UserIntegration';
import { decrypt } from './crypto';
import { isProd } from './utils';

export type GQLUserIntegration = {
  id: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
};

export const getIntegrationToken = async <
  TIntegration extends UserIntegration,
>({
  integration,
}: {
  integration: TIntegration;
}): Promise<string> => {
  switch (integration.type) {
    case UserIntegrationType.Slack: {
      const slackIntegration = integration as UserIntegrationSlack;

      return decrypt(
        slackIntegration.meta.accessToken,
        process.env.SLACK_DB_KEY,
      );
    }
    default:
      throw new Error('unsupported integration type');
  }
};

export const getSlackClient = async ({
  integration,
}: {
  integration: UserIntegration;
}): Promise<WebClient> => {
  return new WebClient(await getIntegrationToken({ integration }), {
    logLevel: isProd ? LogLevel.ERROR : LogLevel.WARN,
  });
};

export const contentTypeFromPostType: Record<PostType, typeof Post> = {
  [PostType.Article]: ArticlePost,
  [PostType.Freeform]: FreeformPost,
  [PostType.Share]: SharePost,
  [PostType.Welcome]: WelcomePost,
  [PostType.Collection]: CollectionPost,
  [PostType.VideoYouTube]: YouTubePost,
};

export const getAttachmentForPostType = async <TPostType extends PostType>({
  con,
  post,
  postType,
}: {
  con: DataSource;
  post: Post;
  postType: TPostType;
}): Promise<MessageAttachment> => {
  const attachment: MessageAttachment = {
    author_name: 'daily.dev',
    author_icon: 'https://app.daily.dev/apple-touch-icon.png',
  };
  const postLink = `${process.env.COMMENTS_PREFIX}/posts/${post.id}`;

  switch (postType) {
    case PostType.Article:
    case PostType.Collection:
    case PostType.VideoYouTube: {
      const articlePost = post as ArticlePost & CollectionPost & YouTubePost;

      if (articlePost.title) {
        attachment.title = articlePost.title;
        attachment.title_link = postLink;
      }

      if (articlePost.summary) {
        attachment.text = articlePost.summary;
      }

      if (articlePost.image) {
        attachment.image_url = articlePost.image;
      }

      break;
    }
    case PostType.Freeform:
    case PostType.Welcome: {
      const freeformPost = post as FreeformPost & WelcomePost;

      attachment.title = freeformPost.title;
      attachment.title_link = postLink;

      if (freeformPost.image) {
        attachment.image_url = freeformPost.image;
      }

      break;
    }
    case PostType.Share: {
      const sharePost = post as SharePost;
      let title = sharePost.title;

      const sharedPost = (await con.getRepository(Post).findOneBy({
        id: sharePost.sharedPostId,
      })) as ArticlePost;

      if (!title) {
        title = sharedPost?.title;
      }

      if (sharedPost?.image) {
        attachment.image_url = sharedPost.image;
      }

      if (title) {
        attachment.title = title;
        attachment.title_link = postLink;
      }

      break;
    }
    default:
      throw new Error(`unsupported post type ${postType}`);
  }

  return attachment;
};
