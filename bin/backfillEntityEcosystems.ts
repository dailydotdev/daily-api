import '../src/config';
import createOrGetConnection from '../src/db';
import {
  LedgerEcosystem,
  LedgerEntity,
  LedgerEntityKind,
} from '../src/entity/claim/LedgerEntity';
import {
  REGISTRY_EVIDENCE_HOSTS,
  deriveEcosystems,
  unionEcosystems,
} from '../src/common/ledgerEcosystem';

// Populates `ledger_entity.ecosystem` from what the ledger already knows, with
// no model in the loop: the shape of the names an entity answers to, and the
// hosts of the evidence its claims cite. Both rules live in
// `src/common/ledgerEcosystem.ts` and are the same ones the entity-minting
// route applies, so a re-run agrees with ongoing inflow instead of fighting it.
//
// Why this is safe to run wide: an empty `ecosystem` means UNKNOWN and matches
// every language, so every row this script fills can only remove a wrong
// cross-ecosystem match. It can never create a finding. What it CAN do is
// wrongly narrow an entity, which is why the host rule is confined to the kinds
// that are actually installed from a registry and why nothing here reads prose.
//
// Idempotent. A row already carrying a value is left alone unless `--force`,
// so a reviewer's correction survives every later run — the same discipline
// `backfillClaimDates.ts` keeps around an extracted date.
//
// Flags:
//   --dry-run          report what would change, write nothing
//   --force            recompute rows that already carry a value (union, so a
//                      hand-set registry is never dropped)
//   --kinds=a,b        restrict to these entity kinds (default: all)
//   --limit=N          stop after N candidate rows

const BATCH_SIZE = 500;

const arg = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];

// Only registry-host evidence is worth pulling out of the database: every other
// URL derives nothing, and the ledger's evidence table is far larger than its
// entity table. The hosts go down as a PARAMETER and the query extracts the URL's
// host and compares it — rather than being spliced into a pattern, which would
// mean escaping hostnames into a regex to reproduce a plain equality test the
// rule already does in TypeScript.
const registryHosts = Object.keys(REGISTRY_EVIDENCE_HOSTS);

type Row = {
  id: string;
  canonicalName: string;
  kind: LedgerEntityKind;
  aliases: string[];
  codeOnlyAliases: string[];
  ecosystem: LedgerEcosystem[];
  evidenceUrls: string[] | null;
};

const coverageByKind = (
  con: Awaited<ReturnType<typeof createOrGetConnection>>,
): Promise<{ kind: string; total: string; known: string }[]> =>
  con.query(/* sql */ `
    SELECT kind,
           count(*) AS total,
           count(*) FILTER (WHERE cardinality("ecosystem") > 0) AS known
      FROM ledger_entity
     GROUP BY kind
     ORDER BY count(*) DESC
  `);

(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const kinds = arg('kinds')
    ?.split(',')
    .map((kind) => kind.trim());
  const limit = arg('limit') ? parseInt(arg('limit') as string, 10) : undefined;

  const con = await createOrGetConnection();

  const before = await coverageByKind(con);
  console.log('coverage before:');
  console.table(
    before.map(({ kind, total, known }) => ({
      kind,
      total: Number(total),
      known: Number(known),
      pct: `${((Number(known) / Number(total)) * 100).toFixed(1)}%`,
    })),
  );

  const rows: Row[] = await con.query(
    /* sql */ `
    SELECT le.id,
           le."canonicalName",
           le.kind,
           le.aliases,
           le."codeOnlyAliases",
           le.ecosystem,
           array_agg(DISTINCT ce.url) FILTER (
             WHERE regexp_replace(
                     lower(substring(ce.url from '^https?://([^/?#]+)')),
                     '^www\\.', ''
                   ) = ANY($1::text[])
           ) AS "evidenceUrls"
      FROM ledger_entity le
      LEFT JOIN claim c ON c."entityId" = le.id
      LEFT JOIN claim_evidence ce ON ce."claimId" = c.id
     WHERE ($2::boolean OR cardinality(le.ecosystem) = 0)
       AND ($3::text[] IS NULL OR le.kind = ANY($3::text[]))
     GROUP BY le.id
     ORDER BY le.id ASC
     ${limit ? `LIMIT ${limit}` : ''}
  `,
    [registryHosts, force, kinds ?? null],
  );

  console.log(`${rows.length} entities to consider`);

  const changes: { id: string; ecosystem: LedgerEcosystem[] }[] = [];
  // kind -> registry -> count, so the report says WHERE the answers came from
  // rather than only how many there are.
  const tally = new Map<string, Map<string, number>>();
  const samples: Row[] = [];

  rows.forEach((row) => {
    const derived = deriveEcosystems({
      kind: row.kind,
      canonicalName: row.canonicalName,
      aliases: [...row.aliases, ...row.codeOnlyAliases],
      evidenceUrls: row.evidenceUrls ?? [],
    });

    // `--force` unions rather than replaces: a reviewer who set a registry by
    // hand knew something the two mechanical rules cannot see, and a recompute
    // must not be able to delete it.
    const ecosystem = force ? unionEcosystems(derived, row.ecosystem) : derived;

    if (
      !ecosystem.length ||
      (ecosystem.length === row.ecosystem.length &&
        ecosystem.every((value) => row.ecosystem.includes(value)))
    ) {
      return;
    }

    changes.push({ id: row.id, ecosystem });

    const byRegistry = tally.get(row.kind) ?? new Map<string, number>();
    ecosystem.forEach((registry) =>
      byRegistry.set(registry, (byRegistry.get(registry) ?? 0) + 1),
    );
    tally.set(row.kind, byRegistry);

    if (samples.length < 25) {
      samples.push(row);
    }
  });

  console.log(`${changes.length} entities would be filled`);
  console.table(
    [...tally.entries()].flatMap(([kind, byRegistry]) =>
      [...byRegistry.entries()].map(([registry, count]) => ({
        kind,
        registry,
        entities: count,
      })),
    ),
  );

  if (dryRun) {
    console.table(
      samples.map((row) => ({
        name: row.canonicalName.slice(0, 44),
        kind: row.kind,
        evidence: (row.evidenceUrls ?? []).length,
      })),
    );
    console.log('dry run: nothing written');
    process.exit(0);
  }

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = changes.slice(i, i + BATCH_SIZE);

    await con.transaction((manager) =>
      Promise.all(
        batch.map(({ id, ecosystem }) =>
          manager.getRepository(LedgerEntity).update({ id }, { ecosystem }),
        ),
      ),
    );

    console.log(
      `${Math.min(i + BATCH_SIZE, changes.length)}/${changes.length}`,
    );
  }

  const after = await coverageByKind(con);
  console.log('coverage after:');
  console.table(
    after.map(({ kind, total, known }) => ({
      kind,
      total: Number(total),
      known: Number(known),
      pct: `${((Number(known) / Number(total)) * 100).toFixed(1)}%`,
    })),
  );

  process.exit(0);
})();
