import { format } from 'date-fns';
import { markdown } from '../../common/markdown';
import { BriefPost } from '../../entity/posts/BriefPost';
import { generateShortId } from '../../ids';
import { FeedClient, type Briefing } from '../../integrations/feed';
import { GarmrService } from '../../integrations/garmr';
import type { TypedWorker } from '../worker';

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
      markdown += `### ${item.title}\n\n`;
      markdown += `${item.body}\n\n`;
    }
  }

  return markdown;
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

      const brief = await feedClient.getUserBrief(data);

      const postId = await generateShortId();
      const content = generateMarkdown(brief);
      const title = `Presidential briefing ${format(new Date(), 'MMM d')}`;

      const post = con.getRepository(BriefPost).create({
        id: postId,
        title,
        titleHtml: title,
        shortId: postId,
        content,
        contentHtml: markdown.render(content),
        authorId: data.userId,
        private: true,
      });

      await con.getRepository(BriefPost).save(post);
    } catch (originalError) {
      // for now catch error and stop, in the future retry and add dead letter after X attempts
      const err = originalError as Error;

      logger.error({ err, data }, 'failed to generate user brief');
    }
  },
};
