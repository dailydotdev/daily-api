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
// that changed". A multi-word technology name says "your plan mentions this
// technology" instead — which the entity tiers already say, version-gated and
// therefore more precisely.
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

// A signature token is rejected only when it is BOTH a known technology name
// and a multi-word phrase. The two halves are load-bearing together:
//
// - Single-word entity names are frequently real code surfaces. `esbuild`,
//   `curl`, `minimatch` and `Vitest` are what a package.json pins;
//   `encoding/json/v2` and `System.Text.Json` are what a file imports;
//   `GPT-5.3-Codex` is what a request body sets. Dropping those would delete
//   real signal, which is the same reason the specificity bar deliberately
//   leaves bare lowercase words alone and lets the detector gate the match on
//   the claim's entity being resolved in the same input.
// - A name with a space in it cannot be a lexical token. Nothing imports
//   "React Server Components" or pins "Swift Package Manager"; a plan that
//   contains those strings is describing the technology in prose, which is
//   precisely what Tier A is not for.
//
// Measured on production 2026-08-21: 434 tokens across 397 claims — "Claude
// Code", "Responses API", "Jetpack Compose", "Gemini 3.5 Flash", "Opus 4.6".
// Widening it to single-word names would have taken 1,738 tokens, and the
// sample showed the extra 1,304 were mostly package names and import paths.
export const isEntityPhrase = (token: string, names: Set<string>): boolean =>
  /\s/.test(token) && names.has(normalizeSignatureToken(token));
