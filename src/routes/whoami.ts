import { FastifyInstance } from 'fastify';
import { injectGraphql } from '../compatibility/utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      whoami {
        id
        name
        email
        image
        createdAt
        company
        username
        bio
        title
        twitter
        github
        hashnode
        roadmap
        threads
        codepen
        reddit
        stackoverflow
        youtube
        linkedin
        mastodon
        portfolio
        infoConfirmed
        timezone
        reputation
        acceptedMarketing
        notificationEmail
      }
    }`;

    return injectGraphql(
      fastify,
      { query },
      // @ts-expect-error - legacy code
      (obj) => obj['data']['whoami'],
      req,
      res,
    );
  });
}
