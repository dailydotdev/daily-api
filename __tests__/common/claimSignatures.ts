import { extractClaimSignatures } from '../../src/common/claimSignatures';
import { AnthropicClient } from '../../src/integrations/anthropic';
import { ClaimChangeType } from '../../src/entity/claim/Claim';

const statement =
  'Django 6.0 changed the default URL scheme of forms.URLField and removed the FORMS_URLFIELD_ASSUME_HTTPS setting.';

const clientReturning = (input: Record<string, unknown>): AnthropicClient =>
  ({
    createMessage: async () => ({ content: [{ input }] }),
  }) as unknown as AnthropicClient;

const run = (
  input: Record<string, unknown>,
  statementText = statement,
  proseEntityNames?: Set<string>,
) =>
  extractClaimSignatures({
    client: clientReturning(input),
    model: 'test-model',
    claim: { statement: statementText, changeType: ClaimChangeType.Breaking },
    entityName: 'Django',
    entityAliases: ['django', 'Django Framework'],
    proseEntityNames,
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

  it('should drop a token too generic to identify the API on its own', async () => {
    // The specificity bar (playbook §13 v5.9): matching is exact-equality, so
    // `affected: ["name"]` accuses every codebase on earth — the 2026-08-20
    // backfill shipped exactly that and rot-bench's harness pilot got 15
    // identical tier-A false findings on an unrelated diff.
    await expect(
      run(
        {
          affected: ['name', 'GET', 'user.name', 'forms.URLField'],
          superseding: ['application/json'],
        },
        'GET requests with a name or user.name of application/json break forms.URLField.',
      ),
    ).resolves.toEqual({ affected: ['forms.URLField'], superseding: [] });
  });

  it('should keep a bare package name, which the detector gates at match time instead', async () => {
    await expect(
      run(
        { affected: ['axios'], superseding: [] },
        'A typosquat of axios steals credentials on install.',
      ),
    ).resolves.toEqual({ affected: ['axios'], superseding: [] });
  });

  it('should survive a response that carries no usable input', async () => {
    await expect(run({})).resolves.toEqual({ affected: [], superseding: [] });
    await expect(
      run({ affected: 'not-an-array', superseding: [42, '', '   '] }),
    ).resolves.toEqual({ affected: [], superseding: [] });
  });

  it('should drop a token naming a different entity the ledger already knows', async () => {
    // "Couchbase" on a Spring AI claim is no more a code surface than
    // "Spring AI" would be: it fires on every plan that mentions Couchbase for
    // any reason, which the entity tiers already cover version-gated.
    await expect(
      run(
        { affected: ['Celery', 'forms.URLField'], superseding: [] },
        'Django 6.0 dropped Celery support and changed forms.URLField.',
        new Set(['celery']),
      ),
    ).resolves.toMatchObject({ affected: ['forms.URLField'] });
  });
});
