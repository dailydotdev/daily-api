import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Pipelines } from '@dailydotdev/schema';
import { getBragiClient } from '../../integrations/bragi/clients';
import { logger } from '../../logger';
import {
  followTags,
  getTagVocabulary,
  type RawExtractedTag,
  toExtractedTagsWithStats,
} from './profileTags';

const onboardingProfileTagsBodySchema = z.object({
  onboardingPrompt: z.string().trim().min(1).max(4096),
  minConfidence: z.number().min(0).max(1).optional(),
});

type OnboardingProfileTagsBody = z.infer<
  typeof onboardingProfileTagsBodySchema
>;

type OnboardingProfileTagsClient = {
  onboardingProfileTags: (request: {
    onboardingPrompt: string;
  }) => Promise<{ extractedTags: RawExtractedTag[] }>;
};

const toInputFingerprint = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 16);

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: OnboardingProfileTagsBody;
  }>('/profile-tags', async (req, res) => {
    if (!req.userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const routeLogger = logger.child({
      route: 'integrations.onboarding.profile-tags',
      userId: req.userId,
    });
    const startedAt = Date.now();
    routeLogger.info(
      '******** Received onboarding profile tags request ********',
    );

    const body = onboardingProfileTagsBodySchema.safeParse(req.body);
    if (body.error) {
      routeLogger.info(
        {
          issuesCount: body.error.issues.length,
        },
        '******** Onboarding profile tags request validation failed ********',
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
        '******** Skipping onboarding profile tags extraction due to empty vocabulary ********',
      );
      return res.send({
        tags: [],
        extractedTags: [],
      });
    }

    const { onboardingPrompt, minConfidence = 0 } = body.data;

    try {
      const bragi = getBragiClient();
      const onboardingClient =
        bragi.instance as unknown as OnboardingProfileTagsClient;
      const schemaOnboardingMethods = Object.keys(Pipelines.methods).filter(
        (method) => method.toLowerCase().includes('onboarding'),
      );
      const schemaHasOnboardingProfileTagsMethod =
        'onboardingProfileTags' in Pipelines.methods;
      const hasOnboardingProfileTagsFunction =
        typeof onboardingClient.onboardingProfileTags === 'function';
      routeLogger.info(
        {
          schemaHasOnboardingProfileTagsMethod,
          schemaOnboardingMethods,
          hasOnboardingProfileTagsFunction,
        },
        '******** Resolved Bragi onboarding client method ********',
      );
      if (
        !schemaHasOnboardingProfileTagsMethod ||
        !hasOnboardingProfileTagsFunction
      ) {
        throw new Error(
          `Bragi client onboardingProfileTags is unavailable; schemaHasMethod=${schemaHasOnboardingProfileTagsMethod}; clientHasFunction=${hasOnboardingProfileTagsFunction}; schemaOnboardingMethods=[${schemaOnboardingMethods.join(', ')}]`,
        );
      }
      const inputFingerprint = toInputFingerprint(onboardingPrompt);
      const bragiStartedAt = Date.now();
      routeLogger.info(
        {
          minConfidence,
          promptLength: onboardingPrompt.length,
          inputFingerprint,
        },
        '******** Calling Bragi onboarding profile tags pipeline ********',
      );
      const response = await bragi.garmr.execute(() =>
        onboardingClient.onboardingProfileTags({
          onboardingPrompt,
        }),
      );

      routeLogger.info(
        {
          durationMs: Date.now() - bragiStartedAt,
          rawExtractedTagsCount: response.extractedTags.length,
          inputFingerprint,
        },
        '******** Received Bragi onboarding profile tags response ********',
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
          inputFingerprint,
        },
        '******** Filtered onboarding profile tags ********',
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
          inputFingerprint,
        },
        '******** Completed onboarding profile tag subscription ********',
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
        '******** Failed to extract onboarding profile tags ********',
      );

      return res.status(502).send({
        error: 'Failed to extract onboarding profile tags',
      });
    }
  });
}
