import { extractClaimSignatures } from '../../src/common/claimSignatures';
import { AnthropicClient } from '../../src/integrations/anthropic';
import { ClaimChangeType } from '../../src/entity/claim/Claim';

const statement =
  'Django 6.0 changed the default URL scheme of forms.URLField and removed the FORMS_URLFIELD_ASSUME_HTTPS setting.';

const clientReturning = (input: Record<string, unknown>): AnthropicClient =>
  ({
    createMessage: async () => ({ content: [{ input }] }),
  }) as unknown as AnthropicClient;

const run = (input: Record<string, unknown>, statementText = statement) =>
  extractClaimSignatures({
    client: clientReturning(input),
    model: 'test-model',
    claim: { statement: statementText, changeType: ClaimChangeType.Breaking },
    entityName: 'Django',
    entityAliases: ['django', 'Django Framework'],
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

  it('should drop a CVE identifier, which names an advisory rather than anything in the code', async () => {
    await expect(
      run(
        { affected: ['CVE-2025-59156', 'forms.URLField'], superseding: [] },
        'CVE-2025-59156 affects forms.URLField in Django.',
      ),
    ).resolves.toMatchObject({ affected: ['forms.URLField'] });
  });

  it('should drop a token that only repeats the entity it is filed against', async () => {
    // Matches every plan mentioning the technology rather than the change.
    await expect(
      run(
        { affected: ['Django Framework', 'forms.URLField'], superseding: [] },
        'Django Framework changed forms.URLField.',
      ),
    ).resolves.toMatchObject({ affected: ['forms.URLField'] });
  });

  it('should drop a token claimed on both sides at once', async () => {
    // It cannot be both the stale choice and the current one, and half of the
    // pair would flag a reader for doing the right thing.
    await expect(
      run(
        { affected: ['#klass', 'forms.URLField'], superseding: ['#klass'] },
        'The #klass helper and forms.URLField both changed.',
      ),
    ).resolves.toEqual({ affected: ['forms.URLField'], superseding: [] });
  });

  it('should survive a response that carries no usable input', async () => {
    await expect(run({})).resolves.toEqual({ affected: [], superseding: [] });
    await expect(
      run({ affected: 'not-an-array', superseding: [42, '', '   '] }),
    ).resolves.toEqual({ affected: [], superseding: [] });
  });
});
