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
    { value: 'node.js', status: KeywordStatus.Synonym, synonym: 'nodejs' },
    { value: 'deadend', status: KeywordStatus.Synonym, synonym: 'nowhere' },
    { value: 'nowhere', status: KeywordStatus.Deny },
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

  it('should follow a synonym to the allowed keyword it redirects to', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(3), canonicalName: 'Node.js', kind: LedgerEntityKind.Runtime },
    ]);

    await linkEntityKeywords({ con });

    expect(
      await con.getRepository(LedgerEntity).findOneBy({ id: uuid(3) }),
    ).toMatchObject({ keywordValue: 'nodejs' });
  });

  it('should not follow a synonym that redirects to a denied keyword', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(4), canonicalName: 'deadend', kind: LedgerEntityKind.Tool },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  it('should never link a pending keyword', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(5), canonicalName: 'pendingtag', kind: LedgerEntityKind.Tool },
    ]);

    expect(await linkEntityKeywords({ con })).toEqual(0);
  });

  it('should leave a keyword unlinked when two entities compete for it', async () => {
    await saveFixtures(con, LedgerEntity, [
      { id: uuid(6), canonicalName: 'contested', kind: LedgerEntityKind.Tool },
      {
        id: uuid(7),
        canonicalName: 'Something Else',
        kind: LedgerEntityKind.Tool,
        aliases: ['contested'],
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

  it('should prefer the canonical route over an alias route', async () => {
    await saveFixtures(con, LedgerEntity, [
      {
        id: uuid(10),
        canonicalName: 'Python',
        kind: LedgerEntityKind.Runtime,
        aliases: ['nodejs'],
      },
    ]);

    const links = await findEntityKeywordLinks({ con });

    expect(links).toEqual([
      expect.objectContaining({ keywordValue: 'python', via: 'canonical' }),
    ]);
  });
});
