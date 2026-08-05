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
  // The world card composes around a plate the owner's browser already
  // rendered, so this stays an ordinary DOM capture: no WebGL in the scraper.
  'world',
]);

/**
 * Per-type capture options. Everything absent here keeps the scraper's defaults
 * (1280x768 at 2x, PNG), which is what the other types are authored against.
 */
const SCRAPER_OPTIONS: Record<string, Record<string, unknown> | undefined> = {
  // Authored at its true output size rather than half of it, so 1x. JPEG
  // because most of the card is a photographic render of a 3D world, where PNG
  // costs several hundred kilobytes and shows nothing extra. Its own webfont is
  // the point of a branded card, so the Roboto override is off.
  world: {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1,
    imageType: 'jpeg',
    quality: 88,
    keepFonts: true,
  },
};

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get<{
    Params: { type: string; name: string };
    Querystring: { userid?: string };
  }>('/:type/:name', async (req, res): Promise<FastifyReply> => {
    const { type } = req.params;
    const [id, format] = req.params.name.split('.');

    // The extension is part of the public URL rather than a request for a
    // format: what comes back is whatever SCRAPER_OPTIONS captures, and the
    // content-type header is what consumers actually read.
    if (!ALLOWED_TYPES.has(type) || !['png', 'jpg'].includes(format) || !id) {
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
      body: JSON.stringify({
        url,
        selector: '#screenshot_wrapper',
        ...SCRAPER_OPTIONS[type],
      }),
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
