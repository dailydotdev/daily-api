import appFunc from '../../../src';
import { FastifyInstance } from 'fastify';

import request from 'supertest';
import { generateKeyPairSync, type ECKeyPairOptions } from 'crypto';
import { sign } from 'jsonwebtoken';

function createSignedData(): string {
  const payload = {
    notificationType: 'SUBSCRIBED',
    subtype: 'INITIAL_BUY',
    notificationUUID: '002e14d5-51f5-4503-b5a8-c3a1af68eb20',
    data: {
      environment: 'LocalTesting',
      appAppleId: 41234,
      bundleId: 'com.example',
      bundleVersion: '1.2.3',
      signedTransactionInfo: 'signed_transaction_info_value',
      signedRenewalInfo: 'signed_renewal_info_value',
      status: 1,
    },
    version: '2.0',
    signedDate: 1698148900000,
  };
  const keyPairOptions: ECKeyPairOptions<'pem', 'pem'> = {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  };
  const keypair = generateKeyPairSync('ec', keyPairOptions);
  const privateKey = keypair.privateKey;
  return sign(payload, privateKey, { algorithm: 'ES256' });
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
});

describe('POST /webhooks/apple/notifications', () => {
  const signedPayload = createSignedData();

  it('should return 403 when IP address is not in list of approved IPs', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/apple/notifications')
      .set('X-Forwarded-For', '8.8.8.8') // Set client IP
      .send({ signedPayload })
      .expect(403);

    expect(body.error).toEqual('Forbidden');
  });

  it('should return 403 when payload is incorrect', async () => {
    const { body } = await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({
        signedPayload: 'wolololo',
      })
      .expect(403);

    expect(body.error).toEqual('Invalid Payload');
  });

  it('should return 200 when payload is correct', async () => {
    await request(app.server)
      .post('/webhooks/apple/notifications')
      .send({ signedPayload })
      .expect(200);
  });
});
