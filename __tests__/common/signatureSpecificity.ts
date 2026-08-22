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

describe('isTooGenericToEmit — standards vocabulary (playbook §13 v5.18)', () => {
  it('should reject a term a published specification defines, not a product', () => {
    // The class both shape rules pass: every one of these carries a separator
    // or is a single word with no space, so the segment bar and the multi-word
    // bar both call it specific. It is specific — and owned by nobody.
    for (const token of [
      // RFC 6749 §3-§6 parameters and §4.1.2.1/§5.2 errors
      'access_token',
      'refresh_token',
      'client_id',
      'client_secret',
      'grant_type',
      'redirect_uri',
      'code_verifier',
      'id_token',
      'invalid_grant',
      'invalid_client',
      'unauthorized_client',
      'unsupported_grant_type',
      // IANA HTTP field names
      'Authorization',
      'Content-Type',
      'User-Agent',
      'Cache-Control',
      'WWW-Authenticate',
      // IANA media types
      'application/json',
      'multipart/form-data',
      // RFC 7519 registered claims
      'exp',
      'aud',
      'email_verified',
    ]) {
      expect({ token, generic: isTooGenericToEmit(token) }).toEqual({
        token,
        generic: true,
      });
    }
  });

  it('should keep a vendor-defined token that merely looks like one', () => {
    // The axis is "a registry defines it", not "it looks protocol-shaped".
    // `X-RateLimit-Limit` is not in the IANA field-name registry and
    // `thinking_budget` is one vendor's parameter, so both are real signatures.
    for (const token of [
      'X-RateLimit-Limit',
      'thinking_budget',
      'anthropic-beta',
      'S3File.presign',
      'application/vnd.github.v3.raw',
    ]) {
      expect({ token, generic: isTooGenericToEmit(token) }).toEqual({
        token,
        generic: false,
      });
    }
  });

  it('should be case- and whitespace-insensitive, like the segment bar', () => {
    expect(isTooGenericToEmit('INVALID_GRANT')).toBe(true);
    expect(isTooGenericToEmit(' Access_Token ')).toBe(true);
  });
});
