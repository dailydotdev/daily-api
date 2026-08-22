import '../src/config';
import createOrGetConnection from '../src/db';
import {
  LedgerEcosystem,
  LedgerEntity,
  LedgerEntityKind,
} from '../src/entity/claim/LedgerEntity';
import { AnthropicClient } from '../src/integrations/anthropic';
import { normalizeEcosystems } from '../src/common/ledgerEcosystem';

// The judgement half of the ecosystem backfill, for the entities the mechanical
// one cannot reach — and it cannot reach most of them. Measured on the
// 2026-08-22 prod ledger, `bin/backfillEntityEcosystems.ts` fills 13.7% of
// `package` entities, essentially all of it from coordinate shapes: ledger
// evidence is blog posts, not registry pages. The collisions the column exists
// for live precisely in what is left, because they are BARE NAMES — Ecto is
// filed as `Ecto`, not `hex.pm/ecto`; `MCP`, `json` and `requests` likewise. No
// shape rule will ever see them.
//
// So this asks a model the one question a reviewer would ask, and it is a
// LOOKUP, not an inference from prose: "which registry is this artifact
// published on". Playbook E12's prohibition is on reading the registry out of a
// statement's language talk; it is not a prohibition on knowing what PyPI
// contains.
//
// The whole design is abstention. A wrong registry silently deletes real
// findings for that entity in a channel nobody watches, while unknown costs
// nothing — so the tool has an explicit `unknown` value, the prompt spends more
// words on when to use it than on anything else, and any answer outside the
// closed vocabulary is dropped rather than coerced.
//
// NOT STAMPED, unlike `backfillClaimSignatures.ts`. An entity that comes back
// unknown stays selectable, so a re-run pays for it again. That is deliberate:
// a stamp column for a one-off pass is more schema than the ~$2 it saves, and
// the population only shrinks. Use `--limit` to bound a run.
//
// Flags:
//   --dry-run          report what would change, write nothing
//   --limit=N          stop after N entities (default: all)
//   --kinds=a,b        default: package,runtime
//   --model=id         default: claude-sonnet-4-6

const BATCH_SIZE = 40;
const CONCURRENCY = 4;

const arg = (name: string): string | undefined =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];

const ECOSYSTEM_TOOL = {
  name: 'record_ecosystems',
  description:
    'Record the package registry each listed artifact is published on.',
  input_schema: {
    type: 'object',
    properties: {
      answers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer' },
            registry: {
              type: 'string',
              enum: [...Object.values(LedgerEcosystem), 'unknown'],
            },
          },
          required: ['i', 'registry'],
        },
      },
    },
    required: ['answers'],
  },
};

const SYSTEM_PROMPT = `You are given a numbered list of software artifacts from a change ledger. For each one, name the
package registry it is PUBLISHED ON, or say \`unknown\`.

<registries>
npm, pypi, rubygems, go, crates, maven, packagist, hex, nuget, pub. Nothing else exists — an artifact
published somewhere not on this list is \`unknown\`.
</registries>

<answer_unknown>
\`unknown\` is the right answer far more often than it feels like, and it is FREE. A wrong registry
permanently hides real results for that artifact and nobody will ever see that it happened. Answer
\`unknown\` whenever any of these is true, and do not talk yourself out of any of them:

- You do not recognise the artifact, or you recognise the NAME but are not certain this row is that
  thing. The claims quoted with each row are what this row is about — read them.
- The name exists on more than one registry and the claims do not settle which. \`json\`, \`requests\`,
  \`mcp\`, \`ecto\`, \`redis\`, \`parser\` are all several different packages on several registries.
- It is not distributed through a package registry at all: a hosted service, an API, a spec, a
  standard, a website, a model, a desktop application, a protocol, a company.
- It is a runtime, compiler or language distributed by its own project rather than through a registry
  (Node.js, Python, Go the language, Ruby, .NET). The registry a language INSTALLS FROM is not the
  registry the language itself is published on — if the row is the language, that is \`unknown\`.
- It is a first-party binary or a container image.
- You would be reasoning from "this is written in X, so it is probably on X's registry". That is a
  guess about a language, not knowledge about a registry.

You may not answer \`unknown\` for the reason that the artifact is obscure but its coordinate is
unambiguous — \`@scope/name\` is npm, a \`vendor/package\` on Packagist is packagist.
</answer_unknown>

<answer_confidently>
Answer when you know the artifact and one registry is the obvious place someone installs it from:
Django is pypi, Rails is rubygems, Ecto is hex, serde is crates, Guzzle is packagist, Jackson is
maven, Newtonsoft.Json is nuget, riverpod is pub, cobra is go, Express is npm.
</answer_confidently>

Return one entry per row, using the row's index. Rows you are not sure about get \`unknown\`.`;

type Row = {
  id: string;
  canonicalName: string;
  kind: LedgerEntityKind;
  aliases: string[];
  claims: string[] | null;
  claimCount: string;
};

const REGISTRIES = new Set<string>(Object.values(LedgerEcosystem));

const askBatch = async ({
  client,
  model,
  batch,
}: {
  client: AnthropicClient;
  model: string;
  batch: Row[];
}): Promise<Map<string, LedgerEcosystem>> => {
  const rendered = batch
    .map((row, i) => {
      const aliases = row.aliases?.length
        ? ` aliases: ${row.aliases.slice(0, 4).join(', ')}`
        : '';
      const claims = (row.claims ?? [])
        .slice(0, 2)
        .map((claim) => `\n     claim: ${claim.slice(0, 180)}`)
        .join('');

      return `${i}. ${row.canonicalName} [kind: ${row.kind}]${aliases}${claims}`;
    })
    .join('\n');

  const response = await client.createMessage({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: rendered }],
    tools: [ECOSYSTEM_TOOL],
    tool_choice: { type: 'tool', name: ECOSYSTEM_TOOL.name },
  });

  const input = (response.content?.find(({ input }) => !!input)?.input ??
    {}) as {
    answers?: { i?: number; registry?: string }[];
  };
  const resolved = new Map<string, LedgerEcosystem>();

  (Array.isArray(input.answers) ? input.answers : []).forEach(
    ({ i, registry }) => {
      const row = typeof i === 'number' ? batch[i] : undefined;

      // Anything outside the closed vocabulary — `unknown`, a hallucinated
      // registry, an out-of-range index — is dropped rather than coerced. There
      // is no repair that is better than leaving the entity unknown.
      if (!row || !registry || !REGISTRIES.has(registry)) {
        return;
      }

      resolved.set(row.id, registry as LedgerEcosystem);
    },
  );

  return resolved;
};

(async (): Promise<void> => {
  const dryRun = process.argv.includes('--dry-run');
  const limit = arg('limit') ? parseInt(arg('limit') as string, 10) : undefined;
  const model = arg('model') ?? 'claude-sonnet-4-6';
  const kinds = arg('kinds')
    ?.split(',')
    .map((kind) => kind.trim()) ?? [
    LedgerEntityKind.Package,
    LedgerEntityKind.Runtime,
  ];

  const apiKey = process.env.AGENT_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('AGENT_ANTHROPIC_API_KEY is not configured');
  }

  const con = await createOrGetConnection();
  const client = new AnthropicClient(apiKey);

  // Most-claimed first. An entity with claims is an entity the detector can
  // actually fire on, and a run stopped by `--limit` should have spent its
  // money on those rather than on the one-claim tail.
  const rows: Row[] = await con.query(
    /* sql */ `
    SELECT le.id,
           le."canonicalName",
           le.kind,
           le.aliases,
           count(c.id) AS "claimCount",
           (array_agg(c.statement ORDER BY c."createdAt" DESC)
              FILTER (WHERE c.statement IS NOT NULL))[1:2] AS claims
      FROM ledger_entity le
      LEFT JOIN claim c ON c."entityId" = le.id
     WHERE cardinality(le.ecosystem) = 0
       AND le.kind = ANY($1::text[])
     GROUP BY le.id
     ORDER BY count(c.id) DESC, le.id ASC
     ${limit ? `LIMIT ${limit}` : ''}
  `,
    [kinds],
  );

  console.log(`${rows.length} entities without a registry on ${model}`);

  if (!rows.length) {
    process.exit(0);
  }

  const resolved = new Map<string, LedgerEcosystem>();
  let asked = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE * CONCURRENCY) {
    const slice = rows.slice(i, i + BATCH_SIZE * CONCURRENCY);
    const batches: Row[][] = [];

    for (let j = 0; j < slice.length; j += BATCH_SIZE) {
      batches.push(slice.slice(j, j + BATCH_SIZE));
    }

    const settled = await Promise.all(
      batches.map(async (batch) => {
        try {
          return await askBatch({ client, model, batch });
        } catch (err) {
          // One bad batch must not end a run that has already paid for the
          // rest; the entities in it simply stay unknown, which is safe.
          failed += batch.length;
          console.error(
            `  batch failed: ${(err as Error).message.slice(0, 140)}`,
          );

          return new Map<string, LedgerEcosystem>();
        }
      }),
    );

    settled.forEach((answers) =>
      answers.forEach((registry, id) => resolved.set(id, registry)),
    );
    asked += slice.length;
    console.log(
      `${asked}/${rows.length} asked, ${resolved.size} answered, ${failed} in failed batches`,
    );
  }

  const byRegistry = new Map<string, number>();
  resolved.forEach((registry) =>
    byRegistry.set(registry, (byRegistry.get(registry) ?? 0) + 1),
  );
  console.table(
    [...byRegistry.entries()].map(([registry, entities]) => ({
      registry,
      entities,
    })),
  );
  console.log(
    `${resolved.size} of ${rows.length} answered (${(
      (resolved.size / rows.length) *
      100
    ).toFixed(1)}%), the rest stay unknown`,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));

  if (dryRun) {
    console.table(
      [...resolved.entries()].slice(0, 40).map(([id, registry]) => ({
        name: byId.get(id)?.canonicalName.slice(0, 40),
        kind: byId.get(id)?.kind,
        claims: Number(byId.get(id)?.claimCount ?? 0),
        registry,
      })),
    );
    console.log('dry run: nothing written');
    process.exit(0);
  }

  const entries = [...resolved.entries()];

  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);

    await con.transaction((manager) =>
      Promise.all(
        batch.map(([id, registry]) =>
          manager
            .getRepository(LedgerEntity)
            .createQueryBuilder()
            .update()
            .set({ ecosystem: normalizeEcosystems([registry]) })
            // Guarded on still being empty: a reviewer or the mechanical pass
            // may have filled the row while this run was in flight, and a
            // derived answer outranks a recalled one.
            .where('id = :id AND cardinality(ecosystem) = 0', { id })
            .execute(),
        ),
      ),
    );

    console.log(
      `${Math.min(i + 500, entries.length)}/${entries.length} written`,
    );
  }

  process.exit(0);
})();
