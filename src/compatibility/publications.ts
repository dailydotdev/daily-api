import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { injectGraphql } from './utils';
import { ServerResponse } from 'http';
import { SourceRequest } from '../entity';

export default async function (fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (req, res) => {
    const query = `{
  sources(first: 500) {
    edges {
      node {
        id
        name
        image
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) => obj['data']['sources']['edges'].map((e) => e['node']),
      req,
      res,
    );
  });

  const requestSource = (
    req: FastifyRequest,
    res: FastifyReply<ServerResponse>,
  ): Promise<FastifyReply<ServerResponse>> => {
    const query = `
  mutation RequestSource($data: RequestSourceInput!) {
  requestSource(data: $data) {
    sourceUrl
    userId
    userName
    userEmail
  }
}`;

    return injectGraphql(
      fastify,
      { query, variables: { data: { sourceUrl: req.body.url } } },
      () => undefined,
      req,
      res,
    );
  };

  fastify.post('/request', requestSource);
  fastify.post('/requests', requestSource);

  fastify.get('/requests/open', async (req, res) => {
    const query = `{
  pendingSourceRequests(first: 100) {
    edges {
      node {
        id
        sourceUrl
        userId
        userName
        userEmail
        approved
        closed
        sourceId
        sourceName
        sourceImage
        sourceTwitter
        sourceFeed
        createdAt
      }
    }
  }
}`;
    return injectGraphql(
      fastify,
      { query },
      (obj) =>
        obj['data']['pendingSourceRequests']['edges'].map((e) => {
          const node = e['node'] as Partial<SourceRequest>;
          return {
            id: node.id,
            url: node.sourceUrl,
            userId: node.userId,
            userName: node.userName,
            userEmail: node.userEmail,
            approved: node.approved,
            closed: node.closed,
            pubId: node.sourceId,
            pubName: node.sourceName,
            pubImage: node.sourceImage,
            pubTwitter: node.sourceTwitter,
            pubRss: node.sourceFeed,
            createdAt: node.createdAt,
          };
        }),
      req,
      res,
    );
  });
}
