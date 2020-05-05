import { FastifyInstance, FastifyRequest } from 'fastify';
import { offsetToCursor } from 'graphql-relay';
import { injectGraphql } from './utils';

const getPaginationParams = (req: FastifyRequest): string => {
  const pageSize = Math.min(req.query.pageSize || 30, 40);
  const offset = pageSize * (req.query.page || 0);
  const after = offset ? `, after: "${offsetToCursor(offset)}"` : '';
  const now = new Date(req.query.latest).toISOString();
  return `now: "${now}", first: ${pageSize}${after}`;
};

// TODO: add missing fields bookmarked, read, tags, publication
const postFields = `
id
publishedAt
createdAt
url
title
image
ratio
placeholder
readTime
tags
`;

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.post('/bookmarks', async (req, res) => {
    const query = `
  mutation AddBookmarks($data: AddBookmarkInput!) {
  addBookmarks(data: $data) {
    _
  }
}`;

    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          data: { postIds: req.body },
        },
      },
      () => undefined,
      req,
      res,
    );
  });

  fastify.delete('/:id/bookmark', async (req, res) => {
    const query = `
  mutation RemoveBookmark {
  removeBookmark(id: "${req.params.id}") {
    _
  }
}`;

    return injectGraphql(
      fastify,
      {
        query,
      },
      () => undefined,
      req,
      res,
    );
  });

  fastify.get('/bookmarks', async (req, res) => {
    const query = `{
  bookmarks(${getPaginationParams(req)}) {
    edges {
      node {
        ${postFields}
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['bookmarks']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });

  fastify.get('/latest', async (req, res) => {
    const pageParams = getPaginationParams(req);
    const query = `query AnonymousFeed($filters: FiltersInput) {
  anonymousFeed(filters: $filters, ${pageParams}) {
    edges {
      node {
        ${postFields}
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          filters: {
            includeSources: req.query.sources,
            includeTags: req.query.tags,
          },
        },
      },
      (obj) => obj['data']['anonymousFeed']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });

  fastify.get('/publication', async (req, res) => {
    const pageParams = getPaginationParams(req);
    const query = `{
  sourceFeed(source: "${req.query.pub}", ${pageParams}) {
    edges {
      node {
        ${postFields}
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['sourceFeed']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });

  fastify.get('/tag', async (req, res) => {
    const pageParams = getPaginationParams(req);
    const query = `{
  tagFeed(tag: "${req.query.tag}", ${pageParams}) {
    edges {
      node {
        ${postFields}
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['tagFeed']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });

  fastify.get('/:id', async (req, res) => {
    const query = `{
  post(id: "${req.params.id}") {
    ${postFields}
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['post'],
      req,
      res,
    );
  });
}
