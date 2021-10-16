import { FastifyInstance } from 'fastify';
import { injectGraphql } from './utils';

const renameKey = (
  obj: Record<string, unknown>,
  oldKey: string,
  newKey: string,
): Record<string, unknown> => {
  const newObj = { ...obj };
  newObj[newKey] = obj[oldKey];
  delete newObj[oldKey];
  return newObj;
};

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
    openNewTab
    alertFilter
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) =>
        renameKey(
          obj['data']['userSettings'],
          'showOnlyUnreadPosts',
          'showOnlyNotReadPosts',
        ),
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
          data: renameKey(
            req.body,
            'showOnlyNotReadPosts',
            'showOnlyUnreadPosts',
          ),
        },
      },
      () => undefined,
      req,
      res,
    );
  });
}
