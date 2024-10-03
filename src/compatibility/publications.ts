import { FastifyInstance } from 'fastify';
import { injectGraphql } from './utils';
import { SourceRequest } from '../entity';
import { toLegacySourceRequest } from './entity';

export default async function (fastify: FastifyInstance): Promise<void> {
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
        // @ts-expect-error - legacy code
        obj['data']['pendingSourceRequests']['edges'].map((e) =>
          toLegacySourceRequest(e['node'] as SourceRequest),
        ),
      req,
      res,
    );
  });

  fastify.put<{
    Params: { id: string };
    Body: {
      url: string;
      pubId: string;
      pubName: string;
      pubImage: string;
      pubTwitter: string;
      pubRss: string;
    };
  }>('/requests/:id', async (req, res) => {
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

  fastify.post<{ Params: { id: string }; Body: { reason: string } }>(
    '/requests/:id/decline',
    async (req, res) => {
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
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/requests/:id/approve',
    async (req, res) => {
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
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/requests/:id/publish',
    async (req, res) => {
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
    },
  );
}
