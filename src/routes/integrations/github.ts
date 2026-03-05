import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getBragiClient } from '../../integrations/bragi/clients';
import { logger } from '../../logger';
import {
  followTags,
  getTagVocabulary,
  toExtractedTagsWithStats,
} from './profileTags';

const githubProfileTagsBodySchema = z.object({
  githubPersonalToken: z.string().trim().min(1).max(4096),
  minConfidence: z.number().min(0).max(1).optional(),
});

type GitHubProfileTagsBody = z.infer<typeof githubProfileTagsBodySchema>;

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: GitHubProfileTagsBody;
  }>('/profile-tags', async (req, res) => {
    if (!req.userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const routeLogger = logger.child({
      route: 'integrations.github.profile-tags',
      userId: req.userId,
    });
    const startedAt = Date.now();
    routeLogger.info('******** Received GitHub profile tags request ********');

    const body = githubProfileTagsBodySchema.safeParse(req.body);
    if (body.error) {
      routeLogger.info(
        {
          issuesCount: body.error.issues.length,
        },
        '******** GitHub profile tags request validation failed ********',
      );
      return res.status(400).send({
        error: {
          name: body.error.name,
          issues: body.error.issues,
        },
      });
    }

    const vocabulary = await getTagVocabulary();
    routeLogger.info(
      {
        vocabularyCount: vocabulary.size,
      },
      '******** Loaded onboarding tag vocabulary ********',
    );
    if (vocabulary.size === 0) {
      routeLogger.info(
        '******** Skipping GitHub profile tags extraction due to empty vocabulary ********',
      );
      return res.send({
        tags: [],
        extractedTags: [],
      });
    }

    const { githubPersonalToken, minConfidence = 0 } = body.data;

    try {
      const bragi = getBragiClient();
      const bragiStartedAt = Date.now();
      routeLogger.info(
        {
          minConfidence,
          githubTokenLength: githubPersonalToken.length,
        },
        '******** Calling Bragi GitHub profile tags pipeline ********',
      );
      const response = await bragi.garmr.execute(() =>
        bragi.instance.gitHubProfileTags({
          githubPersonalToken,
          tagVocabulary: [...vocabulary.values()],
        }),
      );

      routeLogger.info(
        {
          durationMs: Date.now() - bragiStartedAt,
          rawExtractedTagsCount: response.extractedTags.length,
        },
        '******** Received Bragi GitHub profile tags response ********',
      );

      const { extractedTags, stats } = toExtractedTagsWithStats({
        extractedTags: response.extractedTags,
        vocabulary,
        minConfidence,
      });
      const tags = extractedTags.map((tag) => tag.name);
      routeLogger.info(
        {
          stats,
          selectedTagsCount: tags.length,
          selectedTagsPreview: tags.slice(0, 10),
        },
        '******** Filtered GitHub profile tags ********',
      );

      const followStartedAt = Date.now();
      await followTags({
        userId: req.userId,
        tags,
      });
      routeLogger.info(
        {
          tagsCount: tags.length,
          followDurationMs: Date.now() - followStartedAt,
          totalDurationMs: Date.now() - startedAt,
        },
        '******** Completed GitHub profile tag subscription ********',
      );

      return res.send({
        tags,
        extractedTags,
      });
    } catch (err) {
      logger.error(
        {
          err,
          userId: req.userId,
        },
        '******** Failed to extract GitHub profile tags ********',
      );

      return res.status(502).send({
        error: 'Failed to extract GitHub profile tags',
      });
    }
  });
}
