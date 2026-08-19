import type { FastifyInstance } from 'fastify';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { In } from 'typeorm';
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
  ClaimDateSource,
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
import * as claimLedger from '../../../src/common/claimLedger';

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
const duplicateClaimId = '33333333-3333-4333-8333-333333333332';

beforeAll(async () => {
  app = await appFunc();
  con = await createOrGetConnection();
  return app.ready();
});

afterAll(() => app.close());

beforeEach(async () => {
  jest.restoreAllMocks();
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

// The same fact filed twice by two reviewers, the second copy citing one url
// the first already has and one it does not.
const seedDuplicateClaim = async () => {
  await con.getRepository(Claim).save({
    id: duplicateClaimId,
    entityId: childEntityId,
    changeType: ClaimChangeType.Breaking,
    statement: 'App Router changed its caching defaults.',
    effectiveDate: '2026-05-02',
  });
  await con.getRepository(ClaimEvidence).save([
    {
      claimId: duplicateClaimId,
      postId: postsFixture[0].id,
      url: 'https://nextjs.org/blog/caching',
      sourceClass: ClaimEvidenceSourceClass.Community,
    },
    {
      claimId: duplicateClaimId,
      postId: postsFixture[1].id,
      url: 'https://vercel.com/changelog/app-router-caching',
      sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
    },
  ]);
};

const mergeClaims = (body: Record<string, unknown>) =>
  request(app.server)
    .post('/p/ledger/claims/merge')
    .set(serviceHeaders)
    .send(body);

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

  it('should keep an alias another writer added while the request was in flight', async () => {
    await seedHierarchy();
    // The competing write lands where a concurrent request would: after the
    // route has read the entity and before it writes the alias back.
    jest
      .spyOn(claimLedger, 'assertLedgerNamesAvailable')
      .mockImplementationOnce(async () => {
        await con
          .getRepository(LedgerEntity)
          .update(childEntityId, { aliases: ['app dir'] });
      });

    const { body } = await request(app.server)
      .post('/p/ledger/entities/alias')
      .set(serviceHeaders)
      .send({ entityId: childEntityId, alias: 'app router' })
      .expect(200);

    expect(body.aliases).toEqual(['app dir', 'app router']);
  });

  it('should remove an alias and leave one it does not carry alone', async () => {
    await seedHierarchy();
    const removeAlias = (alias: string) =>
      request(app.server)
        .post('/p/ledger/entities/alias/remove')
        .set(serviceHeaders)
        .send({ entityId: parentEntityId, alias })
        .expect(200);

    const { body: removed } = await removeAlias('NextJS');
    const { body: absent } = await removeAlias('svelte');

    expect(removed.aliases).toEqual([]);
    expect(absent.aliases).toEqual([]);
  });

  it('should reject removing an alias from an entity that does not exist', () =>
    request(app.server)
      .post('/p/ledger/entities/alias/remove')
      .set(serviceHeaders)
      .send({ entityId: parentEntityId, alias: 'nextjs' })
      .expect(404));

  it('should absorb a duplicate entity into the entity that keeps it', async () => {
    await seedHierarchy();
    const duplicateEntityId = '11111111-1111-4111-8111-111111111113';
    const grandChildId = '11111111-1111-4111-8111-111111111114';
    await con.getRepository(LedgerEntity).save([
      {
        id: duplicateEntityId,
        canonicalName: 'App Router',
        kind: LedgerEntityKind.Package,
        aliases: ['app-router', 'nextjs'],
      },
      {
        id: grandChildId,
        canonicalName: 'App Router Caching',
        kind: LedgerEntityKind.Package,
        aliases: [],
        parentId: duplicateEntityId,
      },
    ]);
    const duplicateClaim = await con.getRepository(Claim).save({
      entityId: duplicateEntityId,
      changeType: ClaimChangeType.Breaking,
      statement: 'App Router changed its caching defaults.',
    });

    const { body } = await request(app.server)
      .post('/p/ledger/entities/merge')
      .set(serviceHeaders)
      .send({ fromEntityId: duplicateEntityId, intoEntityId: childEntityId })
      .expect(200);

    // The merged entity comes back from inside the transaction, so verifying it
    // never has to race the replica.
    expect(body).toEqual({
      id: childEntityId,
      canonicalName: 'Next.js App Router',
      aliases: ['App Router', 'app-router'],
      parentId: parentEntityId,
    });
    expect(
      await con.getRepository(Claim).findOneBy({ id: duplicateClaim.id }),
    ).toMatchObject({ entityId: childEntityId });
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: grandChildId }),
    ).toMatchObject({ parentId: childEntityId });
    // "nextjs" already answers for the parent entity, so it stays behind.
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({ aliases: ['App Router', 'app-router'] });
    expect(
      await con
        .getRepository(LedgerEntity)
        .findOneBy({ id: duplicateEntityId }),
    ).toBeNull();
  });

  it('should reject merging an entity into itself', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/entities/merge')
      .set(serviceHeaders)
      .send({ fromEntityId: childEntityId, intoEntityId: childEntityId })
      .expect(400);
  });

  it('should reject merging an entity that does not exist', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/entities/merge')
      .set(serviceHeaders)
      .send({
        fromEntityId: '11111111-1111-4111-8111-111111111119',
        intoEntityId: childEntityId,
      })
      .expect(404);
  });

  it('should delete an entity nothing stands on', async () => {
    await seedHierarchy();
    const strayEntityId = '11111111-1111-4111-8111-111111111115';
    await con.getRepository(LedgerEntity).save({
      id: strayEntityId,
      canonicalName: 'Nextjs Pages Router Probe',
      kind: LedgerEntityKind.Other,
      aliases: [],
    });

    await request(app.server)
      .post('/p/ledger/entities/delete')
      .set(serviceHeaders)
      .send({ entityId: strayEntityId })
      .expect(200);

    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: strayEntityId }),
    ).toBeNull();
  });

  it('should refuse to delete an entity claims still reference', async () => {
    await seedHierarchy();

    const { body } = await request(app.server)
      .post('/p/ledger/entities/delete')
      .set(serviceHeaders)
      .send({ entityId: childEntityId })
      .expect(400);

    expect(body.error).toContain('referenced by claims');
    expect(await con.getRepository(Claim).count()).toEqual(1);
  });

  it('should refuse to delete an entity that still has children', async () => {
    await seedHierarchy();
    await con.getRepository(Claim).delete(claimId);

    const { body } = await request(app.server)
      .post('/p/ledger/entities/delete')
      .set(serviceHeaders)
      .send({ entityId: parentEntityId })
      .expect(400);

    expect(body.error).toContain('child entities');
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: parentEntityId }),
    ).not.toBeNull();
  });

  it('should reject deleting an entity that does not exist', () =>
    request(app.server)
      .post('/p/ledger/entities/delete')
      .set(serviceHeaders)
      .send({ entityId: parentEntityId })
      .expect(404));

  it('should look up entities by canonical name and by alias', async () => {
    await seedHierarchy();
    const lookup = (name: string) =>
      request(app.server)
        .get('/p/ledger/entities')
        .query({ name })
        .set(serviceHeaders)
        .expect(200);

    const { body: byAlias } = await lookup('NextJS');
    const { body: byCanonical } = await lookup('next.js app router');
    const { body: noMatch } = await lookup('Svelte');

    expect(byAlias.entities).toEqual([
      {
        id: parentEntityId,
        canonicalName: 'Next.js',
        kind: LedgerEntityKind.Package,
        aliases: ['nextjs'],
        parentId: null,
      },
    ]);
    expect(byCanonical.entities).toEqual([
      expect.objectContaining({
        id: childEntityId,
        canonicalName: 'Next.js App Router',
        parentId: parentEntityId,
      }),
    ]);
    expect(noMatch.entities).toEqual([]);
  });

  it('should update only the fields given and clear the ones sent as null', async () => {
    await seedHierarchy();
    const update = (body: Record<string, unknown>) =>
      request(app.server)
        .post('/p/ledger/entities/update')
        .set(serviceHeaders)
        .send({ entityId: childEntityId, ...body })
        .expect(200);

    await update({
      canonicalName: 'Next.js App Directory',
      keywordValue: 'app-router',
    });
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({
      canonicalName: 'Next.js App Directory',
      keywordValue: 'app-router',
      kind: LedgerEntityKind.Package,
      parentId: parentEntityId,
    });

    await update({ parentId: null });
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({
      canonicalName: 'Next.js App Directory',
      keywordValue: 'app-router',
      parentId: null,
    });
  });

  it('should reject an entity update carrying a field the route cannot apply', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/entities/update')
      .set(serviceHeaders)
      .send({ entityId: childEntityId, aliases: ['app router'] })
      .expect(400);

    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({ aliases: [] });
  });

  it('should reject a rename that collides with another entity name', async () => {
    await seedHierarchy();

    const { body } = await request(app.server)
      .post('/p/ledger/entities/update')
      .set(serviceHeaders)
      .send({ entityId: childEntityId, canonicalName: 'NEXTJS' })
      .expect(409);

    expect(body.error).toContain('already in use');
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({ canonicalName: 'Next.js App Router' });
  });

  it('should reject a parent that matches no ledger entity', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/entities/update')
      .set(serviceHeaders)
      .send({
        entityId: childEntityId,
        parentId: '11111111-1111-4111-8111-111111111119',
      })
      .expect(404);

    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({ parentId: parentEntityId });
  });

  it('should reject an entity parented to itself', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/entities/update')
      .set(serviceHeaders)
      .send({ entityId: childEntityId, parentId: childEntityId })
      .expect(400);

    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: childEntityId }),
    ).toMatchObject({ parentId: parentEntityId });
  });

  it('should record reviewer evidence that has no post behind it', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://www.postgresql.org/docs/release/18.0/',
        sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
        publishedAt: '2026-05-08T10:00:00.000Z',
      })
      .expect(201);

    expect(
      await con.getRepository(ClaimEvidence).findOneBy({
        url: 'https://www.postgresql.org/docs/release/18.0',
      }),
    ).toMatchObject({
      claimId,
      postId: null,
      sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
      publishedAt: new Date('2026-05-08T10:00:00.000Z'),
    });
  });

  it('should reject evidence the claim already cites', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://nextjs.org/blog/caching',
        sourceClass: ClaimEvidenceSourceClass.Manual,
      })
      .expect(409);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(1);
  });

  it('should reject evidence the claim cites under a trailing slash variant', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://nextjs.org/blog/caching/',
        sourceClass: ClaimEvidenceSourceClass.Manual,
      })
      .expect(409);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(1);
  });

  it('should normalize the evidence url a reviewer supplies when merging a candidate', async () => {
    await seedCandidate();

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        url: 'https://forgejo.org/2026-03-monthly-report/',
      })
      .expect(200);

    expect(
      await con.getRepository(ClaimEvidence).findBy({ claimId: body.claimId }),
    ).toMatchObject([{ url: 'https://forgejo.org/2026-03-monthly-report' }]);
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

  it('should page candidates sharing a timestamp without skipping or repeating rows', async () => {
    const createdAt = new Date('2026-05-01T10:00:00.000Z');
    await con.getRepository(ClaimCandidate).save(
      Array.from({ length: 6 }, (_, index) => ({
        createdAt,
        postId: postsFixture[0].id as string,
        rawEntityName: 'Next.js',
        entityAliases: [],
        entityKind: LedgerEntityKind.Package,
        changeType: ClaimChangeType.Release,
        statement: `Next.js ships change ${index}.`,
        directness: ClaimDirectness.Announcement,
        evidence: 'the release notes',
      })),
    );

    const pages = await Promise.all(
      [0, 2, 4].map((offset) =>
        request(app.server)
          .get('/p/ledger/candidates')
          .query({ limit: 2, offset })
          .set(serviceHeaders)
          .expect(200),
      ),
    );
    const ids: string[] = pages.flatMap(({ body }) =>
      body.candidates.map(({ id }: { id: string }) => id),
    );

    expect(new Set(ids).size).toEqual(6);
    expect(ids).toEqual([...ids].sort().reverse());
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

  it('should apply reviewer overrides to the created claim and keep the candidate intact', async () => {
    await seedCandidate();

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        changeType: ClaimChangeType.Gotcha,
        statement: 'Next.js 16 marks the pages router as deprecated.',
        versionScope: null,
        sunsetDate: '2026-10-01',
      })
      .expect(200);

    expect(
      await con.getRepository(Claim).findOneBy({ id: body.claimId }),
    ).toMatchObject({
      changeType: ClaimChangeType.Gotcha,
      statement: 'Next.js 16 marks the pages router as deprecated.',
      versionScope: null,
      effectiveDate: '2026-04-01',
      sunsetDate: '2026-10-01',
    });
    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({
      status: ClaimCandidateStatus.Merged,
      claimId: body.claimId,
      changeType: ClaimChangeType.Deprecation,
      statement: 'Next.js deprecates the pages router.',
      versionScope: '>= 16',
      sunsetDate: null,
    });
  });

  it('should reject overrides when merging into an existing claim', async () => {
    await seedHierarchy();
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        claimId,
        changeType: ClaimChangeType.Gotcha,
      })
      .expect(400);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(1);
  });

  it('should reject an override with an unknown change type', async () => {
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', changeType: 'rewrite' })
      .expect(400);

    expect(await con.getRepository(Claim).count()).toEqual(0);
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

  it('should attach the claim to the entity given as an override', async () => {
    await seedHierarchy();
    await seedCandidate();

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', entityId: childEntityId })
      .expect(200);

    expect(
      await con.getRepository(Claim).findOneBy({ id: body.claimId }),
    ).toMatchObject({ entityId: childEntityId });
    expect(await con.getRepository(LedgerEntity).count()).toEqual(2);
  });

  it('should reject an entity override when merging into an existing claim', async () => {
    await seedHierarchy();
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', claimId, entityId: parentEntityId })
      .expect(400);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(1);
  });

  it('should reject an entity override that matches no ledger entity', async () => {
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', entityId: parentEntityId })
      .expect(404);

    expect(await con.getRepository(Claim).count()).toEqual(0);
  });

  it('should file another claim when splitting a merged candidate', async () => {
    await seedCandidate();
    const { body: first } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge' })
      .expect(200);

    const { body: second } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        split: true,
        statement: 'Next.js 16 removes the legacy image component.',
      })
      .expect(200);

    const claims = await con.getRepository(Claim).find();
    expect(second.claimId).not.toEqual(first.claimId);
    expect(claims).toHaveLength(2);
    expect(new Set(claims.map(({ entityId }) => entityId)).size).toEqual(1);
    expect(
      await con.getRepository(ClaimEvidence).findOneBy({
        claimId: second.claimId,
      }),
    ).toMatchObject({ postId: postsFixture[0].id, url: postsFixture[0].url });
    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({
      status: ClaimCandidateStatus.Merged,
      claimId: first.claimId,
    });
  });

  it('should reject re-resolving a merged candidate that carries no split', async () => {
    await seedHierarchy();
    await seedCandidate();
    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge' })
      .expect(200);

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        statement: 'Next.js 16 removes the legacy image component.',
      })
      .expect(409);

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', claimId })
      .expect(409);

    expect(await con.getRepository(Claim).count()).toEqual(2);
    expect(await con.getRepository(ClaimEvidence).count()).toEqual(2);
  });

  it('should reject resolving a denied candidate', async () => {
    await seedCandidate();
    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'deny' })
      .expect(200);

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        split: true,
        statement: 'Next.js 16 removes the legacy image component.',
      })
      .expect(409);

    expect(await con.getRepository(Claim).count()).toEqual(0);
  });

  it('should merge a denied candidate when the reviewer revives it', async () => {
    await seedCandidate();
    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'deny' })
      .expect(200);

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', revive: true })
      .expect(200);

    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({
      status: ClaimCandidateStatus.Merged,
      claimId: body.claimId,
    });
    expect(
      await con
        .getRepository(ClaimEvidence)
        .findOneBy({ claimId: body.claimId }),
    ).toMatchObject({ postId: postsFixture[0].id, url: postsFixture[0].url });
  });

  it('should not let a revive re-resolve a merged candidate', async () => {
    await seedCandidate();
    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge' })
      .expect(200);

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'merge', revive: true })
      .expect(409);

    expect(await con.getRepository(Claim).count()).toEqual(1);
  });

  it('should reject a revive that denies the candidate again', async () => {
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({ candidateId, action: 'deny', revive: true })
      .expect(400);

    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({ status: ClaimCandidateStatus.Pending });
  });

  it('should cite the post permalink as evidence when the post has no url', async () => {
    await seedCandidate();
    await con
      .getRepository(ArticlePost)
      .update(postsFixture[0].id as string, { url: null });
    const post = await con
      .getRepository(ArticlePost)
      .findOneBy({ id: postsFixture[0].id as string });

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
      postId: postsFixture[0].id,
      url: `${process.env.COMMENTS_PREFIX}/posts/${post?.slug}`,
    });
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

  it('should keep the reviewer rationale on a denied candidate', async () => {
    await seedCandidate();

    await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'deny',
        note: 'Rule 4: roadmap intent, nothing shipped.',
      })
      .expect(200);

    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({
      status: ClaimCandidateStatus.Denied,
      note: 'Rule 4: roadmap intent, nothing shipped.',
    });
  });

  it('should keep the reviewer rationale on a merged candidate', async () => {
    await seedCandidate();

    const { body } = await request(app.server)
      .post('/p/ledger/candidates/resolve')
      .set(serviceHeaders)
      .send({
        candidateId,
        action: 'merge',
        note: 'Rule 1: dated vendor announcement.',
      })
      .expect(200);

    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({
      status: ClaimCandidateStatus.Merged,
      claimId: body.claimId,
      note: 'Rule 1: dated vendor announcement.',
    });
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

  it('should demote a corroborated claim back to a candidate', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/status')
      .set(serviceHeaders)
      .send({ claimId, status: ClaimStatus.Candidate })
      .expect(200);

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ status: ClaimStatus.Candidate });
  });

  it('should amend only the claim fields given and clear the ones sent as null', async () => {
    await seedHierarchy();
    const update = (body: Record<string, unknown>) =>
      request(app.server)
        .post('/p/ledger/claims/update')
        .set(serviceHeaders)
        .send({ claimId, ...body })
        .expect(200);

    await update({
      statement: 'App Router changes caching defaults in 16.',
      versionScope: '>= 16',
    });
    await update({ effectiveDate: null });

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({
      statement: 'App Router changes caching defaults in 16.',
      versionScope: '>= 16',
      effectiveDate: null,
      changeType: ClaimChangeType.Breaking,
      status: ClaimStatus.Corroborated,
    });
  });

  it('should link a claim to the claim that supersedes it and unlink it again', async () => {
    await seedHierarchy();
    const reversal = await con.getRepository(Claim).save({
      entityId: childEntityId,
      changeType: ClaimChangeType.Breaking,
      statement: 'App Router caching defaults stay as they are for now.',
      effectiveDate: '2026-06-01',
    });
    const supersede = (supersededByClaimId: string | null) =>
      request(app.server)
        .post('/p/ledger/claims/update')
        .set(serviceHeaders)
        .send({ claimId, supersededByClaimId })
        .expect(200);

    await supersede(reversal.id);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ supersededByClaimId: reversal.id });

    await supersede(null);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ supersededByClaimId: null });
  });

  it('should reject a claim superseded by itself', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/update')
      .set(serviceHeaders)
      .send({ claimId, supersededByClaimId: claimId })
      .expect(400);

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ supersededByClaimId: null });
  });

  it('should absorb a duplicate claim into the claim that keeps it', async () => {
    await seedHierarchy();
    await seedDuplicateClaim();
    await seedCandidate();
    await con.getRepository(ClaimCandidate).update(candidateId, {
      status: ClaimCandidateStatus.Merged,
      claimId: duplicateClaimId,
    });
    const reversal = await con.getRepository(Claim).save({
      entityId: childEntityId,
      changeType: ClaimChangeType.Breaking,
      statement: 'App Router keeps its caching defaults after all.',
      supersededByClaimId: duplicateClaimId,
    });

    await mergeClaims({
      fromClaimId: duplicateClaimId,
      intoClaimId: claimId,
    }).expect(200);

    const kept = await con.getRepository(ClaimEvidence).findBy({ claimId });
    expect(kept.map(({ url }) => url).sort()).toEqual([
      'https://nextjs.org/blog/caching',
      'https://vercel.com/changelog/app-router-caching',
    ]);
    expect(
      await con
        .getRepository(ClaimEvidence)
        .countBy({ claimId: duplicateClaimId }),
    ).toEqual(0);
    expect(
      await con.getRepository(ClaimCandidate).findOneBy({ id: candidateId }),
    ).toMatchObject({ claimId });
    expect(
      await con.getRepository(Claim).findOneBy({ id: reversal.id }),
    ).toMatchObject({ supersededByClaimId: claimId });
    expect(
      await con.getRepository(Claim).findOneBy({ id: duplicateClaimId }),
    ).toMatchObject({
      status: ClaimStatus.Rejected,
      supersededByClaimId: claimId,
    });
  });

  it('should reject merging a claim into one it already supersedes', async () => {
    await seedHierarchy();
    await seedDuplicateClaim();
    await con
      .getRepository(Claim)
      .update(claimId, { supersededByClaimId: duplicateClaimId });

    await mergeClaims({
      fromClaimId: duplicateClaimId,
      intoClaimId: claimId,
    }).expect(400);

    expect(
      await con.getRepository(Claim).findOneBy({ id: duplicateClaimId }),
    ).toMatchObject({
      status: ClaimStatus.Candidate,
      supersededByClaimId: null,
    });
  });

  it('should reject merging a claim into itself', async () => {
    await seedHierarchy();

    await mergeClaims({ fromClaimId: claimId, intoClaimId: claimId }).expect(
      400,
    );

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ status: ClaimStatus.Corroborated });
  });

  it('should repoint a misfiled claim at another entity and leave its evidence alone', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/move')
      .set(serviceHeaders)
      .send({ claimId, entityId: parentEntityId })
      .expect(200);

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ entityId: parentEntityId });
    expect(await con.getRepository(ClaimEvidence).findBy({ claimId })).toEqual([
      expect.objectContaining({
        claimId,
        postId: postsFixture[0].id,
        url: 'https://nextjs.org/blog/caching',
      }),
    ]);
  });

  it('should reject moving a claim to the entity it already belongs to', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/move')
      .set(serviceHeaders)
      .send({ claimId, entityId: childEntityId })
      .expect(400);
  });

  it('should reject moving a claim when either side does not exist', async () => {
    await seedHierarchy();
    const unknownId = '11111111-1111-4111-8111-111111111119';

    await request(app.server)
      .post('/p/ledger/claims/move')
      .set(serviceHeaders)
      .send({ claimId: duplicateClaimId, entityId: parentEntityId })
      .expect(404);

    await request(app.server)
      .post('/p/ledger/claims/move')
      .set(serviceHeaders)
      .send({ claimId, entityId: unknownId })
      .expect(404);

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({ entityId: childEntityId });
  });

  it('should reclassify the source class of evidence the claim cites', async () => {
    await seedHierarchy();
    await con.getRepository(ClaimEvidence).save({
      claimId,
      postId: postsFixture[0].id,
      url: 'https://vercel.com/changelog/app-router-caching',
      sourceClass: ClaimEvidenceSourceClass.Community,
    });

    await request(app.server)
      .post('/p/ledger/claims/evidence/update')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://vercel.com/changelog/app-router-caching',
        sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
      })
      .expect(200);

    expect(
      await con.getRepository(ClaimEvidence).findOneBy({
        url: 'https://vercel.com/changelog/app-router-caching',
      }),
    ).toMatchObject({
      claimId,
      sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
    });
  });

  it('should reclassify evidence given the trailing slash variant of its url', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence/update')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://nextjs.org/blog/caching/',
        sourceClass: ClaimEvidenceSourceClass.Manual,
      })
      .expect(200);

    expect(
      await con
        .getRepository(ClaimEvidence)
        .findOneBy({ url: 'https://nextjs.org/blog/caching' }),
    ).toMatchObject({ sourceClass: ClaimEvidenceSourceClass.Manual });
  });

  it('should not reclassify a url the claim does not cite', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence/update')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://vercel.com/changelog/unrelated',
        sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
      })
      .expect(404);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(1);
  });

  it('should drop evidence the claim no longer stands on', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence/delete')
      .set(serviceHeaders)
      .send({ claimId, url: 'https://nextjs.org/blog/caching' })
      .expect(200);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(0);
  });

  // The hygiene lane clears the duplicates already in the ledger, so a row
  // stored with its trailing slash has to stay reachable by that exact url.
  it('should drop evidence by either form of its url', async () => {
    await seedHierarchy();
    await con.getRepository(ClaimEvidence).save({
      claimId,
      url: 'https://vercel.com/changelog/app-router-caching/',
      sourceClass: ClaimEvidenceSourceClass.Community,
    });

    await request(app.server)
      .post('/p/ledger/claims/evidence/delete')
      .set(serviceHeaders)
      .send({
        claimId,
        url: 'https://vercel.com/changelog/app-router-caching/',
      })
      .expect(200);

    await request(app.server)
      .post('/p/ledger/claims/evidence/delete')
      .set(serviceHeaders)
      .send({ claimId, url: 'https://nextjs.org/blog/caching/' })
      .expect(200);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(0);
  });

  it('should not drop a url the claim does not cite', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/evidence/delete')
      .set(serviceHeaders)
      .send({ claimId, url: 'https://vercel.com/changelog/unrelated' })
      .expect(404);

    expect(await con.getRepository(ClaimEvidence).count()).toEqual(1);
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

  it('should serve the claim that supersedes a claim it returns', async () => {
    await seedHierarchy();
    const reversal = await con.getRepository(Claim).save({
      entityId: childEntityId,
      changeType: ClaimChangeType.Breaking,
      statement: 'App Router keeps its caching defaults after all.',
      effectiveDate: '2026-06-01',
    });
    await con
      .getRepository(Claim)
      .update(claimId, { supersededByClaimId: reversal.id });

    const { body } = await request(app.server)
      .get('/p/ledger/claims')
      .query({ entities: 'nextjs', since: '2026-01-01' })
      .set(serviceHeaders)
      .expect(200);

    expect(
      body.claims.find(({ id }: { id: string }) => id === claimId),
    ).toMatchObject({ supersededByClaimId: reversal.id });
  });

  it('should serve the claims asked for by id and leave out the ones it holds no row for', async () => {
    await seedHierarchy();
    await con.getRepository(Claim).update(claimId, {
      status: ClaimStatus.Rejected,
      effectiveDate: '2020-01-01',
    });

    const { body } = await request(app.server)
      .get('/p/ledger/claims')
      .query({ ids: `${claimId},${duplicateClaimId}` })
      .set(serviceHeaders)
      .expect(200);

    // Ids name the claims outright, so neither the status floor nor a date
    // window keeps one back.
    expect(body.claims).toHaveLength(1);
    expect(body.claims[0]).toMatchObject({
      id: claimId,
      entityName: 'Next.js App Router',
      status: ClaimStatus.Rejected,
    });
  });

  it('should derive a comparable version tuple from every scheme the corpus uses', async () => {
    await seedHierarchy();
    const scopes = [
      '2.0',
      'v26',
      '2026.2',
      'JDK 25',
      'iOS 27 (pre-release)',
      'beta',
    ];
    const saved = await con.getRepository(Claim).save(
      scopes.map((versionScope) => ({
        entityId: childEntityId,
        changeType: ClaimChangeType.Breaking,
        statement: `scope ${versionScope}`,
        versionScope,
      })),
    );

    const parsed = await con.getRepository(Claim).find({
      select: ['versionScope', 'versionParsed'],
      where: { id: In(saved.map(({ id }) => id)) },
      order: { statement: 'ASC' },
    });

    expect(
      Object.fromEntries(
        parsed.map(({ versionScope, versionParsed }) => [
          versionScope,
          versionParsed,
        ]),
      ),
    ).toEqual({
      '2.0': [2, 0],
      v26: [26],
      '2026.2': [2026, 2],
      'JDK 25': [25],
      'iOS 27 (pre-release)': [27],
      // A release channel is not a version, so it stays out of the ordering.
      beta: null,
    });
  });

  it('should record the signatures a change makes stale and the ones replacing them', async () => {
    await seedHierarchy();

    await request(app.server)
      .post('/p/ledger/claims/update')
      .set(serviceHeaders)
      .send({
        claimId,
        affected: ['next/legacy/image'],
        superseding: ['next/image'],
      })
      .expect(200);

    const { body } = await request(app.server)
      .get('/p/ledger/claims')
      .query({ ids: claimId })
      .set(serviceHeaders)
      .expect(200);

    expect(body.claims[0]).toMatchObject({
      affected: ['next/legacy/image'],
      superseding: ['next/image'],
    });
  });

  it('should serve an undated claim inside a window and hold it back when the window must be dated', async () => {
    await seedHierarchy();
    await con.getRepository(Claim).update(claimId, {
      effectiveDate: null,
      dateSource: null,
    });

    const window = { entities: 'nextjs', since: '2026-01-01' };
    const [undatedAllowed, datedOnly] = await Promise.all([
      request(app.server)
        .get('/p/ledger/claims')
        .query(window)
        .set(serviceHeaders)
        .expect(200),
      request(app.server)
        .get('/p/ledger/claims')
        .query({ ...window, dated: 'true' })
        .set(serviceHeaders)
        .expect(200),
    ]);

    expect(undatedAllowed.body.claims).toHaveLength(1);
    expect(datedOnly.body.claims).toEqual([]);
  });

  it('should mark a date a reviewer sets as the date of the change itself', async () => {
    await seedHierarchy();
    await con.getRepository(Claim).update(claimId, {
      effectiveDate: '2026-05-02',
      dateSource: ClaimDateSource.EvidenceCrawled,
    });

    await request(app.server)
      .post('/p/ledger/claims/update')
      .set(serviceHeaders)
      .send({ claimId, effectiveDate: '2026-03-11' })
      .expect(200);

    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId }),
    ).toMatchObject({
      effectiveDate: '2026-03-11',
      dateSource: ClaimDateSource.Extracted,
    });
  });

  it('should reject a claim query carrying neither ids nor an entity window', async () => {
    await request(app.server)
      .get('/p/ledger/claims')
      .query({ entities: 'nextjs' })
      .set(serviceHeaders)
      .expect(400);
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
