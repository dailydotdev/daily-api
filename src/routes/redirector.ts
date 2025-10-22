import z from 'zod';
import { URL } from 'url';
import { FastifyInstance } from 'fastify';
import { ArticlePost, Post } from '../entity';
import { getDiscussionLink, notifyView, systemUser } from '../common';
import createOrGetConnection from '../db';
import { isNullOrUndefined } from '../common/object';
import { UserReferralLinkedin } from '../entity/user/referral/UserReferralLinkedin';
import {
  UserTransaction,
  UserTransactionProcessor,
  UserTransactionStatus,
  UserTransactionType,
} from '../entity/user/UserTransaction';
import { randomUUID } from 'crypto';
import { usdToCores } from '../common/number';
import { transferCores } from '../common/njord';

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
          req.log,
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
    const id = req.params.id;
    if (!id) {
      req.log.info('No referral id provided, skipping recruiter redirector');
      return;
    }

    const isValidUUID = z.uuidv4().safeParse(id);
    if (isValidUUID.error) {
      req.log.info(
        'Invalid referral id provided, skipping recruiter redirector',
      );
      return;
    }

    if (req.userId) {
      req.log.info('User is logged in, skipping recruiter redirector');
      return;
    }

    const referrer = req.headers['referer'];
    if (isNullOrUndefined(referrer)) {
      req.log.info('No referrer provided, skipping recruiter redirector');
      return;
    }

    if (referrer.startsWith('https://www.linkedin.com/') === false) {
      req.log.info('Referrer is not linkedin, skipping recruiter redirector');
      return;
    }

    const con = await createOrGetConnection();

    try {
      const updateResult = await con
        .getRepository(UserReferralLinkedin)
        .update({ id: id, visited: false }, { visited: true });

      if (updateResult.affected === 0) {
        req.log.info('Referral already processed or not found');
        return;
      }

      await con.transaction(async (manager) => {
        const referral = await manager
          .getRepository(UserReferralLinkedin)
          .findOneOrFail({
            where: { id: id },
          });

        const userTransaction = await manager
          .getRepository(UserTransaction)
          .save(
            manager.getRepository(UserTransaction).create({
              id: randomUUID(),
              processor: UserTransactionProcessor.Njord,
              receiverId: referral.userId,
              status: UserTransactionStatus.Success,
              productId: null,
              senderId: systemUser.id,
              value: usdToCores(5),
              valueIncFees: 0,
              fee: 0,
              flags: { note: 'Linkedin recruiter referral' },
              referenceId: id,
              referenceType: UserTransactionType.ReferralLinkedin,
            }),
          );

        await transferCores({
          ctx: { userId: referral.userId },
          transaction: userTransaction,
          entityManager: manager,
        });
      });

      req.log.info(
        `Marked referral ${id} as visited and rewarded user with cores`,
      );
    } catch (_err) {
      const err = _err as Error;
      req.log.error(
        { err, referralId: id },
        'Failed to mark referral as visited',
      );

      await con
        .getRepository(UserReferralLinkedin)
        .update({ id: id }, { visited: false });
      return;
    }
  });

  fastify.get<{ Params: { id: string } }>('/:id', (_, res) =>
    res.redirect(
      'https://recruiter.daily.dev/?utm_source=redirector&utm_medium=linkedin_referral',
    ),
  );
};
