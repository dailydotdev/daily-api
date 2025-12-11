import { format } from 'date-fns';
import { markdown } from '../../common/markdown';
import { BriefPost } from '../../entity/posts/BriefPost';
import type { TypedWorker } from '../worker';
import { triggerTypedEvent } from '../../common/typedPubsub';
import {
  Briefing,
  BriefingSection,
  type BriefingItem,
} from '@dailydotdev/schema';
import { updateFlagsStatement } from '../../common';
import { insertOrIgnoreAction } from '../../schema/actions';
import {
  briefFeedClient,
  briefingPostIdsMaxItems,
  getUserConfigForBriefingRequest,
} from '../../common/brief';
import { queryReadReplica } from '../../common/queryReadReplica';
import { BRIEFING_SOURCE } from '../../entity/Source';
import { getPostVisible, parseReadTime } from '../../entity/posts/utils';
import { UserActionType } from '../../entity/user/UserAction';
import { Not } from 'typeorm';

const generateItemLinkMarkdown = ({ item }: { item: BriefingItem }): string => {
  if (!item.postIds?.length) {
    return '';
  }

  const readMoreUrl = new URL(process.env.COMMENTS_PREFIX);

  if (item.postIds.length === 1) {
    readMoreUrl.pathname = `/posts/${item.postIds[0]}`;
  } else {
    readMoreUrl.pathname = '/feed-by-ids';

    item.postIds.slice(0, briefingPostIdsMaxItems).forEach((postId) => {
      readMoreUrl.searchParams.append('id', postId);
    });
  }

  return ` [Read more](${readMoreUrl.toString()})`;
};

const generateMarkdown = (data: Briefing): string => {
  let markdown = '';

  for (const section of data.sections) {
    if (section.items.length) {
      markdown += `## ${section.title}\n\n`;

      for (const item of section.items) {
        markdown += `- **${item.title}**: ${item.body}${generateItemLinkMarkdown({ item })}\n`;
      }

      markdown += '\n';
    }
  }

  return markdown.trim();
};

export const userGenerateBriefWorker: TypedWorker<'api.v1.brief-generate'> = {
  subscription: 'api.user-generate-brief',
  handler: async ({ data }, con, logger): Promise<void> => {
    try {
      logger.info(
        {
          request: data,
        },
        'start generating user brief',
      );

      const { postId, payload: briefRequest } = data;

      const pendingPost = await con.getRepository(BriefPost).findOne({
        where: {
          id: postId,
        },
      });

      if (!pendingPost) {
        logger.error({ data }, 'brief post not found, skipping generation');

        return;
      }

      const userConfig = await queryReadReplica(
        con,
        async ({ queryRunner }) => {
          return getUserConfigForBriefingRequest({
            con: queryRunner.manager,
            userId: data.payload.userId,
          });
        },
      );

      briefRequest.allowedTags = userConfig.allowedTags;
      briefRequest.seniorityLevel = userConfig.seniorityLevel;

      const lastBriefPost = await queryReadReplica<Pick<
        BriefPost,
        'collectionSources' | 'flags' | 'contentJSON' | 'readTime'
      > | null>(con, async ({ queryRunner }) => {
        return queryRunner.manager.getRepository(BriefPost).findOne({
          select: ['collectionSources', 'flags', 'contentJSON', 'readTime'],
          where: {
            id: Not(postId),
            authorId: data.payload.userId,
            sourceId: BRIEFING_SOURCE,
            visible: true,
          },
          order: {
            createdAt: 'DESC',
          },
        });
      });

      if (lastBriefPost) {
        try {
          briefRequest.recentBriefing = new Briefing({
            sections: Array.isArray(lastBriefPost.contentJSON)
              ? lastBriefPost.contentJSON.map((item) =>
                  BriefingSection.fromJson(item),
                )
              : [],
            briefStatistics: {
              posts: lastBriefPost.flags.posts ?? 0,
              sources: lastBriefPost.flags.sources ?? 0,
              savedTime: lastBriefPost.flags.savedTime
                ? lastBriefPost.flags.savedTime * 60
                : 0,
            },
            sourceIds: lastBriefPost.collectionSources ?? [],
            readingTime: lastBriefPost.readTime
              ? lastBriefPost.readTime * 60
              : 0,
          });
        } catch (error) {
          logger.error(
            { err: error, data, lastBriefPost },
            'failed to parse last brief post content',
          );

          briefRequest.recentBriefing = undefined;
        }
      }

      const brief = await briefFeedClient.getUserBrief(briefRequest);

      const content = generateMarkdown(brief);
      const title = format(new Date(), 'MMM d, yyyy');

      const post = con.getRepository(BriefPost).create({
        id: postId,
        title,
        titleHtml: title,
        content,
        contentHtml: markdown.render(content),
        visible: true,
        readTime: brief.readingTime
          ? parseReadTime(brief.readingTime / 60)
          : undefined,
        flags: {
          generatedAt: new Date(),
        },
        collectionSources: brief.sourceIds || [],
        contentJSON: brief.sections.map((section) => section.toJson()),
        private: false,
      });
      post.visible = getPostVisible({ post });

      if (brief.briefStatistics?.posts) {
        post.flags.posts = brief.briefStatistics.posts;
      }

      if (brief.briefStatistics?.sources) {
        post.flags.sources = brief.briefStatistics.sources;
      }

      if (brief.briefStatistics?.savedTime) {
        post.flags.savedTime = brief.briefStatistics.savedTime
          ? parseReadTime(brief.briefStatistics.savedTime / 60)
          : undefined;
      }

      await con.getRepository(BriefPost).update(
        { id: post.id },
        {
          ...post,
          flags: updateFlagsStatement<BriefPost>(post.flags),
        },
      );

      await triggerTypedEvent(logger, 'api.v1.brief-ready', data);

      await insertOrIgnoreAction(
        con,
        data.payload.userId,
        UserActionType.GeneratedBrief,
      );
    } catch (originalError) {
      // TODO feat-brief for now catch error and stop, in the future retry and add dead letter after X attempts
      const err = originalError as Error;

      logger.error({ err, data }, 'failed to generate user brief');
    }
  },
};
