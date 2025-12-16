import appFunc from '../../src';
import { FastifyInstance } from 'fastify';
import { authorizeRequest, saveFixtures } from '../helpers';
import { User } from '../../src/entity';
import {
  UserIntegrationGif,
  UserIntegrationType,
} from '../../src/entity/UserIntegration';
import { usersFixture } from '../fixture';
import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import request from 'supertest';
import { tenorClient } from '../../src/integrations/tenor';

let app: FastifyInstance;
let con: DataSource;

jest.mock('../../src/integrations/tenor', () => ({
  tenorClient: {
    search: jest.fn(),
  },
}));

const mockTenorSearch = tenorClient.search as jest.Mock;

beforeAll(async () => {
  con = await createOrGetConnection();
  app = await appFunc();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.resetAllMocks();
  await saveFixtures(con, User, usersFixture);
});

describe('GET /gifs', () => {
  it('should return empty gifs when no query is provided', async () => {
    mockTenorSearch.mockResolvedValue({ gifs: [], next: undefined });

    const { body } = await request(app.server).get('/gifs').expect(200);

    expect(body).toEqual({ gifs: [], next: undefined });
    expect(mockTenorSearch).toHaveBeenCalledWith({
      q: '',
      limit: 10,
      pos: undefined,
    });
  });

  it('should return gifs from tenor search', async () => {
    const mockGifs = [
      {
        id: 'gif1',
        url: 'https://tenor.com/gif1.gif',
        preview: 'https://tenor.com/gif1-preview.gif',
        title: 'Funny cat',
      },
      {
        id: 'gif2',
        url: 'https://tenor.com/gif2.gif',
        preview: 'https://tenor.com/gif2-preview.gif',
        title: 'Dancing dog',
      },
    ];

    mockTenorSearch.mockResolvedValue({
      gifs: mockGifs,
      next: 'next-page-token',
    });

    const { body } = await request(app.server)
      .get('/gifs')
      .query({ q: 'funny', limit: '20' })
      .expect(200);

    expect(body).toEqual({
      gifs: mockGifs,
      next: 'next-page-token',
    });
    expect(mockTenorSearch).toHaveBeenCalledWith({
      q: 'funny',
      limit: 20,
      pos: undefined,
    });
  });

  it('should pass pagination position to tenor search', async () => {
    mockTenorSearch.mockResolvedValue({ gifs: [], next: undefined });

    await request(app.server)
      .get('/gifs')
      .query({ q: 'test', pos: 'page-token' })
      .expect(200);

    expect(mockTenorSearch).toHaveBeenCalledWith({
      q: 'test',
      limit: 10,
      pos: 'page-token',
    });
  });

  it('should return empty gifs when tenor search fails', async () => {
    mockTenorSearch.mockRejectedValue(new Error('Tenor API error'));

    const { body } = await request(app.server)
      .get('/gifs')
      .query({ q: 'test' })
      .expect(200);

    expect(body).toEqual({ gifs: [], next: undefined });
  });

  it('should preserve pagination position when rate limited', async () => {
    // When rate limited, the client returns empty gifs but preserves the position
    // so the user can retry the same page
    mockTenorSearch.mockResolvedValue({ gifs: [], next: 'page-2' });

    const { body } = await request(app.server)
      .get('/gifs')
      .query({ q: 'test', pos: 'page-2' })
      .expect(200);

    expect(body).toEqual({ gifs: [], next: 'page-2' });
  });
});

describe('POST /gifs/favorite', () => {
  const gifToFavorite = {
    id: 'gif1',
    url: 'https://tenor.com/gif1.gif',
    preview: 'https://tenor.com/gif1-preview.gif',
    title: 'Funny cat',
  };

  it('should add a gif to favorites for authenticated user', async () => {
    const { body } = await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gifToFavorite),
      '1',
    ).expect(200);

    expect(body.gifs).toHaveLength(1);
    expect(body.gifs[0]).toMatchObject(gifToFavorite);

    const saved = await con.getRepository(UserIntegrationGif).findOne({
      where: { userId: '1', type: UserIntegrationType.Gif },
    });
    expect(saved?.meta.favorites).toHaveLength(1);
    expect(saved?.meta.favorites[0]).toMatchObject(gifToFavorite);
  });

  it('should add multiple gifs to favorites', async () => {
    const gif2 = {
      id: 'gif2',
      url: 'https://tenor.com/gif2.gif',
      preview: 'https://tenor.com/gif2-preview.gif',
      title: 'Dancing dog',
    };

    await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gifToFavorite),
      '1',
    ).expect(200);

    const { body } = await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gif2),
      '1',
    ).expect(200);

    expect(body.gifs).toHaveLength(2);
    expect(body.gifs).toEqual(
      expect.arrayContaining([
        expect.objectContaining(gifToFavorite),
        expect.objectContaining(gif2),
      ]),
    );
  });

  it('should remove a gif from favorites when already favorited (toggle)', async () => {
    await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gifToFavorite),
      '1',
    ).expect(200);

    const { body } = await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gifToFavorite),
      '1',
    ).expect(200);

    expect(body.gifs).toHaveLength(0);

    const saved = await con.getRepository(UserIntegrationGif).findOne({
      where: { userId: '1', type: UserIntegrationType.Gif },
    });
    expect(saved?.meta.favorites).toHaveLength(0);
  });

  it('should keep favorites separate per user', async () => {
    await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gifToFavorite),
      '1',
    ).expect(200);

    const gif2 = {
      id: 'gif2',
      url: 'https://tenor.com/gif2.gif',
      preview: 'https://tenor.com/gif2-preview.gif',
      title: 'Dancing dog',
    };

    await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gif2),
      '2',
    ).expect(200);

    const user1Favorites = await con.getRepository(UserIntegrationGif).findOne({
      where: { userId: '1', type: UserIntegrationType.Gif },
    });
    const user2Favorites = await con.getRepository(UserIntegrationGif).findOne({
      where: { userId: '2', type: UserIntegrationType.Gif },
    });

    expect(user1Favorites?.meta.favorites).toHaveLength(1);
    expect(user1Favorites?.meta.favorites[0].id).toBe('gif1');
    expect(user2Favorites?.meta.favorites).toHaveLength(1);
    expect(user2Favorites?.meta.favorites[0].id).toBe('gif2');
  });

  it('should return empty gifs on database error', async () => {
    const repo = con.getRepository(UserIntegrationGif);
    jest.spyOn(repo, 'findOne').mockRejectedValueOnce(new Error('DB error'));

    const { body } = await authorizeRequest(
      request(app.server).post('/gifs/favorite').send(gifToFavorite),
      '1',
    ).expect(200);

    expect(body).toEqual({ gifs: [] });
  });
});

describe('GET /gifs/favorites', () => {
  it('should return empty array when user has no favorites', async () => {
    const { body } = await authorizeRequest(
      request(app.server).get('/gifs/favorites'),
      '1',
    ).expect(200);

    expect(body).toEqual({ gifs: [] });
  });

  it('should return user favorites', async () => {
    const gif1 = {
      id: 'gif1',
      url: 'https://tenor.com/gif1.gif',
      preview: 'https://tenor.com/gif1-preview.gif',
      title: 'Funny cat',
    };
    const gif2 = {
      id: 'gif2',
      url: 'https://tenor.com/gif2.gif',
      preview: 'https://tenor.com/gif2-preview.gif',
      title: 'Dancing dog',
    };

    await con.getRepository(UserIntegrationGif).insert({
      userId: '1',
      type: UserIntegrationType.Gif,
      meta: { favorites: [gif1, gif2] },
    });

    const { body } = await authorizeRequest(
      request(app.server).get('/gifs/favorites'),
      '1',
    ).expect(200);

    expect(body.gifs).toHaveLength(2);
    expect(body.gifs).toEqual(
      expect.arrayContaining([
        expect.objectContaining(gif1),
        expect.objectContaining(gif2),
      ]),
    );
  });

  it('should only return favorites for the authenticated user', async () => {
    const gif1 = {
      id: 'gif1',
      url: 'https://tenor.com/gif1.gif',
      preview: 'https://tenor.com/gif1-preview.gif',
      title: 'Funny cat',
    };
    const gif2 = {
      id: 'gif2',
      url: 'https://tenor.com/gif2.gif',
      preview: 'https://tenor.com/gif2-preview.gif',
      title: 'Dancing dog',
    };

    await con.getRepository(UserIntegrationGif).insert([
      {
        userId: '1',
        type: UserIntegrationType.Gif,
        meta: { favorites: [gif1] },
      },
      {
        userId: '2',
        type: UserIntegrationType.Gif,
        meta: { favorites: [gif2] },
      },
    ]);

    const { body } = await authorizeRequest(
      request(app.server).get('/gifs/favorites'),
      '1',
    ).expect(200);

    expect(body.gifs).toHaveLength(1);
    expect(body.gifs[0].id).toBe('gif1');
  });

  it('should return empty gifs on database error', async () => {
    const repo = con.getRepository(UserIntegrationGif);
    jest.spyOn(repo, 'find').mockRejectedValueOnce(new Error('DB error'));

    const { body } = await authorizeRequest(
      request(app.server).get('/gifs/favorites'),
      '1',
    ).expect(200);

    expect(body).toEqual({ gifs: [] });
  });
});
