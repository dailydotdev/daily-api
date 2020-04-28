import { FastifyInstance } from 'fastify';
import { injectGraphql } from './utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
  userSettings {
    userId
    theme
    enableCardAnimations
    showTopSites
    insaneMode
    appInsaneMode
    spaciness
    showOnlyUnreadPosts
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['userSettings'],
      req,
      res,
    );
  });

  fastify.post('/', async (req, res) => {
    const query = `
  mutation UpdateUserSettings($data: UpdateSettingsInput!) {
  updateUserSettings(data: $data) {
    userId
  }
}`;

    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          data: req.body,
        },
      },
      () => undefined,
      req,
      res,
    );
  });
}
