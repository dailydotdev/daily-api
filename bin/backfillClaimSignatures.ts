import '../src/config';
import createOrGetConnection from '../src/db';
import { Claim, ClaimChangeType } from '../src/entity/claim/Claim';
import { LedgerEntity } from '../src/entity/claim/LedgerEntity';
import { AnthropicClient } from '../src/integrations/anthropic';
import { extractClaimSignatures } from '../src/common/claimSignatures';

// Claims filed before extraction emitted signatures carry none, and the tokens
// are already in their statements — extraction requires a statement to be
// readable by someone who will never see the post. Measured against
// re-extraction on bragi's eval set: affected recall 73.8% vs 78.6%, superseding
// 70.8% vs 87.5%, grounding 100% vs 98.3%, over 3 reps. Re-extraction would cost
// an order of magnitude more and file thousands of candidates for review.
//
// Resumable by design: every claim is stamped when it is processed, whether or
// not it yielded tokens, so a re-run picks up exactly where the last one
// stopped. A claim whose call failed is left unstamped and comes back around.
//
// Tokens pass the specificity bar (playbook §13 v5.9) inside
// extractClaimSignatures before they are written — the first 14,923 stamps ran
// without it, flooded rot-bench's harness with tier-A false findings, and were
// cleaned in prod on 2026-08-20. After the run completes, verify with one pass
// of rot-bench/scripts/gen-signature-cleanup-sql.ts: its analysis query should
// count zero claims carrying a generic token.

// Where a signature changes what a reader does. `release` and `new_capability`
// are two thirds of the ledger and make nothing stale — measured at 0/45 and
// 1/49 fill in production — so they are not worth the call.
const DEFAULT_CHANGE_TYPES = [
  ClaimChangeType.Breaking,
  ClaimChangeType.Deprecation,
  ClaimChangeType.Removal,
  ClaimChangeType.Displacement,
  ClaimChangeType.Security,
  ClaimChangeType.Gotcha,
  ClaimChangeType.Fix,
];

const BATCH_SIZE = 50;
const CONCURRENCY = 8;

const arg = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];

(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const limit = arg('limit') ? parseInt(arg('limit') as string, 10) : undefined;
  const model = arg('model') ?? 'claude-sonnet-4-6';
  const changeTypes = arg('change-types')
    ? (arg('change-types') as string).split(',').map((t) => t.trim())
    : DEFAULT_CHANGE_TYPES;

  const apiKey = process.env.AGENT_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('AGENT_ANTHROPIC_API_KEY is not configured');
  }

  const con = await createOrGetConnection();
  const client = new AnthropicClient(apiKey);

  const pending = await con
    .getRepository(Claim)
    .createQueryBuilder('c')
    .innerJoin(LedgerEntity, 'le', 'le.id = c."entityId"')
    .select('c.id', 'id')
    .addSelect('c.statement', 'statement')
    .addSelect('c."changeType"', 'changeType')
    .addSelect('le."canonicalName"', 'entityName')
    .addSelect('le.aliases', 'entityAliases')
    .where('c."signaturesBackfilledAt" IS NULL')
    .andWhere('c."changeType" IN (:...changeTypes)', { changeTypes })
    .orderBy('c.id', 'ASC')
    .limit(limit)
    .getRawMany<{
      id: string;
      statement: string;
      changeType: ClaimChangeType;
      entityName: string;
      entityAliases: string[];
    }>();

  console.log(
    `${pending.length} claims pending across ${changeTypes.length} change types on ${model}`,
  );

  if (!pending.length) {
    process.exit(0);
  }

  let processed = 0;
  let withTokens = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const results: {
      id: string;
      affected: string[];
      superseding: string[];
    }[] = [];

    for (let j = 0; j < batch.length; j += CONCURRENCY) {
      const slice = batch.slice(j, j + CONCURRENCY);
      const settled = await Promise.all(
        slice.map(async (claim) => {
          try {
            const signatures = await extractClaimSignatures({
              client,
              model,
              claim,
              entityName: claim.entityName,
              entityAliases: claim.entityAliases,
            });

            return { id: claim.id, ...signatures };
          } catch (err) {
            // Left unstamped on purpose: a re-run retries it, and one bad claim
            // must not end a run that has already paid for thousands of calls.
            failed += 1;
            console.error(
              `  ${claim.id} failed: ${(err as Error).message.slice(0, 140)}`,
            );

            return null;
          }
        }),
      );

      results.push(...settled.filter((result) => result !== null));
    }

    if (dryRun) {
      console.table(
        results
          .filter(
            ({ affected, superseding }) => affected.length + superseding.length,
          )
          .slice(0, 25)
          .map(({ id, affected, superseding }) => ({
            id: id.slice(0, 8),
            affected: affected.join(', ').slice(0, 60),
            superseding: superseding.join(', ').slice(0, 40),
          })),
      );
      const found = results.filter(
        (r) => r.affected.length + r.superseding.length,
      ).length;
      console.log(
        `dry run: ${results.length} claims, ${found} would get tokens, ${failed} failed`,
      );
      process.exit(0);
    }

    // Stamped in the same statement that writes the tokens, so a crash between
    // the two is not possible and a resumed run never double-charges a claim.
    await con.transaction(async (manager) => {
      const stampedAt = new Date();

      await Promise.all(
        results.map(({ id, affected, superseding }) =>
          manager
            .getRepository(Claim)
            .update(
              { id },
              { affected, superseding, signaturesBackfilledAt: stampedAt },
            ),
        ),
      );
    });

    processed += results.length;
    withTokens += results.filter(
      ({ affected, superseding }) => affected.length + superseding.length,
    ).length;
    console.log(
      `${processed}/${pending.length} stamped, ${withTokens} carry tokens, ${failed} failed`,
    );
  }

  console.log(
    `done: ${processed} stamped, ${withTokens} with tokens, ${failed} left unstamped for a re-run`,
  );
  process.exit(0);
})();
