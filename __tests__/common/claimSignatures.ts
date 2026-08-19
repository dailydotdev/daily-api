import { extractClaimSignatures } from '../../src/common/claimSignatures';
import { AnthropicClient } from '../../src/integrations/anthropic';
import { ClaimChangeType } from '../../src/entity/claim/Claim';

const statement =
  'Django 6.0 changed the default URL scheme of forms.URLField and removed the FORMS_URLFIELD_ASSUME_HTTPS setting.';

const clientReturning = (input: Record<string, unknown>): AnthropicClient =>
  ({
    createMessage: async () => ({ content: [{ input }] }),
  }) as unknown as AnthropicClient;

const run = (input: Record<string, unknown>) =>
  extractClaimSignatures({
    client: clientReturning(input),
    model: 'test-model',
    claim: { statement, changeType: ClaimChangeType.Breaking },
    entityName: 'Django',
  });

describe('extractClaimSignatures', () => {
  it('should keep the tokens the statement actually contains', async () => {
    await expect(
      run({
        affected: ['forms.URLField', 'FORMS_URLFIELD_ASSUME_HTTPS'],
        superseding: [],
      }),
    ).resolves.toEqual({
      affected: ['forms.URLField', 'FORMS_URLFIELD_ASSUME_HTTPS'],
      superseding: [],
    });
  });

  it('should drop a token the statement never names', async () => {
    // The failure that turns a signature into a false accusation against
    // working code: matching is by equality, so an invented token accuses a
    // reader who never wrote it.
    await expect(
      run({
        affected: ['forms.URLField', 'forms.EmailField'],
        superseding: [],
      }),
    ).resolves.toMatchObject({ affected: ['forms.URLField'] });
  });

  it('should survive a response that carries no usable input', async () => {
    await expect(run({})).resolves.toEqual({ affected: [], superseding: [] });
    await expect(
      run({ affected: 'not-an-array', superseding: [42, '', '   '] }),
    ).resolves.toEqual({ affected: [], superseding: [] });
  });
});
