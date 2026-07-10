import { FastifyInstance, FastifyReply } from 'fastify';
import { retryFetch } from '../integrations/retry';
import { WEBAPP_MAGIC_IMAGE_PREFIX } from '../config';

// Contextual Open Graph share images. Mirrors the devcard v2 approach: render a
// real webapp page and screenshot it via the scraper — no Satori. Each type
// maps to /image-generator/share/<type>/<id> on the webapp, captured at the
// `#screenshot_wrapper` element (sized to 1200×630 by the page).
const ALLOWED_TYPES = new Set([
  'posts',
  'comments',
  'sources',
  'squads',
  'profile',
  'tags',
  'invite',
  'plus',
]);

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Params: { type: string; name: string };
    Querystring: { userid?: string };
  }>('/:type/:name', async (req, res): Promise<FastifyReply> => {
    const { type } = req.params;
    const [id, format] = req.params.name.split('.');

    if (!ALLOWED_TYPES.has(type) || format !== 'png' || !id) {
      return res.status(404).send();
    }

    const url = new URL(
      `${WEBAPP_MAGIC_IMAGE_PREFIX}/share/${type}/${encodeURIComponent(id)}`,
      process.env.COMMENTS_PREFIX,
    );
    // Forward the sharer for post-share attribution ("{name} shared").
    if (req.query?.userid) {
      url.searchParams.set('userid', req.query.userid);
    }

    const response = await retryFetch(`${process.env.SCRAPER_URL}/screenshot`, {
      method: 'POST',
      body: JSON.stringify({ url, selector: '#screenshot_wrapper' }),
      headers: { 'content-type': 'application/json' },
    });

    return res
      .type(response.headers.get('content-type')!)
      .header('cross-origin-opener-policy', 'cross-origin')
      .header('cross-origin-resource-policy', 'cross-origin')
      .header('cache-control', 'public, max-age=3600, s-maxage=3600')
      .send(await response.buffer());
  });
}
