import { format } from 'date-fns';
import { markdown } from '../../common/markdown';
import { BriefPost } from '../../entity/posts/BriefPost';
import { FeedClient } from '../../integrations/feed';
import { GarmrService } from '../../integrations/garmr';
import type { TypedWorker } from '../worker';
import { getPostVisible, parseReadTime } from '../../entity';
import { triggerTypedEvent } from '../../common/typedPubsub';
import type { Briefing } from '@dailydotdev/schema';
import { updateFlagsStatement } from '../../common';

const feedClient = new FeedClient(process.env.BRIEFING_FEED, {
  garmr: new GarmrService({
    service: 'feed-client-generate-brief',
    breakerOpts: {
      halfOpenAfter: 5 * 1000,
      threshold: 0.1,
      duration: 10 * 1000,
      minimumRps: 1,
    },
    limits: {
      maxRequests: 150,
      queuedRequests: 100,
    },
    retryOpts: {
      maxAttempts: 0,
    },
  }),
});

const generateMarkdown = (data: Briefing): string => {
  let markdown = '';

  for (const section of data.sections) {
    markdown += `## ${section.title}\n\n`;

    for (const item of section.items) {
      markdown += `- **${item.title}**: ${item.body}\n`;
    }

    markdown += '\n';
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

      const brief = await feedClient.getUserBrief(briefRequest);

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
    } catch (originalError) {
      // TODO feat-brief for now catch error and stop, in the future retry and add dead letter after X attempts
      const err = originalError as Error;

      logger.error({ err, data }, 'failed to generate user brief');
    }
  },
};
