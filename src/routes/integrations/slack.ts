import { FastifyInstance, FastifyReply } from 'fastify';
import createOrGetConnection from '../../db';
import { logger } from '../../logger';
import {
  IntegrationMetaSlack,
  UserIntegrationSlack,
  UserIntegrationType,
} from '../../entity/UserIntegration';
import { SlackAuthResponse } from '../../types';
import { RedirectError } from '../../errors';
import {
  encrypt,
  SlackEvent,
  SlackEventType,
  verifySlackSignature,
} from '../../common';

import {
  AnalyticsEventName,
  sendAnalyticsEvent,
} from '../../integrations/analytics';
import { OpportunityMatch } from '../../entity/OpportunityMatch';
import { OpportunityMatchStatus } from '../../entity/opportunities/types';
import {
  slackOpportunityActionValueSchema,
  slackOpportunityReviewValueSchema,
  slackInteractionPayloadSchema,
  type SlackInteractionPayload,
  type SlackAction,
} from '../../common/schema/slack';
import { queryReadReplica } from '../../common/queryReadReplica';
import { OpportunityJob } from '../../entity/opportunities/OpportunityJob';
import { OpportunityState } from '@dailydotdev/schema';
import { z } from 'zod';
import { DataSource } from 'typeorm';

// Action handler interface for generic Slack action handling
interface SlackActionHandler<TValue = unknown> {
  valueSchema: z.ZodSchema<TValue>;
  handle: (params: {
    con: DataSource;
    value: TValue;
    payload: SlackInteractionPayload;
    action: SlackAction;
  }) => Promise<string | null>; // Returns response message or null
}

// Registry of action handlers keyed by action_id
const slackActionHandlers: Record<string, SlackActionHandler<unknown>> = {
  opportunity_review_accept: {
    valueSchema: slackOpportunityReviewValueSchema,
    handle: async ({ con, value, payload }) => {
      const { opportunityId } = value as z.infer<
        typeof slackOpportunityReviewValueSchema
      >;
      const opportunity = await con.getRepository(OpportunityJob).findOne({
        where: { id: opportunityId },
        relations: { organization: true },
      });

      if (!opportunity || opportunity.state !== OpportunityState.IN_REVIEW) {
        return opportunity
          ? `Already processed: state is ${opportunity.state}`
          : 'Opportunity not found';
      }

      await con
        .getRepository(OpportunityJob)
        .update({ id: opportunityId }, { state: OpportunityState.LIVE });

      const organization = await opportunity.organization;
      return `:white_check_mark: Accepted "${opportunity.title}" (${organization.name}) by @${payload.user?.username || 'unknown'}`;
    },
  },

  opportunity_review_reject: {
    valueSchema: slackOpportunityReviewValueSchema,
    handle: async ({ con, value, payload }) => {
      const { opportunityId } = value as z.infer<
        typeof slackOpportunityReviewValueSchema
      >;
      const opportunity = await con.getRepository(OpportunityJob).findOne({
        where: { id: opportunityId },
        relations: { organization: true },
      });

      if (!opportunity || opportunity.state !== OpportunityState.IN_REVIEW) {
        return opportunity
          ? `Already processed: state is ${opportunity.state}`
          : 'Opportunity not found';
      }

      await con
        .getRepository(OpportunityJob)
        .update({ id: opportunityId }, { state: OpportunityState.CLOSED });

      const organization = await opportunity.organization;
      return `:x: Rejected "${opportunity.title}" (${organization.name}) by @${payload.user?.username || 'unknown'}`;
    },
  },

  candidate_review_accept: {
    valueSchema: slackOpportunityActionValueSchema,
    handle: async ({ con, value, payload }) => {
      const { opportunityId, userId } = value as z.infer<
        typeof slackOpportunityActionValueSchema
      >;
      const match = await con
        .getRepository(OpportunityMatch)
        .findOne({ where: { opportunityId, userId } });

      if (!match || match.status !== OpportunityMatchStatus.CandidateReview) {
        return match ? `Already processed: ${match.status}` : 'Match not found';
      }

      const opportunity = await queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager.getRepository(OpportunityJob).findOneOrFail({
          where: { id: opportunityId },
          relations: { organization: true },
        });
      });

      await con
        .getRepository(OpportunityMatch)
        .update(
          { opportunityId, userId },
          { status: OpportunityMatchStatus.CandidateAccepted },
        );

      const organization = await opportunity.organization;
      return `:white_check_mark: Accepted (${opportunity.title} - ${organization.name}) by @${payload.user?.username || 'unknown'}`;
    },
  },

  candidate_review_reject: {
    valueSchema: slackOpportunityActionValueSchema,
    handle: async ({ con, value, payload }) => {
      const { opportunityId, userId } = value as z.infer<
        typeof slackOpportunityActionValueSchema
      >;
      const match = await con
        .getRepository(OpportunityMatch)
        .findOne({ where: { opportunityId, userId } });

      if (!match || match.status !== OpportunityMatchStatus.CandidateReview) {
        return match ? `Already processed: ${match.status}` : 'Match not found';
      }

      const opportunity = await queryReadReplica(con, ({ queryRunner }) => {
        return queryRunner.manager.getRepository(OpportunityJob).findOneOrFail({
          where: { id: opportunityId },
          relations: { organization: true },
        });
      });

      await con
        .getRepository(OpportunityMatch)
        .update(
          { opportunityId, userId },
          { status: OpportunityMatchStatus.RecruiterRejected },
        );

      const organization = await opportunity.organization;
      return `:x: Rejected (${opportunity.title} - ${organization.name}) by @${payload.user?.username || 'unknown'}`;
    },
  },
};

const redirectResponse = ({
  res,
  url,
  error,
}: {
  res: FastifyReply;
  url: URL;
  error?: RedirectError;
}): FastifyReply => {
  if (error) {
    url.searchParams.append('error', error.message);
  }

  return res.redirect(url.toString(), 307);
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Querystring: {
      code: string;
      state: string;
      error: string;
      error_description: string;
    };
    Cookies: { redirectPath?: string };
  }>('/auth/callback', async (req, res) => {
    const redirectPathCookie = req.cookies.slackRedirectPath;
    const redirectPath = redirectPathCookie?.startsWith('/')
      ? redirectPathCookie
      : '/';
    const redirectUrl = new URL(
      `${process.env.COMMENTS_PREFIX}${redirectPath}`,
    );

    try {
      if (!req.userId) {
        const message = 'unauthorized';
        const error = new RedirectError(message);

        logger.error(
          {
            err: error,
          },
          message,
        );

        throw error;
      }

      if (req.query.state !== req.userId) {
        const message = 'invalid state';
        const error = new RedirectError(message);

        logger.error(
          {
            err: error,
          },
          message,
        );

        throw error;
      }

      if (req.query.error) {
        const message = req.query.error_description || req.query.error;
        const error = new RedirectError(req.query.error);

        logger.error(
          {
            err: error,
          },
          message,
        );

        throw error;
      }

      if (!req.query.code) {
        throw new RedirectError('missing code');
      }

      const con = await createOrGetConnection();
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          redirect_uri: `${process.env.URL_PREFIX}/integrations/slack/auth/callback`,
        }),
      });

      if (!response.ok) {
        const message = 'failed to get slack token';
        logger.error(
          { err: new Error('HTTP error'), statusCode: response.status },
          message,
        );

        throw new RedirectError(message);
      }

      const result: SlackAuthResponse = await response.json();

      if (!result.ok) {
        const message = 'slack auth failed';
        const error = new RedirectError(result.error || 'unknown error');

        logger.error(
          {
            err: error,
          },
          message,
        );

        throw error;
      }

      const existingIntegration = await con
        .getRepository(UserIntegrationSlack)
        .createQueryBuilder()
        .where('"userId" = :userId', { userId: req.userId })
        .andWhere(`meta->>'teamId' = :teamId`, { teamId: result.team.id })
        .getOne();

      const integrationMeta: IntegrationMetaSlack = {
        appId: result.app_id,
        slackUserId: result.authed_user.id,
        scope: result.scope,
        tokenType: result.token_type,
        accessToken: await encrypt(
          result.access_token,
          process.env.SLACK_DB_KEY,
        ),
        teamId: result.team.id,
        teamName: result.team.name,
      };

      let integrationId;
      if (existingIntegration) {
        integrationId = existingIntegration.id;
        await con
          .getRepository(UserIntegrationSlack)
          .update({ id: existingIntegration.id }, { meta: integrationMeta });
      } else {
        const newIntegration = await con
          .getRepository(UserIntegrationSlack)
          .insert({
            userId: req.userId,
            meta: integrationMeta,
          });
        integrationId = newIntegration.identifiers[0].id;
      }

      try {
        await sendAnalyticsEvent([
          {
            event_timestamp: new Date(),
            event_name: AnalyticsEventName.ConfirmAddingWorkspace,
            app_platform: 'api',
            user_id: req.userId,
            target_id: UserIntegrationType.Slack,
          },
        ]);
      } catch (analyticsEventError) {
        logger.error(
          {
            err: analyticsEventError,
          },
          'error sending slack workspace analytics event',
        );
      }

      redirectUrl.searchParams.append('iid', integrationId);

      return redirectResponse({
        res,
        url: redirectUrl,
      });
    } catch (error) {
      const isRedirectError = error instanceof RedirectError;

      if (!isRedirectError) {
        logger.error({ err: error }, 'error processing slack auth callback');
      }

      redirectResponse({
        res,
        url: redirectUrl,
        error: isRedirectError ? error : new RedirectError('internal error'),
      });
    }
  });

  fastify.post<{
    Body: {
      token: string;
      challenge: string;
      type: string;
      team_id: string;
      event: {
        type: SlackEvent;
      };
    };
    Headers: {
      'x-slack-request-timestamp': string;
      'x-slack-signature': string;
    };
  }>('/events', {
    config: {
      rawBody: true,
    },
    handler: async (req, res) => {
      try {
        if (req.body.type === SlackEventType.UrlVerification) {
          const isValid = verifySlackSignature({ req });

          return res.status(isValid ? 200 : 403).send({
            challenge: isValid ? req.body.challenge : 'invalid signature',
          });
        }

        const eventType = req.body.type;
        const event = req.body.event?.type || 'unknown';

        switch (event) {
          case SlackEvent.AppUninstalled:
          case SlackEvent.TokensRevoked: {
            const teamId = req.body.team_id;

            if (!teamId) {
              logger.error(
                {
                  event,
                  eventType,
                },
                'missing team id for slack event',
              );

              break;
            }

            const con = await createOrGetConnection();

            await con
              .getRepository(UserIntegrationSlack)
              .createQueryBuilder()
              .delete()
              .where(`meta->>'teamId' = :teamId`, { teamId })
              .execute();

            break;
          }
          default:
            logger.warn(
              {
                event,
                eventType,
              },
              'unhandled slack event type',
            );

            break;
        }

        return res.status(200).send({ success: true });
      } catch (error) {
        logger.error({ err: error }, 'error processing slack event');

        return res.status(500).send({ success: false });
      }
    },
  });

  // Handle Slack interactive component payloads (button clicks)
  // Slack sends form-urlencoded data with a JSON payload
  // Must set rawBody manually for signature verification
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body, done) => {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      done(null, body);
    },
  );

  fastify.post<{
    Body: string;
    Headers: {
      'x-slack-request-timestamp': string;
      'x-slack-signature': string;
    };
  }>('/interactions', {
    config: { rawBody: true },
    handler: async (req, res) => {
      try {
        if (
          !verifySlackSignature({
            req,
            secret: process.env.SLACK_INTERACTIONS_SIGNING_SECRET,
          })
        ) {
          return res.status(403).send({ error: 'invalid signature' });
        }
      } catch {
        return res.status(403).send({ error: 'invalid signature' });
      }

      try {
        const payloadString =
          typeof req.body === 'string'
            ? new URLSearchParams(req.body).get('payload')
            : (req.body as { payload?: string }).payload;

        const rawPayload = JSON.parse(payloadString || '{}');
        const payload = slackInteractionPayloadSchema.parse(rawPayload);
        const action = payload.actions[0];

        if (!action) {
          return res.status(200).send();
        }

        const handler = slackActionHandlers[action.action_id];
        if (!handler) {
          return res.status(200).send(); // Unknown action, ignore
        }

        const con = await createOrGetConnection();
        const value = handler.valueSchema.parse(JSON.parse(action.value));
        const responseText = await handler.handle({
          con,
          value,
          payload,
          action,
        });

        if (responseText && payload.response_url) {
          await fetch(payload.response_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              replace_original: true,
              text: responseText,
            }),
          });
        }

        return res.status(200).send();
      } catch {
        // Return 200 for invalid payloads to avoid Slack retries
        return res.status(200).send();
      }
    },
  });
}
