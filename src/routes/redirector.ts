import z from 'zod';
import { URL } from 'url';
import { FastifyInstance } from 'fastify';
import { ArticlePost, Post } from '../entity';
import { getDiscussionLink, hmacHashIP, notifyView } from '../common';
import createOrGetConnection from '../db';
import { isNullOrUndefined } from '../common/object';
import { UserReferralLinkedin } from '../entity/user/referral/UserReferralLinkedin';
import { JsonContains, Not } from 'typeorm';
import { logger } from '../logger';
import { UserReferralStatus } from '../entity/user/referral/UserReferral';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { postId: string }; Querystring: { a?: string } }>(
    '/:postId',
    async (req, res) => {
      const con = await createOrGetConnection();
      const q = con
        .createQueryBuilder()
        .select([
          'post.id AS id',
          'post.url AS url',
          'post.tagsStr AS "tagsStr"',
          'post.slug AS slug',
        ])
        .from(Post, 'post')
        .where('post.id = :id OR post.shortId = :id', {
          id: req.params.postId,
        });

      const post =
        await q.getRawOne<
          Pick<ArticlePost, 'id' | 'url' | 'tagsStr' | 'slug'>
        >();

      if (!post) {
        return res.status(404).send();
      }
      if (!post?.url) {
        return res.status(302).redirect(getDiscussionLink(post.slug));
      }
      const url = new URL(post.url);
      url.searchParams.append('ref', 'dailydev');
      const encodedUri = encodeURI(url.href);
      if (req.isBot) {
        return res.status(302).redirect(encodedUri);
      }
      const userId = req.userId || req.trackingId;
      if (userId) {
        notifyView(
          logger,
          post.id,
          userId,
          req.headers['referer'],
          new Date(),
          post.tagsStr?.split?.(',') ?? [],
        );
      }
      return res
        .headers({
          'Referrer-Policy': 'origin, origin-when-cross-origin',
          Link: `<${encodedUri}>; rel="preconnect"`,
        })
        .type('text/html')
        .send(
          `<html><head><meta name="robots" content="noindex,nofollow"><meta http-equiv="refresh" content="0;URL=${encodedUri}${
            req.query.a ? `#${req.query.a}` : ''
          }"></head></html>`,
        );
    },
  );

  fastify.register(recruiterRedirector, { prefix: '/recruiter' });
}

export const BASE_RECRUITER_URL =
  'https://recruiter.daily.dev/?utm_source=redirector&utm_medium=linkedin&utm_campaign=referral';

const recruiterRedirector = async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorateRequest('con');
  fastify.decorateRequest('referral');

  fastify.addHook('onResponse', async (req) => {
    if (!req.referral) {
      logger.debug(
        'No referral found on request, skipping recruiter redirector',
      );
      return;
    }

    if (
      req.referral.status !== UserReferralStatus.Pending ||
      req.referral.visited
    ) {
      logger.debug(
        {
          referralId: req.referral.id,
          status: req.referral.status,
          visited: req.referral.visited,
        },
        'Referral is not pending or has been visited, skipping recruiter redirector',
      );
      return;
    }

    if (req.userId) {
      logger.debug(
        { referralId: req.referral.id },
        'User is logged in, skipping recruiter redirector',
      );
      return;
    }

    const referrer = req.headers['referer'];
    if (isNullOrUndefined(referrer)) {
      logger.debug(
        { referralId: req.referral.id },
        'No referrer provided, skipping recruiter redirector',
      );
      return;
    }

    if (referrer.startsWith('https://www.linkedin.com/') === false) {
      logger.debug(
        { referralId: req.referral.id, referrer },
        'Referrer is not linkedin, skipping recruiter redirector',
      );
      return;
    }

    try {
      const result = await req.con?.getRepository(UserReferralLinkedin).update(
        {
          id: req.referral.id,
          status: UserReferralStatus.Pending,
          visited: false,
          flags: Not(JsonContains({ hashedRequestIP: hmacHashIP(req.ip) })),
        },
        { visited: true },
      );

      if (result?.affected === 0) {
        logger.debug(
          { referralId: req.referral.id },
          `No referral found or referral already marked as visited`,
        );
        return;
      }

      logger.debug(
        { referralId: req.referral.id },
        'Marked referral as visited',
      );
    } catch (_err) {
      const err = _err as Error;
      logger.error(
        { err, referralId: req.referral.id },
        'Failed to mark referral as visited',
      );
    }
  });

  fastify.addHook<{ Params: { id: string } }>('preHandler', async (req) => {
    const { error, data: id } = z.uuidv4().safeParse(req.params.id);
    if (error) {
      logger.debug(
        { referralId: req.params.id },
        'Invalid referral id provided, skipping recruiter redirector',
      );
      return;
    }
    req.con = await createOrGetConnection();
    req.referral = await req.con.getRepository(UserReferralLinkedin).findOne({
      where: { id: id },
    });
  });

  fastify.get<{ Params: { id: string } }>('/:id', (req, res) => {
    const url = new URL(BASE_RECRUITER_URL);
    if (req.referral) {
      url.searchParams.append('utm_content', req.referral.userId);
    }
    return res.redirect(url.toString());
  });
};
