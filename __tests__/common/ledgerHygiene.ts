import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
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
import {
  LedgerEntity,
  LedgerEntityKind,
} from '../../src/entity/claim/LedgerEntity';
import {
  ClaimEvidence,
  ClaimEvidenceSourceClass,
} from '../../src/entity/claim/ClaimEvidence';
import {
  clearPreReleaseDates,
  clearSelfDisplacementLinks,
  dateClaimsFromEvidence,
  isPreReleaseScope,
  planClaimDatesFromEvidence,
} from '../../src/common/ledgerHygiene';

let con: DataSource;

const entityId = 'bbbbbbbb-0000-4000-8000-000000000001';
const otherId = 'bbbbbbbb-0000-4000-8000-000000000002';
const claimId = (n: number) =>
  `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con
    .getRepository(ClaimEvidence)
    .createQueryBuilder()
    .delete()
    .execute();
  await con.getRepository(Claim).createQueryBuilder().delete().execute();
  await con.getRepository(LedgerEntity).createQueryBuilder().delete().execute();
  await saveFixtures(con, LedgerEntity, [
    { id: entityId, canonicalName: 'Hygiene One', kind: LedgerEntityKind.Tool },
    { id: otherId, canonicalName: 'Hygiene Two', kind: LedgerEntityKind.Tool },
  ]);
});

describe('clearSelfDisplacementLinks', () => {
  it('should null a displacement link that points at the claim own entity', async () => {
    await saveFixtures(con, Claim, [
      {
        id: claimId(1),
        entityId,
        changeType: ClaimChangeType.Removal,
        statement: 'X version 1 is superseded by X version 2.',
        status: ClaimStatus.Candidate,
        supersededByEntityId: entityId,
      },
    ]);

    expect(await clearSelfDisplacementLinks(con)).toEqual(1);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(1) }),
    ).toMatchObject({ supersededByEntityId: null });
  });

  it('should leave a genuine cross-entity displacement link alone', async () => {
    await saveFixtures(con, Claim, [
      {
        id: claimId(2),
        entityId,
        changeType: ClaimChangeType.Displacement,
        statement: 'One was replaced by Two.',
        status: ClaimStatus.Candidate,
        supersededByEntityId: otherId,
      },
    ]);

    expect(await clearSelfDisplacementLinks(con)).toEqual(0);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(2) }),
    ).toMatchObject({ supersededByEntityId: otherId });
  });
});

describe('clearPreReleaseDates', () => {
  it('should null an evidence-derived date on a pre-release claim', async () => {
    await saveFixtures(con, Claim, [
      {
        id: claimId(3),
        entityId,
        changeType: ClaimChangeType.NewCapability,
        statement: 'Committed for the unreleased line.',
        status: ClaimStatus.Candidate,
        versionScope: '19 (pre-release)',
        effectiveDate: '2026-05-01',
        dateSource: ClaimDateSource.EvidencePublished,
      },
    ]);

    expect(await clearPreReleaseDates(con)).toEqual(1);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(3) }),
    ).toMatchObject({ effectiveDate: null, dateSource: null });
  });

  it('should keep an announced GA date a reviewer set by hand', async () => {
    await saveFixtures(con, Claim, [
      {
        id: claimId(4),
        entityId,
        changeType: ClaimChangeType.NewCapability,
        statement: 'Committed for the unreleased line, GA announced.',
        status: ClaimStatus.Candidate,
        versionScope: '19 (pre-release)',
        effectiveDate: '2026-09-01',
        dateSource: ClaimDateSource.Extracted,
      },
    ]);

    expect(await clearPreReleaseDates(con)).toEqual(0);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(4) }),
    ).toMatchObject({ effectiveDate: '2026-09-01' });
  });

  it('should not null a date whose provenance it cannot classify', async () => {
    await saveFixtures(con, Claim, [
      {
        id: claimId(11),
        entityId,
        changeType: ClaimChangeType.NewCapability,
        statement: 'Committed for the unreleased line, provenance unrecorded.',
        status: ClaimStatus.Candidate,
        versionScope: '19 (pre-release)',
        effectiveDate: '2026-09-01',
        dateSource: null,
      },
    ]);

    expect(await clearPreReleaseDates(con)).toEqual(0);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(11) }),
    ).toMatchObject({ effectiveDate: '2026-09-01' });
  });

  it('should not touch a released claim', async () => {
    await saveFixtures(con, Claim, [
      {
        id: claimId(5),
        entityId,
        changeType: ClaimChangeType.Release,
        statement: 'Shipped.',
        status: ClaimStatus.Candidate,
        versionScope: '19',
        effectiveDate: '2026-05-01',
        dateSource: ClaimDateSource.EvidencePublished,
      },
    ]);

    expect(await clearPreReleaseDates(con)).toEqual(0);
  });
});

describe('isPreReleaseScope', () => {
  it('should recognise the sanctioned marker and nothing else', () => {
    expect(isPreReleaseScope('19 (pre-release)')).toBe(true);
    expect(isPreReleaseScope('.NET 11 Preview 7 (pre-release)')).toBe(true);
    expect(isPreReleaseScope('19')).toBe(false);
    expect(isPreReleaseScope('beta')).toBe(false);
    expect(isPreReleaseScope(null)).toBe(false);
  });
});

describe('planClaimDatesFromEvidence', () => {
  // The 2026-08-21 regression: `bin/backfillClaimDates.ts` decided for itself who
  // was datable, dated the whole `(pre-release)` family from coverage dates, and
  // the next hygiene pass nulled 660 of them. The script now asks this function,
  // so a date the rules forbid can no longer be written by either caller.
  const withEvidence = async ({
    id,
    status = ClaimStatus.Candidate,
    versionScope = null,
  }: {
    id: string;
    status?: ClaimStatus;
    versionScope?: string | null;
  }) => {
    await saveFixtures(con, Claim, [
      {
        id,
        entityId,
        changeType: ClaimChangeType.NewCapability,
        statement: 'Undated, cites a dated post.',
        status,
        versionScope,
      },
    ]);
    await saveFixtures(con, ClaimEvidence, [
      {
        claimId: id,
        url: `https://example.com/${id}`,
        sourceClass: ClaimEvidenceSourceClass.VendorChangelog,
        publishedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
  };

  it('should date an undated consumable claim from its evidence', async () => {
    await withEvidence({ id: claimId(6) });

    expect(await dateClaimsFromEvidence(con)).toEqual(1);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(6) }),
    ).toMatchObject({
      effectiveDate: '2026-05-01',
      dateSource: ClaimDateSource.EvidencePublished,
    });
  });

  it('should refuse to date a pre-release claim from a coverage date', async () => {
    await withEvidence({ id: claimId(7), versionScope: '19 (pre-release)' });

    expect(
      [...(await planClaimDatesFromEvidence(con)).values()].flat(),
    ).toEqual([]);
    expect(await dateClaimsFromEvidence(con)).toEqual(0);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(7) }),
    ).toMatchObject({ effectiveDate: null, dateSource: null });
  });

  it('should refuse to date a rejected claim', async () => {
    await withEvidence({ id: claimId(8), status: ClaimStatus.Rejected });

    expect(await dateClaimsFromEvidence(con)).toEqual(0);
    expect(
      await con.getRepository(Claim).findOneBy({ id: claimId(8) }),
    ).toMatchObject({ effectiveDate: null });
  });

  it('should leave nothing for a second pass to do', async () => {
    await withEvidence({ id: claimId(9) });
    await withEvidence({ id: claimId(10), versionScope: '19 (pre-release)' });

    expect(await dateClaimsFromEvidence(con)).toEqual(1);
    expect(await clearPreReleaseDates(con)).toEqual(0);
    expect(await dateClaimsFromEvidence(con)).toEqual(0);
  });
});
