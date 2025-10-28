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

const recruiterRedirector = async (fastify: FastifyInstance): Promise<void> => {
  fastify.addHook<{ Params: { id: string } }>('onResponse', async (req) => {
    const { error, data: id } = z.uuidv4().safeParse(req.params.id);
    if (error) {
      logger.debug(
        { referralId: req.params.id },
        'Invalid referral id provided, skipping recruiter redirector',
      );
      return;
    }

    if (req.userId) {
      logger.debug(
        { referralId: id },
        'User is logged in, skipping recruiter redirector',
      );
      return;
    }

    const referrer = req.headers['referer'];
    if (isNullOrUndefined(referrer)) {
      logger.debug(
        { referralId: id },
        'No referrer provided, skipping recruiter redirector',
      );
      return;
    }

    if (referrer.startsWith('https://www.linkedin.com/') === false) {
      logger.debug(
        { referralId: id, referrer },
        'Referrer is not linkedin, skipping recruiter redirector',
      );
      return;
    }

    const con = await createOrGetConnection();

    try {
      const result = await con.getRepository(UserReferralLinkedin).update(
        {
          id: id,
          status: UserReferralStatus.Pending,
          visited: false,
          flags: Not(JsonContains({ hashedRequestIP: hmacHashIP(req.ip) })),
        },
        { visited: true },
      );

      if (result.affected === 0) {
        logger.debug(
          { referralId: id },
          `No referral found or referral already marked as visited`,
        );
        return;
      }

      logger.debug({ referralId: id }, 'Marked referral as visited');
    } catch (_err) {
      const err = _err as Error;
      logger.error(
        { err, referralId: id },
        'Failed to mark referral as visited',
      );
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', (_, res) =>
    res.redirect(
      'https://recruiter.daily.dev/?utm_source=dailydev&utm_medium=linkedin_referral',
    ),
  );
};
