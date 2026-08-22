import { DataSource } from 'typeorm';
import { crons } from '../../src/cron/index';
import { ledgerCorroborationCron as cron } from '../../src/cron/ledgerCorroboration';
import { expectSuccessfulCron, saveFixtures } from '../helpers';
import createOrGetConnection from '../../src/db';
import { Source } from '../../src/entity/Source';
import { ArticlePost } from '../../src/entity/posts/ArticlePost';
import { sourcesFixture } from '../fixture/source';
import { postsFixture } from '../fixture/post';
import {
  Claim,
  ClaimChangeType,
  ClaimStatus,
} from '../../src/entity/claim/Claim';
import {
  ClaimEvidence,
  ClaimEvidenceSourceClass,
} from '../../src/entity/claim/ClaimEvidence';
import {
  LedgerEntity,
  LedgerEntityKind,
} from '../../src/entity/claim/LedgerEntity';

let con: DataSource;

const entityId = '5c1f7f4e-4b0a-4a3e-9a41-6d1f0f6d2b01';
const twoPublishersId = '5c1f7f4e-4b0a-4a3e-9a41-6d1f0f6d2b02';
const onePublisherId = '5c1f7f4e-4b0a-4a3e-9a41-6d1f0f6d2b03';
const verifiedId = '5c1f7f4e-4b0a-4a3e-9a41-6d1f0f6d2b04';
const rejectedId = '5c1f7f4e-4b0a-4a3e-9a41-6d1f0f6d2b05';
const noEvidenceId = '5c1f7f4e-4b0a-4a3e-9a41-6d1f0f6d2b06';

const claim = (id: string, status: ClaimStatus, statement: string) => ({
  id,
  entityId,
  changeType: ClaimChangeType.Deprecation,
  statement,
  status,
});

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  await saveFixtures(con, Source, sourcesFixture);
  await saveFixtures(con, ArticlePost, postsFixture);
  await con.getRepository(LedgerEntity).save({
    id: entityId,
    canonicalName: 'Corroboration Test Package',
    kind: LedgerEntityKind.Package,
  });
  await con
    .getRepository(Claim)
    .save([
      claim(twoPublishersId, ClaimStatus.Candidate, 'Two publishers agree.'),
      claim(onePublisherId, ClaimStatus.Candidate, 'One publisher, twice.'),
      claim(verifiedId, ClaimStatus.Verified, 'A reviewer read the source.'),
      claim(rejectedId, ClaimStatus.Rejected, 'Absorbed by a merge.'),
      claim(noEvidenceId, ClaimStatus.Candidate, 'Nothing cites this.'),
    ]);
  await con.getRepository(ClaimEvidence).save([
    {
      claimId: twoPublishersId,
      url: 'https://techcrunch.com/2026/01/01/a',
      sourceClass: ClaimEvidenceSourceClass.Community,
    },
    {
      claimId: twoPublishersId,
      url: 'https://blog.cloudflare.com/a',
      sourceClass: ClaimEvidenceSourceClass.Community,
    },
    {
      claimId: onePublisherId,
      url: 'https://babeljs.io/blog/a',
      sourceClass: ClaimEvidenceSourceClass.Community,
    },
    {
      claimId: onePublisherId,
      url: 'https://babeljs.io/blog/b',
      sourceClass: ClaimEvidenceSourceClass.Community,
    },
    // Both a `verified` and a `rejected` claim carry qualifying evidence, so a
    // missing status filter would show up as a changed status below.
    ...[verifiedId, rejectedId].flatMap((claimId) => [
      {
        claimId,
        url: 'https://techcrunch.com/2026/01/01/b',
        sourceClass: ClaimEvidenceSourceClass.Community,
      },
      {
        claimId,
        url: 'https://blog.cloudflare.com/b',
        sourceClass: ClaimEvidenceSourceClass.Community,
      },
    ]),
  ]);
});

const statusOf = async (id: string): Promise<ClaimStatus | undefined> =>
  (await con.getRepository(Claim).findOneBy({ id }))?.status;

describe('ledgerCorroboration cron', () => {
  it('should be registered', () => {
    expect(
      crons.find((item) => item.name === 'ledger-corroboration'),
    ).toBeTruthy();
  });

  it('should promote a candidate two independent publishers assert', async () => {
    await expectSuccessfulCron(cron);

    expect(await statusOf(twoPublishersId)).toEqual(ClaimStatus.Corroborated);
  });

  it('should leave a single-publisher candidate alone', async () => {
    await expectSuccessfulCron(cron);

    expect(await statusOf(onePublisherId)).toEqual(ClaimStatus.Candidate);
    expect(await statusOf(noEvidenceId)).toEqual(ClaimStatus.Candidate);
  });

  it('should never demote or touch verified and rejected claims', async () => {
    await expectSuccessfulCron(cron);

    expect(await statusOf(verifiedId)).toEqual(ClaimStatus.Verified);
    expect(await statusOf(rejectedId)).toEqual(ClaimStatus.Rejected);
  });

  it('should be idempotent across runs', async () => {
    await expectSuccessfulCron(cron);
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() };

    await cron.handler(con, logger as never);

    // Nothing left to promote: the first run moved the only qualifying claim
    // off `candidate`, so the second sees no candidates with two publishers.
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ distinct_publishers: 0 }),
      expect.any(String),
    );
    expect(await statusOf(twoPublishersId)).toEqual(ClaimStatus.Corroborated);
  });

  it('should report counts by reason', async () => {
    const logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() };

    await cron.handler(con, logger as never);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ distinct_publishers: 1, single_publisher: 1 }),
      'ledger corroboration pass',
    );
  });
});
