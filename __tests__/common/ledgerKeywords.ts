import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import { saveFixtures } from '../helpers';
import { Keyword, KeywordStatus } from '../../src/entity/Keyword';
import {
  LedgerEntity,
  LedgerEntityKind,
} from '../../src/entity/claim/LedgerEntity';
import {
  findEntityKeywordLinks,
  linkEntityKeywords,
} from '../../src/common/ledgerKeywords';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

const uuid = (n: number) =>
  `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeEach(async () => {
  await con.getRepository(LedgerEntity).createQueryBuilder().delete().execute();
  await con.getRepository(Keyword).createQueryBuilder().delete().execute();
  await saveFixtures(con, Keyword, [
    { value: 'python', status: KeywordStatus.Allow },
    { value: 'visual-studio-code', status: KeywordStatus.Allow },
    { value: 'nodejs', status: KeywordStatus.Allow },
    { value: 'backend', status: KeywordStatus.Allow },
    { value: 'blockchain', status: KeywordStatus.Allow },
    { value: 'ffmpeg', status: KeywordStatus.Synonym, synonym: 'backend' },
    { value: 'pendingtag', status: KeywordStatus.Pending },
    { value: 'contested', status: KeywordStatus.Allow },
  ]);
});

describe('ledger keyword links', () => {
  it('should link a canonical name straight to an allowed keyword', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(1), canonicalName: 'Python', kind: LedgerEntityKind.Runtime },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(1);
    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: uuid(1) }),
    ).toMatchObject({ keywordValue: 'python' });
  });

  it('should reach a keyword by slugifying a multi-word canonical name', async () => {
    await saveFixtures(con, LedgerEntity, [
      {
        id: uuid(2),
        canonicalName: 'Visual Studio Code',
        kind: LedgerEntityKind.Tool,
      },
    ]);

    await linkEntityKeywords({ con });

    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: uuid(2) }),
    ).toMatchObject({ keywordValue: 'visual-studio-code' });
  });

  it('should never follow a synonym, because the taxonomy redirects into categories', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(3), canonicalName: 'FFmpeg', kind: LedgerEntityKind.Package },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  it('should never link through an alias, which is only the form a post used', async () => {
    await saveFixtures(con, LedgerEntity, [
      {
        id: uuid(4),
        canonicalName: 'Stratis Storage',
        kind: LedgerEntityKind.Tool,
        aliases: ['blockchain'],
      },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  it('should never link a pending keyword', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(5), canonicalName: 'pendingtag', kind: LedgerEntityKind.Tool },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  // Canonical names carry a lower() unique constraint, so two entities can only
  // reach one tag when a slugified multi-word name lands on another entity's
  // literal name.
  it('should leave a keyword unlinked when two entities compete for it', async () => {
    await saveFixtures(con, LedgerEntity, [
      {
        id: uuid(6),
        canonicalName: 'visual-studio-code',
        kind: LedgerEntityKind.Tool,
      },
      {
        id: uuid(7),
        canonicalName: 'Visual Studio Code',
        kind: LedgerEntityKind.Service,
      },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  it('should not steal a keyword another entity already holds', async () => {
    await saveFixtures(con, LedgerEntity, [
      {
        id: uuid(8),
        canonicalName: 'Python Holder',
        kind: LedgerEntityKind.Tool,
        keywordValue: 'python',
      },
      { id: uuid(9), canonicalName: 'Python', kind: LedgerEntityKind.Runtime },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  it('should credit the canonical route when the name needs no slugifying', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(10), canonicalName: 'nodejs', kind: LedgerEntityKind.Runtime },
    ]);

    expect(await findEntityKeywordLinks({ con })).toEqual([
      expect.objectContaining({ keywordValue: 'nodejs', via: 'canonical' }),
    ]);
  });
});
