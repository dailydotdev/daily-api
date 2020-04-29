import { FastifyInstance } from 'fastify';
import { offsetToCursor } from 'graphql-relay';
import { injectGraphql } from './utils';

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
    const pageSize = Math.min(req.query.pageSize || 30, 40);
    const offset = pageSize * (req.query.page || 0);
    const after = offset ? `, after: "${offsetToCursor(offset)}"` : '';
    const now = new Date(req.query.latest).toISOString();
    // TODO: add missing fields bookmarked, read, tags, publication
    const query = `{
  bookmarks(now: "${now}", first: ${pageSize}${after}) {
    edges {
      node {
        id
        publishedAt
        createdAt
        url
        title
        image
        ratio
        placeholder
        readTime
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
}
