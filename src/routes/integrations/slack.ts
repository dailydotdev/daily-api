import { FastifyInstance, FastifyReply } from 'fastify';
import createOrGetConnection from '../../db';
import { logger } from '../../logger';
import {
  IntegrationMetaSlack,
  UserIntegrationSlack,
} from '../../entity/UserIntegration';
import { SlackAuthResponse } from '../../types';
import { RedirectError } from '../../errors';
import { encrypt } from '../../common';
import fetch from 'node-fetch';

const redirectResponse = ({
  res,
  path,
  error,
}: {
  res: FastifyReply;
  path: string;
  error?: RedirectError;
}): FastifyReply => {
  const url = new URL(`${process.env.COMMENTS_PREFIX}${path}`);

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
        }),
      });

      if (!response.ok) {
        const message = 'failed to get slack token';
        logger.error({ response }, message);

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

      if (existingIntegration) {
        await con
          .getRepository(UserIntegrationSlack)
          .update({ id: existingIntegration.id }, { meta: integrationMeta });
      } else {
        await con.getRepository(UserIntegrationSlack).insert({
          userId: req.userId,
          meta: integrationMeta,
        });
      }

      return redirectResponse({ res, path: redirectPath });
    } catch (error) {
      const isRedirectError = error instanceof RedirectError;

      if (!isRedirectError) {
        logger.error({ err: error }, 'error processing slack auth callback');
      }

      redirectResponse({
        res,
        path: redirectPath,
        error: isRedirectError ? error : new RedirectError('internal error'),
      });
    }
  });
}
