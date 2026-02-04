import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { DatasetTool } from '../../../src/entity/DatasetTool';

const state = setupPublicApiTests();

describe('GET /public/v1/tools/search', () => {
  beforeEach(async () => {
    // Create some test tools
    await state.con.getRepository(DatasetTool).save([
      { title: 'TypeScript', faviconUrl: 'https://example.com/ts.png' },
      { title: 'JavaScript', faviconUrl: 'https://example.com/js.png' },
      { title: 'Python', faviconUrl: 'https://example.com/py.png' },
    ]);
  });

  it('should search for tools', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/tools/search')
      .query({ query: 'Type' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
    });
  });

  it('should require query parameter', async () => {
    const token = await createTokenForUser(state.con, '5');

    await request(state.app.server)
      .get('/public/v1/tools/search')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('should return empty array for no matches', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/tools/search')
      .query({ query: 'xyznonexistent123' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(0);
  });
});
