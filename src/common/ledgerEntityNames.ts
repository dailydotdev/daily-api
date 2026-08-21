import type { DataSource, EntityManager } from 'typeorm';
import { LedgerEntity } from '../entity/claim/LedgerEntity';
import { ONE_HOUR_IN_SECONDS } from './constants';

// Punctuation carries no signal across the two vocabularies being compared —
// a statement writes `Node.js`, an entity is named "Node.js", a plan writes
// "nodejs" — so the match key drops it entirely.
export const normalizeSignatureToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

// Prose names of every ledger entity: the canonical name unless it is
// code-only, plus every alias. `codeOnlyAliases` are excluded on purpose —
// those ARE code tokens (`browser_toolset_20260801`), and a claim naming one
// is naming a real surface.
//
// Why signatures reject these: a signature is matched by exact equality
// against a plan, and Tier A is meant to say "your code touches the thing
// that changed". A token that merely repeats a technology's name says
// "your plan mentions this technology" — which the entity tiers already say,
// version-gated and therefore more precisely. Emitting it as a signature adds
// no reach and fires on every plan that names the technology at all.
//
// Measured on production 2026-08-21: 1,103 distinct signature tokens were
// exactly an entity name — "Claude Code", "Python 3.10", "React 19", "Redis",
// "Docker" among the most repeated. This is the same failure as the generic
// word list one layer up, where the token is specific but still not a surface.
let cached: { names: Set<string>; loadedAt: number } | null = null;

export const loadProseEntityNames = async (
  con: DataSource | EntityManager,
): Promise<Set<string>> => {
  if (cached && Date.now() - cached.loadedAt < ONE_HOUR_IN_SECONDS * 1000) {
    return cached.names;
  }

  const rows = await con
    .getRepository(LedgerEntity)
    .createQueryBuilder('le')
    .select('le."canonicalName"', 'canonicalName')
    .addSelect('le.aliases', 'aliases')
    .addSelect('le."codeOnlyCanonical"', 'codeOnlyCanonical')
    .getRawMany<{
      canonicalName: string;
      aliases: string[];
      codeOnlyCanonical: boolean;
    }>();

  const names = new Set<string>();

  rows.forEach(({ canonicalName, aliases, codeOnlyCanonical }) => {
    [...(codeOnlyCanonical ? [] : [canonicalName]), ...(aliases ?? [])].forEach(
      (name) => {
        const normalized = normalizeSignatureToken(name);

        // Two characters cannot identify anything on its own, and the
        // specificity bar already rejects such a token on its own terms.
        if (normalized.length > 2) {
          names.add(normalized);
        }
      },
    );
  });

  cached = { names, loadedAt: Date.now() };

  return names;
};

export const clearProseEntityNameCache = (): void => {
  cached = null;
};
