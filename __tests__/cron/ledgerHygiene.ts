import { DataSource } from 'typeorm';
import { crons } from '../../src/cron/index';
import { ledgerHygieneCron as cron } from '../../src/cron/ledgerHygiene';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { Source } from '../../src/entity/Source';
import { ArticlePost } from '../../src/entity/posts/ArticlePost';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import {
  Claim,
  ClaimChangeType,
  ClaimDateSource,
  ClaimStatus,
} from '../../src/entity/claim/Claim';
import { ClaimEvidence } from '../../src/entity/claim/ClaimEvidence';
import {
  LedgerEntity,
  LedgerEntityKind,
} from '../../src/entity/claim/LedgerEntity';

let con: DataSource;

const entityId = '3f6b7f4e-4b0a-4a3e-9a41-6d1f0f6d2a01';
const datableClaimId = '3f6b7f4e-4b0a-4a3e-9a41-6d1f0f6d2a02';
const evidencelessClaimId = '3f6b7f4e-4b0a-4a3e-9a41-6d1f0f6d2a03';

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(ArticlePost).update(postsFixture[0].id as string, {
    publishedAt: new Date('2026-02-11T08:00:00.000Z'),
  });
  await con.getRepository(LedgerEntity).save({
    id: entityId,
    canonicalName: 'Hygiene Test Package',
    kind: LedgerEntityKind.Package,
  });
  await con.getRepository(Claim).save([
    {
      id: datableClaimId,
      entityId,
      changeType: ClaimChangeType.Deprecation,
      statement: 'A claim that gained its evidence after it was created.',
      status: ClaimStatus.Candidate,
      effectiveDate: null,
      dateSource: null,
    },
    {
      id: evidencelessClaimId,
      entityId,
      changeType: ClaimChangeType.Deprecation,
      statement: 'A claim nothing cites, which stays honestly undated.',
      status: ClaimStatus.Candidate,
      effectiveDate: null,
      dateSource: null,
    },
  ]);
  await con.getRepository(ClaimEvidence).save({
    claimId: datableClaimId,
    postId: postsFixture[0].id as string,
    url: 'https://example.com/hygiene',
    sourceClass: 'community',
  });
});

describe('ledgerHygiene cron', () => {
  it('should be registered', () => {
    expect(crons.find((item) => item.name === 'ledger-hygiene')).toBeTruthy();
  });

  it('should date a claim that gained evidence after it was created', async () => {
    await expectSuccessfulCron(cron);

    expect(
      await con.getRepository(Claim).findOneBy({ id: datableClaimId }),
    ).toMatchObject({
      effectiveDate: '2026-02-11',
      dateSource: ClaimDateSource.EvidencePublished,
    });
  });

  it('should leave a claim with no evidence undated rather than guessing', async () => {
    await expectSuccessfulCron(cron);

    expect(
      await con.getRepository(Claim).findOneBy({ id: evidencelessClaimId }),
    ).toMatchObject({ effectiveDate: null, dateSource: null });
  });

  it('should not count release claims as awaiting the signature pass', async () => {
    // Above UNSIGNED_WARN, so an unfiltered count would warn. The backfill
    // never stamps `release`, so these are done, not pending.
    await con.getRepository(Claim).save(
      Array.from({ length: 201 }, (_, index) => ({
        entityId,
        changeType: ClaimChangeType.Release,
        statement: `A release claim the signature pass skips by design. ${index}`,
        status: ClaimStatus.Candidate,
      })),
    );
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() };

    await cron.handler(con, logger as never);

    expect(
      logger.warn.mock.calls.some(([, message]) =>
        String(message).includes('signature pass'),
      ),
    ).toBe(false);
  });

  it('should not re-date a claim that already carries an extracted date', async () => {
    await con.getRepository(Claim).update(datableClaimId, {
      effectiveDate: '2026-01-01',
      dateSource: ClaimDateSource.Extracted,
    });

    await expectSuccessfulCron(cron);

    expect(
      await con.getRepository(Claim).findOneBy({ id: datableClaimId }),
    ).toMatchObject({
      effectiveDate: '2026-01-01',
      dateSource: ClaimDateSource.Extracted,
    });
  });
});
