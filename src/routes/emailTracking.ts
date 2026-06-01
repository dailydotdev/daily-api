import { FastifyInstance } from 'fastify';

const isRelativePath = (path: string): boolean =>
  path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { r?: string; link_id?: string } }>(
    '/c',
    async (req, res) => {
      const { r, link_id: linkId } = req.query;

      if (linkId) {
        const trackingDomain = process.env.EMAIL_TRACKING_ORIGIN;

        if (!trackingDomain) {
          throw new Error('No tracking domain');
        }

        const url = `${process.env.EMAIL_TRACKING_ORIGIN}/click/${encodeURIComponent(
          linkId,
        )}`;

        fetch(url, { method: 'POST' })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`HTTP error ${response.status}`);
            }
          })
          .catch((err) => {
            req.log.error(
              { err, linkId },
              'failed to attribute email click to customer.io',
            );
          });
      }

      const target = r && isRelativePath(r) ? r : '/';

      return res.redirect(`${process.env.COMMENTS_PREFIX}${target}`, 307);
    },
  );
}
