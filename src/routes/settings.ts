import { FastifyInstance } from 'fastify';
import { injectGraphql } from '../compatibility/utils';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
      userSettings {
        theme
        showTopSites
        insaneMode
        spaciness
        showOnlyUnreadPosts
        openNewTab
        sidebarExpanded
        companionExpanded
        sortingEnabled
        customLinks
        optOutWeeklyGoal
        optOutCompanion
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
}
