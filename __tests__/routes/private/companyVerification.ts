import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import appFunc from '../../../src';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { User } from '../../../src/entity/user/User';
import { Company } from '../../../src/entity/Company';
import { UserCompany } from '../../../src/entity/UserCompany';
import * as cloudinary from '../../../src/common/cloudinary';

let app: FastifyInstance;
let con: DataSource;

const serviceHeaders = {
  authorization: `Service ${process.env.ACCESS_SECRET}`,
  'content-type': 'application/json',
};

const hostedImage = 'https://media.daily.dev/company-logo';

const userId = '99999999-9999-4999-8999-999999999991';
const secondUserId = '99999999-9999-4999-8999-999999999992';
const thirdUserId = '99999999-9999-4999-8999-999999999993';
const otherUserId = '99999999-9999-4999-8999-999999999994';
const existingCompanyId = 'existingco';

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.spyOn(cloudinary, 'uploadLogoFromUrl').mockResolvedValue(hostedImage);
  await saveFixtures(con, User, [
    { id: userId, reputation: 10 },
    { id: secondUserId, reputation: 10 },
    { id: thirdUserId, reputation: 10 },
    { id: otherUserId, reputation: 10 },
  ]);
});

afterAll(() => app.close());

const seedUserCompanies = async () => {
  await saveFixtures(con, Company, [
    {
      id: existingCompanyId,
      name: 'Existing Co',
      image: hostedImage,
      domains: ['example.com'],
    },
  ]);
  await con.getRepository(UserCompany).save([
    {
      userId,
      email: 'alice@example.com',
      code: '111111',
      verified: true,
    },
    {
      userId: secondUserId,
      email: 'Bob@Example.com',
      code: '222222',
      verified: true,
    },
    {
      userId: thirdUserId,
      email: 'carol@other.com',
      code: '333333',
      verified: true,
    },
  ]);
};

describe('private company verification routes', () => {
  describe('service guard', () => {
    it('returns 404 for POST /companies without service auth', () =>
      request(app.server)
        .post('/p/company-verification/companies')
        .send({
          name: 'Acme',
          domains: ['acme.com'],
          image: 'https://x.com/a.png',
        })
        .expect(404));

    it('returns 404 for POST /link-domain without service auth', () =>
      request(app.server)
        .post('/p/company-verification/link-domain')
        .send({ companyId: existingCompanyId, domain: 'example.com' })
        .expect(404));

    it('returns 404 for POST /reject-domain without service auth', () =>
      request(app.server)
        .post('/p/company-verification/reject-domain')
        .send({ domain: 'example.com' })
        .expect(404));
  });

  describe('POST /companies', () => {
    it('creates a company with a generated id and hosted image', async () => {
      const uploadLogoFromUrl = jest.spyOn(cloudinary, 'uploadLogoFromUrl');
      const { body } = await request(app.server)
        .post('/p/company-verification/companies')
        .set(serviceHeaders)
        .send({
          name: 'Acme',
          domains: [' Acme.com ', 'ACME.IO'],
          image: 'https://cdn.example.com/logo.png',
        })
        .expect(201);

      expect(body.id).toEqual(expect.any(String));
      expect(uploadLogoFromUrl).toHaveBeenCalledWith(
        body.id,
        'https://cdn.example.com/logo.png',
      );

      const company = await con
        .getRepository(Company)
        .findOneByOrFail({ id: body.id });
      expect(company).toMatchObject({
        name: 'Acme',
        image: hostedImage,
        domains: ['acme.com', 'acme.io'],
      });
    });

    it('respects a provided id', async () => {
      const { body } = await request(app.server)
        .post('/p/company-verification/companies')
        .set(serviceHeaders)
        .send({
          id: 'mycompany',
          name: 'Acme',
          domains: ['acme.com'],
          image: 'https://cdn.example.com/logo.png',
        })
        .expect(201);

      expect(body.id).toEqual('mycompany');
    });

    it('returns 409 when a provided id already exists', async () => {
      await seedUserCompanies();

      await request(app.server)
        .post('/p/company-verification/companies')
        .set(serviceHeaders)
        .send({
          id: existingCompanyId,
          name: 'Acme',
          domains: ['acme.com'],
          image: 'https://cdn.example.com/logo.png',
        })
        .expect(409);

      const company = await con
        .getRepository(Company)
        .findOneByOrFail({ id: existingCompanyId });
      expect(company.name).toEqual('Existing Co');
    });

    it('rejects missing required fields', async () => {
      await request(app.server)
        .post('/p/company-verification/companies')
        .set(serviceHeaders)
        .send({ domains: ['acme.com'], image: 'https://cdn.example.com/a.png' })
        .expect(400);
      await request(app.server)
        .post('/p/company-verification/companies')
        .set(serviceHeaders)
        .send({ name: 'Acme', image: 'https://cdn.example.com/a.png' })
        .expect(400);
      await request(app.server)
        .post('/p/company-verification/companies')
        .set(serviceHeaders)
        .send({ name: 'Acme', domains: ['acme.com'] })
        .expect(400);
    });
  });

  describe('POST /link-domain', () => {
    it('links all matching rows regardless of email casing', async () => {
      await seedUserCompanies();

      const { body } = await request(app.server)
        .post('/p/company-verification/link-domain')
        .set(serviceHeaders)
        .send({ companyId: existingCompanyId, domain: 'Example.com' })
        .expect(200);

      expect(body).toEqual({ affected: 2 });

      const linked = await con
        .getRepository(UserCompany)
        .findBy({ companyId: existingCompanyId });
      expect(linked.map((uc) => uc.email).sort()).toEqual([
        'Bob@Example.com',
        'alice@example.com',
      ]);

      const other = await con
        .getRepository(UserCompany)
        .findOneByOrFail({ email: 'carol@other.com' });
      expect(other.companyId).toBeNull();
    });

    it('returns 404 when the company does not exist', async () => {
      await seedUserCompanies();

      await request(app.server)
        .post('/p/company-verification/link-domain')
        .set(serviceHeaders)
        .send({ companyId: 'missing', domain: 'example.com' })
        .expect(404);
    });
  });

  describe('POST /reject-domain', () => {
    it('rejects matching rows and is idempotent', async () => {
      await seedUserCompanies();

      const first = await request(app.server)
        .post('/p/company-verification/reject-domain')
        .set(serviceHeaders)
        .send({ domain: 'example.com' })
        .expect(200);
      expect(first.body).toEqual({ affected: 2 });

      const rejected = await con.getRepository(UserCompany).find();
      const byEmail = new Map(rejected.map((uc) => [uc.email, uc.flags]));
      expect(byEmail.get('alice@example.com')).toEqual({ rejected: true });
      expect(byEmail.get('Bob@Example.com')).toEqual({ rejected: true });
      expect(byEmail.get('carol@other.com')).toEqual({});

      const second = await request(app.server)
        .post('/p/company-verification/reject-domain')
        .set(serviceHeaders)
        .send({ domain: 'example.com' })
        .expect(200);
      expect(second.body).toEqual({ affected: 2 });
    });
  });
});
