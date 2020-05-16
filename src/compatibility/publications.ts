import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { injectGraphql } from './utils';
import { ServerResponse } from 'http';
import { SourceRequest } from '../entity';
import { toLegacySourceRequest } from './entity';

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
      (obj) =>
        obj['data']['sources']['edges'].map((e) => ({
          ...e['node'],
          enabled: true,
        })),
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
        obj['data']['pendingSourceRequests']['edges'].map((e) =>
          toLegacySourceRequest(e['node'] as SourceRequest),
        ),
      req,
      res,
    );
  });

  fastify.put('/requests/:id', async (req, res) => {
    const query = `
  mutation UpdateSourceRequest($data: UpdateSourceRequestInput!) {
  updateSourceRequest(id: "${req.params.id}", data: $data) {
    id
  }
}`;

    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          data: {
            sourceUrl: req.body.url,
            sourceId: req.body.pubId,
            sourceName: req.body.pubName,
            sourceImage: req.body.pubImage,
            sourceTwitter: req.body.pubTwitter,
            sourceFeed: req.body.pubRss,
          },
        },
      },
      () => undefined,
      req,
      res,
    );
  });

  fastify.post('/requests/:id/decline', async (req, res) => {
    const query = `
  mutation DeclineSourceRequest($data: DeclineSourceRequestInput!) {
  declineSourceRequest(id: "${req.params.id}", data: $data) {
    id
  }
}`;

    return injectGraphql(
      fastify,
      {
        query,
        variables: {
          data: { reason: req.body.reason },
        },
      },
      () => undefined,
      req,
      res,
    );
  });

  fastify.post('/requests/:id/approve', async (req, res) => {
    const query = `
  mutation ApproveSourceRequest {
  approveSourceRequest(id: "${req.params.id}") {
    id
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

  fastify.post('/requests/:id/publish', async (req, res) => {
    const query = `
  mutation PublishSourceRequest {
  publishSourceRequest(id: "${req.params.id}") {
    id
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
