import { DataSource } from 'typeorm';
import createOrGetConnection from '../../src/db';
import {
  clearProseEntityNameCache,
  isEntityPhrase,
  loadProseEntityNames,
  normalizeSignatureToken,
} from '../../src/common/ledgerEntityNames';
import {
  LedgerEntity,
  LedgerEntityKind,
} from '../../src/entity/claim/LedgerEntity';

let con: DataSource;

beforeAll(async () => {
  con = await createOrGetConnection();
});

beforeEach(async () => {
  clearProseEntityNameCache();
  await con.getRepository(LedgerEntity).save([
    {
      id: '1d1b7f4e-4b0a-4a3e-9a41-6d1f0f6d2b01',
      canonicalName: 'Node.js',
      aliases: ['nodejs'],
      kind: LedgerEntityKind.Runtime,
    },
    {
      id: '1d1b7f4e-4b0a-4a3e-9a41-6d1f0f6d2b02',
      canonicalName: 'browser_toolset_20260801',
      codeOnlyCanonical: true,
      aliases: [],
      kind: LedgerEntityKind.Api,
    },
  ]);
});

describe('loadProseEntityNames', () => {
  it('should match an entity name however either side punctuates it', async () => {
    const names = await loadProseEntityNames(con);

    expect(names.has(normalizeSignatureToken('Node.js'))).toBe(true);
    expect(names.has(normalizeSignatureToken('node js'))).toBe(true);
  });

  it('should not reject a code-only canonical name, which is a real surface', async () => {
    const names = await loadProseEntityNames(con);

    expect(names.has(normalizeSignatureToken('browser_toolset_20260801'))).toBe(
      false,
    );
  });

  it('should reject a multi-word name but keep a single-word one, which may be a real token', async () => {
    const names = await loadProseEntityNames(con);

    expect(isEntityPhrase('Node.js', names)).toBe(false);
    expect(
      isEntityPhrase('Swift Package Manager', new Set(['swiftpackagemanager'])),
    ).toBe(true);
    expect(isEntityPhrase('use cache', names)).toBe(false);
  });
});
