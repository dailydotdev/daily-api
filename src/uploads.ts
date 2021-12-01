import {
  FastifyInstance,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FastifyRequest,
} from 'fastify';
import fp from 'fastify-plugin';
import { processRequest } from 'graphql-upload';

declare module 'fastify' {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface FastifyRequest {
    isMultipart?: boolean;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}

const plugin = async (fastify: FastifyInstance): Promise<void> => {
  // Handle all requests that have the `Content-Type` header set as mutlipart
  fastify.addContentTypeParser('multipart', (request, payload, done) => {
    request.isMultipart = true;
    done(null);
  });

  // Format the request body to follow graphql-upload's
  fastify.addHook('preValidation', async function (request, reply) {
    if (!request.isMultipart) {
      return;
    }

    request.body = await processRequest(request.raw, reply.raw, {
      maxFileSize: 1024 * 1024 * 2,
      maxFiles: 1,
    });
  });
};

export default fp(plugin, {
  name: 'uploads',
});
