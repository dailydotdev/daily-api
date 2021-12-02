import { FastifyInstance, FastifyReply } from 'fastify';
import { upperFirst } from 'lodash';
import { injectGraphql } from './utils';
import { GQLFeedSettings } from '../schema/feeds';

interface Publication {
  publicationId: string;
  userId?: string;
  enabled: boolean;
}

interface Tag {
  userId?: string;
  tag: string;
}

const mapFeedToPublications = (feed: GQLFeedSettings): Publication[] =>
  feed.excludeSources.map((s) => ({
    userId: feed.userId,
    publicationId: s.id,
    enabled: false,
  }));

const mapFeedToTags = (feed: GQLFeedSettings): Tag[] =>
  feed.includeTags.map((t) => ({
    userId: feed.userId,
    tag: t,
  }));

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/publications', async (req, res) => {
    const query = `{
  feedSettings {
    userId
    excludeSources {
      id
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => mapFeedToPublications(obj['data']['feedSettings']),
      req,
      res,
    );
  });

  fastify.post('/publications', async (req, res) => {
    const updateFilters = (
      mutation: string,
      pubs: Publication[],
    ): Promise<FastifyReply> => {
      const query = `
  mutation ${upperFirst(mutation)}($filters: FiltersInput!) {
    ${mutation}(filters: $filters) {
      userId
      excludeSources {
        id
      }
    }
  }`;
      return injectGraphql(
        fastify,
        {
          query,
          variables: {
            filters: { excludeSources: pubs.map((p) => p.publicationId) },
          },
        },
        (obj) => mapFeedToPublications(obj['data'][mutation]),
        req,
        res,
      );
    };

    const pubs = req.body as Publication[];
    const add = pubs.filter((p) => !p.enabled);
    if (add.length) {
      return updateFilters('addFiltersToFeed', add);
    }
    const remove = pubs.filter((p) => p.enabled);
    return updateFilters('removeFiltersFromFeed', remove);
  });

  fastify.get('/tags', async (req, res) => {
    const query = `{
  feedSettings {
    userId
    includeTags
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => mapFeedToTags(obj['data']['feedSettings']),
      req,
      res,
    );
  });

  fastify.post('/tags', async (req, res) => {
    const query = `
  mutation AddFiltersToFeed($filters: FiltersInput!) {
    addFiltersToFeed(filters: $filters) {
      userId
      includeTags
    }
  }`;
    const tags = req.body as Tag[];
    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          filters: { includeTags: tags.map((t) => t.tag) },
        },
      },
      (obj) => mapFeedToTags(obj['data']['addFiltersToFeed']),
      req,
      res,
    );
  });

  fastify.delete('/tags', async (req, res) => {
    const query = `
  mutation RemoveFiltersFromFeed($filters: FiltersInput!) {
    removeFiltersFromFeed(filters: $filters) {
      userId
      includeTags
    }
  }`;
    const tag = req.body as Tag;
    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          filters: { includeTags: [tag.tag] },
        },
      },
      (obj) => mapFeedToTags(obj['data']['removeFiltersFromFeed']),
      req,
      res,
    );
  });
}
