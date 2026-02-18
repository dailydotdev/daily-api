import { LogLevel, MessageAttachment, WebClient } from '@slack/web-api';
import { DataSource } from 'typeorm';

import {
  UserIntegration,
  UserIntegrationSlack,
  UserIntegrationType,
} from '../entity/UserIntegration';
import { decrypt } from './crypto';
import { isProd } from './utils';
import {
  PostType,
  Post,
  ArticlePost,
  CollectionPost,
  YouTubePost,
  FreeformPost,
  WelcomePost,
  SharePost,
} from '../entity/posts';

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

export const getAttachmentForPostType = async <TPostType extends PostType>({
  con,
  post,
  postType,
  postLink,
}: {
  con: DataSource;
  post: Post;
  postType: TPostType;
  postLink: string;
}): Promise<MessageAttachment> => {
  const source = await post.source;
  const attachment: MessageAttachment = {
    author_name: `${source.name} | daily.dev`,
    author_icon: source.image,
  };

  switch (postType) {
    case PostType.Poll: {
      const pollPost = post as Post & { options: string[] };

      if (pollPost.title) {
        attachment.title = pollPost.title;
        attachment.title_link = postLink;
      }
      break;
    }
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
    case PostType.SocialTwitter: {
      const socialPost = post as Post & { content?: string; image?: string };

      if (socialPost.title) {
        attachment.title = socialPost.title;
        attachment.title_link = postLink;
      }

      if (socialPost.content) {
        attachment.text = socialPost.content;
      }

      if (socialPost.image) {
        attachment.image_url = socialPost.image;
      }

      break;
    }
    case PostType.Freeform:
    case PostType.Welcome:
    case PostType.Brief: {
      const freeformPost = post as FreeformPost & WelcomePost;

      if (freeformPost.title) {
        attachment.title = freeformPost.title;
        attachment.title_link = postLink;
      }

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

export enum SlackChannelType {
  Public = 'public_channel',
  Private = 'private_channel',
}

export enum SlackOAuthScope {
  GroupsRead = 'groups:read',
}
