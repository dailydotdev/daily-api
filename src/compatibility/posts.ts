import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { offsetToCursor } from 'graphql-relay';
import { GraphqlPayload, injectGraphql, postFields } from './utils';
import { Post } from '../entity';
import createOrGetConnection from '../db';

const getPaginationParams = (
  req: FastifyRequest<{
    Querystring: { pageSize?: number; page?: number; latest?: string };
  }>,
): string => {
  const pageSize = Math.min(req.query.pageSize || 30, 40);
  const offset = pageSize * (req.query.page || 0);
  const after = offset ? `, after: "${offsetToCursor(offset)}"` : '';
  const now = new Date(req.query.latest).toISOString();
  return `now: "${now}", first: ${pageSize}${after}`;
};

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

  fastify.delete<{ Params: { id: string } }>(
    '/:id/bookmark',
    async (req, res) => {
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
    },
  );

  fastify.get<{
    Querystring: { pageSize?: number; page?: number; latest?: string };
  }>('/bookmarks', async (req, res) => {
    const query = `{
  bookmarksFeed(${getPaginationParams(req)}) {
    edges {
      node {
        ${postFields(req.userId)}
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['bookmarksFeed']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });

  const latestHandler = async (
    req: FastifyRequest<{
      Querystring: {
        pageSize?: number;
        page?: number;
        latest?: string;
        sources: string;
        tags: string;
      };
    }>,
    res: FastifyReply,
  ): Promise<FastifyReply> => {
    const pageParams = getPaginationParams(req);
    let name: string;
    let query: GraphqlPayload;
    if (!req.userId) {
      name = 'anonymousFeed';
      query = {
        query: `query AnonymousFeed($filters: FiltersInput) {
  anonymousFeed(filters: $filters, ${pageParams}) {
    edges {
      node {
        ${postFields(req.userId)}
      }
    }
  }
}`,
        variables: {
          filters: {
            includeSources: req.query.sources,
            includeTags: req.query.tags,
          },
        },
      };
    } else {
      name = 'feed';
      query = {
        query: `{
  feed(${pageParams}) {
    edges {
      node {
        ${postFields(req.userId)}
      }
    }
  }
}`,
      };
    }
    return injectGraphql(
      fastify,
      query,
      (obj) =>
        obj['data'][name]['edges'].map((e) => ({
          ...e['node'],
          type: 'post',
        })),
      req,
      res,
    );
  };

  fastify.get('/latest', latestHandler);
  fastify.get('/toilet', latestHandler);

  fastify.get<{
    Querystring: {
      pageSize?: number;
      page?: number;
      latest?: string;
      pub: string;
    };
  }>('/publication', async (req, res) => {
    const pageParams = getPaginationParams(req);
    const query = `{
  sourceFeed(source: "${req.query.pub}", ${pageParams}) {
    edges {
      node {
        ${postFields(req.userId)}
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

  fastify.get<{
    Querystring: {
      pageSize?: number;
      page?: number;
      latest?: string;
      tag: string;
    };
  }>('/tag', async (req, res) => {
    const pageParams = getPaginationParams(req);
    const query = `{
  tagFeed(tag: "${req.query.tag}", ${pageParams}) {
    edges {
      node {
        ${postFields(req.userId)}
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

  fastify.get<{ Params: { id: string } }>('/:id', async (req, res) => {
    const con = await createOrGetConnection();
    const post = await con.getRepository(Post).findOne({
      select: ['id', 'title', 'url'],
      where: [{ id: req.params.id }, { shortId: req.params.id }],
    });
    if (!post) {
      return res.status(404).send();
    }
    return res.send(post);
  });

  fastify.post<{ Params: { id: string } }>('/:id/hide', async (req, res) => {
    const query = `
  mutation HidePost {
  hidePost(id: "${req.params.id}") {
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

  fastify.post<{ Body: { reason: string }; Params: { id: string } }>(
    '/:id/report',
    async (req, res) => {
      const reason = req?.body?.reason.toUpperCase();
      const query = `
  mutation ReportPost {
  reportPost(id: "${req.params.id}", reason: ${reason}) {
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
    },
  );
}
