import {
  Code,
  ConnectError,
  createClient,
  createRouterTransport,
} from '@connectrpc/connect';
import {
  AudienceFitRequest,
  AudienceFitResponse,
  Pipelines,
} from '@dailydotdev/schema';
import { getBragiClient } from '../../src/integrations/bragi/clients';

const createMockBragiAudienceFitNotFoundTransport = () =>
  createRouterTransport(({ service }) => {
    service(Pipelines, {
      audienceFit: () => {
        throw new ConnectError('not found', Code.NotFound);
      },
    });
  });

describe('bragi audienceFit', () => {
  it('returns an AudienceFitResponse from the mock client', async () => {
    const bragiClient = getBragiClient();
    const response = await bragiClient.garmr.execute(() =>
      bragiClient.instance.audienceFit(
        new AudienceFitRequest({
          title: 'A zig post',
          content: 'building cool things in zig',
          contentType: 'article',
        }),
      ),
    );

    expect(response).toBeInstanceOf(AudienceFitResponse);
    expect(typeof response.audienceFit).toBe('number');
  });

  it('propagates a NotFound error from bragi', async () => {
    const client = createClient(
      Pipelines,
      createMockBragiAudienceFitNotFoundTransport(),
    );

    await expect(
      client.audienceFit(
        new AudienceFitRequest({
          title: 'A zig post',
          content: 'building cool things in zig',
          contentType: 'article',
        }),
      ),
    ).rejects.toThrow(new ConnectError('not found', Code.NotFound));
  });
});
