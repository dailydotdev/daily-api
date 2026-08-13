import { FastifyInstance, FastifyReply } from 'fastify';
import { parse } from 'node-html-parser';
import { z } from 'zod';
import { RegionUS } from 'customerio-node';
import CIORequest from 'customerio-node/dist/lib/request';
import { CustomerIORequestError } from 'customerio-node/dist/lib/utils';
import { retryFetch } from '../../integrations/retry';

class ArchivedMessageUnavailableError extends Error {}

const requestSchema = z.object({
  deliveryId: z.string().trim().min(1).max(255),
});

const isOnePixelValue = (value: string | undefined): boolean =>
  /^1(?:\.0+)?(?:px)?$/i.test(value?.trim() ?? '');

const isTrackingPixel = (image: {
  getAttribute: (name: string) => string | undefined;
}): boolean => {
  const width = image.getAttribute('width');
  const height = image.getAttribute('height');
  if (isOnePixelValue(width) && isOnePixelValue(height)) {
    return true;
  }

  const style = image.getAttribute('style') ?? '';
  const hasOnePixelWidth =
    /(?:^|;)\s*width\s*:\s*1(?:\.0+)?px\s*(?:!important)?\s*(?:;|$)/i.test(
      style,
    );
  const hasOnePixelHeight =
    /(?:^|;)\s*height\s*:\s*1(?:\.0+)?px\s*(?:!important)?\s*(?:;|$)/i.test(
      style,
    );

  return hasOnePixelWidth && hasOnePixelHeight;
};

export const prepareDigestEmailHtml = (html: string): string => {
  const root = parse(html);

  root.querySelectorAll('script, iframe, object, embed').forEach((element) => {
    element.remove();
  });
  root
    .querySelectorAll('img')
    .filter(isTrackingPixel)
    .forEach((image) => {
      image.remove();
    });

  return root.toString();
};

const getArchivedMessageBody = async (deliveryId: string): Promise<string> => {
  const request = new CIORequest(process.env.CIO_APP_KEY, {});
  const response = await request.get(
    `${RegionUS.apiUrl}/messages/${encodeURIComponent(deliveryId)}/archived_message`,
  );
  const body = response.body;

  if (response.hide_body === true || typeof body !== 'string' || !body.trim()) {
    throw new ArchivedMessageUnavailableError();
  }

  return body;
};

const unavailableResponse = (res: FastifyReply): FastifyReply =>
  res.status(503).send({ message: 'digest email preview is not configured' });

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: unknown }>('/', async (req, res) => {
    const token = process.env.PERSONALIZED_DIGEST_SECRET;
    if (!token) {
      return unavailableResponse(res);
    }

    if (req.headers.authorization !== `Bearer ${token}`) {
      return res.status(401).send({ message: 'unauthorized' });
    }

    if (!process.env.CIO_APP_KEY || !process.env.SCRAPER_URL) {
      return unavailableResponse(res);
    }

    const input = requestSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).send({ message: 'deliveryId is required' });
    }

    try {
      const html = prepareDigestEmailHtml(
        await getArchivedMessageBody(input.data.deliveryId),
      );
      const response = await retryFetch(
        `${process.env.SCRAPER_URL}/screenshot`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: html, selector: 'body' }),
        },
        { retries: 1 },
      );

      return res
        .type('image/png')
        .header('cache-control', 'private, no-store')
        .header('pragma', 'no-cache')
        .send(await response.buffer());
    } catch (error) {
      if (
        error instanceof ArchivedMessageUnavailableError ||
        (error instanceof CustomerIORequestError && error.statusCode === 404)
      ) {
        return res
          .status(404)
          .send({ message: 'archived digest email is not available' });
      }
      if (error instanceof CustomerIORequestError) {
        if (error.statusCode === 429) {
          return res
            .status(429)
            .send({ message: 'Customer.io preview limit reached' });
        }
      }

      req.log.error({ err: error }, 'failed to render digest email preview');
      return res
        .status(502)
        .send({ message: 'failed to render digest email preview' });
    }
  });
}
