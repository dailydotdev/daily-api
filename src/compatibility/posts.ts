import { FastifyInstance } from 'fastify';
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
}
