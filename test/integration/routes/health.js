import { expect } from 'chai';
import supertest from 'supertest';

import app from '../../../src';

describe('health routes', () => {
  let request;
  let server;

  before(() => {
    server = app.listen();
    request = supertest(server);
  });

  after(() => {
    server.close();
  });

  it('should return 200 with healthy response', async () => {
    const result = await request
      .get('/_ah/health')
      .expect(200);

    expect(result.body).to.deep.equal({ health: 'OK' });
  });
});
