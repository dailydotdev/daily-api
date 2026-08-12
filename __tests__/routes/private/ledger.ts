import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import appFunc from '../../../src';
import createOrGetConnection from '../../../src/db';
import { saveFixtures } from '../../helpers';
import { sourcesFixture } from '../../fixture/source';
import { postsFixture, videoPostsFixture } from '../../fixture/post';
import { Source } from '../../../src/entity/Source';
import { ArticlePost } from '../../../src/entity/posts/ArticlePost';
import { YouTubePost } from '../../../src/entity/posts/YouTubePost';
import {
  Claim,
  ClaimChangeType,
  ClaimStatus,
} from '../../../src/entity/claim/Claim';
import {
  ClaimCandidate,
  ClaimCandidateStatus,
  ClaimDirectness,
} from '../../../src/entity/claim/ClaimCandidate';
import {
  ClaimEvidence,
  ClaimEvidenceSourceClass,
} from '../../../src/entity/claim/ClaimEvidence';
import {
  LedgerEntity,
  LedgerEntityKind,
} from '../../../src/entity/claim/LedgerEntity';

let app: FastifyInstance;
let con: DataSource;

const serviceHeaders = {
  authorization: `Service ${process.env.ACCESS_SECRET}`,
  'content-type': 'application/json',
};

const parentEntityId = '11111111-1111-4111-8111-111111111111';
const childEntityId = '11111111-1111-4111-8111-111111111112';
const candidateId = '22222222-2222-4222-8222-222222222221';
const claimId = '33333333-3333-4333-8333-333333333331';

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await saveFixtures(con, YouTubePost, videoPostsFixture);
});

const seedCandidate = (postId = postsFixture[0].id as string) =>
  con.getRepository(ClaimCandidate).save({
    id: candidateId,
    postId,
    rawEntityName: 'Next.js',
    entityAliases: ['nextjs'],
    entityKind: LedgerEntityKind.Package,
    changeType: ClaimChangeType.Deprecation,
    statement: 'Next.js deprecates the pages router.',
    versionScope: '>= 16',
    effectiveDate: '2026-04-01',
    directness: ClaimDirectness.Announcement,
    evidence: 'the pages router is deprecated',
  });

const seedHierarchy = async () => {
  await con.getRepository(LedgerEntity).save([
    {
      id: parentEntityId,
      canonicalName: 'Next.js',
      kind: LedgerEntityKind.Package,
      aliases: ['nextjs'],
    },
    {
      id: childEntityId,
      canonicalName: 'Next.js App Router',
      kind: LedgerEntityKind.Package,
      aliases: [],
      parentId: parentEntityId,
    },
  ]);
  await con.getRepository(Claim).save({
    id: claimId,
    entityId: childEntityId,
    changeType: ClaimChangeType.Breaking,
    statement: 'App Router changes caching defaults.',
    effectiveDate: '2026-05-02',
    status: ClaimStatus.Corroborated,
  });
  await con.getRepository(ClaimEvidence).save({
    claimId,
    postId: postsFixture[0].id,
    url: 'https://nextjs.org/blog/caching',
    sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
  });
};

describe('private ledger routes', () => {
  it('should return not found when not authorized', () =>
    request(app.server).get('/p/ledger/candidates').expect(404));

  it('should reject a canonical name that collides case-insensitively', async () => {
    await seedHierarchy();

    const { body } = await request(app.server)
      .post('/p/ledger/entities')
      .set(serviceHeaders)
      .send({ canonicalName: 'next.JS', kind: LedgerEntityKind.Package })
      .expect(409);

    expect(body.error).toContain('already in use');
  });

  it('should reject an alias that collides with another entity name', async () => {
    await seedHierarchy();
    const { body: created } = await request(app.server)
      .post('/p/ledger/entities')
      .set(serviceHeaders)
      .send({ canonicalName: 'Remix', kind: LedgerEntityKind.Package })
      .expect(201);

    await request(app.server)
      .post('/p/ledger/entities/alias')
      .set(serviceHeaders)
      .send({ entityId: created.id, alias: 'NextJS' })
      .expect(409);

    const entity = await con
      .getRepository(LedgerEntity)
      .findOneBy({ id: created.id });
    expect(entity?.aliases).toEqual([]);
  });

  it('should list pending candidates', async () => {
    await seedCandidate();

    const { body } = await request(app.server)
      .get('/p/ledger/candidates')
      .query({ status: ClaimCandidateStatus.Pending, entityName: 'next.js' })
      .set(serviceHeaders)
      .expect(200);

    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].id).toEqual(candidateId);
  });

  it('should create a claim with evidence when merging a candidate', async () => {
    await seedCandidate();

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge' })
      .expect(200);

    const claim = await con
      .getRepository(Claim)
      .findOneBy({ id: body.claimId });
    const entity = await con
      .getRepository(LedgerEntity)
      .findOneBy({ id: claim?.entityId });
    const evidence = await con
      .getRepository(ClaimEvidence)
      .findOneBy({ claimId: body.claimId });
    const candidate = await con
      .getRepository(ClaimCandidate)
      .findOneBy({ id: candidateId });

    expect(claim).toMatchObject({
      changeType: ClaimChangeType.Deprecation,
      statement: 'Next.js deprecates the pages router.',
      effectiveDate: '2026-04-01',
      status: ClaimStatus.Candidate,
    });
    expect(entity).toMatchObject({
      canonicalName: 'Next.js',
      aliases: ['nextjs'],
    });
    expect(evidence).toMatchObject({
      postId: postsFixture[0].id,
      url: postsFixture[0].url,
      sourceClass: ClaimEvidenceSourceClass.Community,
    });
    expect(candidate).toMatchObject({
      status: ClaimCandidateStatus.Merged,
      claimId: body.claimId,
    });
  });

  it('should take evidence from a non-article post', async () => {
    await seedCandidate(videoPostsFixture[0].id as string);

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge' })
      .expect(200);

    expect(
      await con
        .getRepository(ClaimEvidence)
        .findOneBy({ claimId: body.claimId }),
    ).toMatchObject({
      postId: videoPostsFixture[0].id,
      url: videoPostsFixture[0].url,
    });
  });

  it('should attach evidence to an existing claim when merging with a claimId', async () => {
    await seedHierarchy();
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', claimId })
      .expect(200);

    expect(await con.getRepository(Claim).count()).toEqual(1);
    expect(await con.getRepository(ClaimEvidence).count()).toEqual(2);
  });

  it('should leave no claim behind when denying a candidate', async () => {
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'deny' })
      .expect(200);

    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({ status: ClaimCandidateStatus.Denied, claimId: null });
    expect(await con.getRepository(Claim).count()).toEqual(0);
  });

  it('should update a claim status', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/status')
      .set(serviceHeaders)
      .send({ claimId, status: ClaimStatus.Verified })
      .expect(200);

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ status: ClaimStatus.Verified });
  });

  it('should serve claims of child entities when queried by a parent alias', async () => {
    await seedHierarchy();

    const { body } = await request(app.server)
      .get('/p/ledger/claims')
      .query({ entities: 'nextjs', since: '2026-01-01' })
      .set(serviceHeaders)
      .expect(200);

    expect(body.claims).toHaveLength(1);
    expect(body.claims[0]).toMatchObject({
      id: claimId,
      entityName: 'Next.js App Router',
      changeType: ClaimChangeType.Breaking,
      status: ClaimStatus.Corroborated,
    });
    expect(body.claims[0].evidence).toEqual([
      expect.objectContaining({
        url: 'https://nextjs.org/blog/caching',
        sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
      }),
    ]);
  });

  it('should exclude claims below the requested minimum status', async () => {
    await seedHierarchy();

    const { body } = await request(app.server)
      .get('/p/ledger/claims')
      .query({
        entities: 'nextjs',
        since: '2026-01-01',
        minStatus: ClaimStatus.Verified,
      })
      .set(serviceHeaders)
      .expect(200);

    expect(body.claims).toEqual([]);
  });
});
