import { AnthropicClient } from '../integrations/anthropic';
import { ClaimChangeType, type Claim } from '../entity/claim/Claim';
import { isTooGenericToEmit } from './signatureSpecificity';
import { normalizeSignatureToken as normalize } from './ledgerEntityNames';

// Where a signature changes what a reader does. `release` and `new_capability`
// are two thirds of the ledger and make nothing stale — measured at 0/45 and
// 1/49 fill in production — so they are not worth the call, and a claim of
// those types staying unstamped forever is the correct end state rather than a
// backlog. Anything counting "how much of the ledger still needs signatures"
// has to filter on this, or it measures a population that never shrinks.
export const SIGNABLE_CHANGE_TYPES = [
  ClaimChangeType.Breaking,
  ClaimChangeType.Deprecation,
  ClaimChangeType.Removal,
  ClaimChangeType.Displacement,
  ClaimChangeType.Security,
  ClaimChangeType.Gotcha,
  ClaimChangeType.Fix,
];

// Kept byte-identical to bragi/prompting/claim_signatures.py, which is the copy
// eval/claims/run_statement_signatures.py measures. They are duplicated because
// this runs once from a script and bragi is where production prompts live; if
// either changes, the other has to change with it and the eval has to be re-run,
// or we are shipping a prompt nobody has measured.
export const CLAIM_SIGNATURES_SYSTEM_PROMPT = `You are given one claim from a change ledger: a single sentence stating what changed about one
technology. Extract the literal code tokens it names, split by what the change does to them.

<tokens>
- A token is what a developer types: \`forms.URLField\`, \`next/legacy/image\`, \`std::not1\`,
  \`claude-sonnet-4-5-20250929\`, \`--legacy-peer-deps\`, \`POST /v1/completions\`, \`experimental.appDir\`.
- Never a version number on its own, never prose, never the entity's own name — those are carried
  by other fields and repeating them here only creates false matches.
- Copy character-for-character from the statement. A token you completed, expanded, corrected, or
  inferred from your own knowledge is worse than no token: these are matched by equality, so an
  invented one becomes a false accusation against working code. If it is not written in the
  statement, it does not exist.
</tokens>

<polarity>
- \`affected\` is the token a reader has in their own code and would want to be told about. That is
  broader than what the change takes away: a fix, a gotcha, a security advisory and a new constraint
  all name a symbol that still exists, and that symbol is the only way a reader ever finds the claim
  — "search_field raises NameError when passed autosave: true" puts \`search_field\` in affected even
  though nothing was removed.
- \`superseding\` is what replaces it, and is therefore the current, correct choice.
- When one sentence names both sides — "deprecated in favor of X", "replaced by Y", "renamed to Z",
  "use X instead" — fill both lists. A displacement whose replacement the statement spells out and
  whose superseding comes back empty has dropped the half the reader actually needs.
- Filing a replacement under \`affected\` would flag a reader for doing the right thing, so leave out
  the one token you cannot place — never both sides because one of them was unclear.
</polarity>

<empty>
Two empty lists are for a claim with no code surface at all: a pricing round, a service outage, a
product or model announced with no API name attached. Never invent a token to fill them, and never
return empty because the claim only names a symbol that still works.
</empty>

Return only valid JSON matching the schema exactly — no reasoning, preamble, or extra keys.`;

const SIGNATURE_TOOL = {
  name: 'record_signatures',
  description: 'Record the literal code tokens the claim names.',
  input_schema: {
    type: 'object',
    properties: {
      affected: { type: 'array', items: { type: 'string' }, maxItems: 10 },
      superseding: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    },
    required: ['affected', 'superseding'],
  },
};

export type ClaimSignatures = { affected: string[]; superseding: string[] };

// A CVE identifier names an advisory, not anything a reader has in their code.
// It cannot match a plan and only widens the surface a detector scans.
const CVE = /^cve-\d{4}-\d{4,}$/i;

// A token that is not in the statement cannot have been copied from it, so it
// was invented — the failure mode that turns a signature into a false
// accusation against working code. Dropped here rather than trusted.
const grounded = (tokens: unknown, statement: string): string[] => {
  if (!Array.isArray(tokens)) {
    return [];
  }

  const haystack = statement.toLowerCase();

  return tokens
    .filter((token): token is string => typeof token === 'string')
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.length <= 200)
    .filter((token) => haystack.includes(token.toLowerCase()))
    .slice(0, 10);
};

export const extractClaimSignatures = async ({
  client,
  model,
  claim,
  entityName,
  entityAliases = [],
  proseEntityNames,
}: {
  client: AnthropicClient;
  model: string;
  claim: Pick<Claim, 'statement' | 'changeType'>;
  entityName: string;
  entityAliases?: string[];
  proseEntityNames?: Set<string>;
}): Promise<ClaimSignatures> => {
  const response = await client.createMessage({
    model,
    max_tokens: 512,
    system: CLAIM_SIGNATURES_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `<claim>\n<entity>${entityName}</entity>\n<change_type>${claim.changeType}</change_type>\n<statement>${claim.statement}</statement>\n</claim>\n\nExtract only tokens written in the statement above.`,
      },
    ],
    tools: [SIGNATURE_TOOL],
    tool_choice: { type: 'tool', name: SIGNATURE_TOOL.name },
  });

  const input = response.content?.find(({ input }) => !!input)?.input ?? {};
  // The entity is already on the claim, and a token repeating it matches every
  // plan that mentions the technology at all rather than the change — the
  // prompt says so, and this makes it true. `proseEntityNames` widens the same
  // rule to every entity the ledger knows: "Couchbase" on a Spring AI claim is
  // no more a code surface than "Spring AI" would be, and it fires on every
  // plan that mentions Couchbase for any reason.
  const entityNames = new Set([
    ...[entityName, ...entityAliases].map(normalize).filter(Boolean),
    ...(proseEntityNames ?? []),
  ]);
  // The specificity bar (playbook §13 v5.9): matching is exact-equality, so a
  // generic token like "name" accuses every codebase on earth. When a change's
  // only symbol is generic, empty is correct — the claim still fires through
  // its entity at the detector's lower tiers.
  const usable = (tokens: string[]): string[] =>
    tokens.filter(
      (token) =>
        !CVE.test(token) &&
        !entityNames.has(normalize(token)) &&
        !isTooGenericToEmit(token),
    );

  const affected = usable(grounded(input.affected, claim.statement));
  const superseding = usable(grounded(input.superseding, claim.statement));
  // A token on both sides says the reader should both stop and keep using it.
  // Whichever side was meant, the pair carries no information and one half of
  // it would flag someone for making the current choice.
  const contradictory = new Set(
    affected
      .map(normalize)
      .filter((token) => superseding.map(normalize).includes(token)),
  );

  return {
    affected: affected.filter((token) => !contradictory.has(normalize(token))),
    superseding: superseding.filter(
      (token) => !contradictory.has(normalize(token)),
    ),
  };
};
