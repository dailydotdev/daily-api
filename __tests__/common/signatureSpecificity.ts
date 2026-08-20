import { isTooGenericToEmit } from '../../src/common/signatureSpecificity';

describe('isTooGenericToEmit', () => {
  it('should reject a token whose every segment is common, numeric, or ≤2 chars', () => {
    // The class the 2026-08-20 backfill shipped: exact-equality matching turns
    // each of these into an accusation against every codebase on earth.
    for (const token of [
      'name',
      'GET',
      'true',
      'user.name',
      'application/json',
      'package.json',
      'GET /v1/users',
      '3.2.1',
      'v2',
      '   ',
    ]) {
      expect({ token, generic: isTooGenericToEmit(token) }).toEqual({
        token,
        generic: true,
      });
    }
  });

  it('should keep a token with a distinctive segment, digits-in-word, or case', () => {
    for (const token of [
      'S3File.presign',
      'contentDispositionType',
      'forms.URLField',
      '--legacy-peer-deps',
      'claude-sonnet-4-5-20250929',
      'Task.sleep(nanoseconds:)',
      'next/legacy/image',
      'huggingface_hub',
    ]) {
      expect({ token, generic: isTooGenericToEmit(token) }).toEqual({
        token,
        generic: false,
      });
    }
  });

  it('should keep a bare lowercase word that is not on the common list', () => {
    // The detector's second generic class — gated at match time, not here: a
    // bare package name is a legitimate signature and must survive emission.
    expect(isTooGenericToEmit('axios')).toBe(false);
    expect(isTooGenericToEmit('required')).toBe(false);
  });
});
