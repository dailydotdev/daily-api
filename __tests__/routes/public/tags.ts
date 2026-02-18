import request from 'supertest';
import { setupPublicApiTests, createTokenForUser } from './helpers';
import { Keyword } from '../../../src/entity/Keyword';

const state = setupPublicApiTests();

describe('GET /public/v1/tags', () => {
  beforeEach(async () => {
    await state.con.getRepository(Keyword).save([
      { value: 'eng688tagalpha', status: 'allow' },
      { value: 'eng688tagbeta', status: 'allow' },
    ]);
  });

  it('should return all tags for authenticated user', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/tags')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toEqual(
      expect.arrayContaining([
        { name: 'eng688tagalpha' },
        { name: 'eng688tagbeta' },
      ]),
    );
  });

  it('should return 401 without auth header', async () => {
    await request(state.app.server).get('/public/v1/tags').expect(401);
  });

  it('should return data array without pagination', async () => {
    const token = await createTokenForUser(state.con, '5');

    const { body } = await request(state.app.server)
      .get('/public/v1/tags')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(body).toMatchObject({
      data: expect.any(Array),
    });
    expect(body.pagination).toBeUndefined();
  });
});
