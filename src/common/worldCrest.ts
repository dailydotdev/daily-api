/**
 * The crest is the one piece of a personal world that travels — it is how a
 * stranger recognises whose world they are looking at before reading a word of
 * it. Its composition rule is the whole design:
 *
 *   CHARGE    — only from signature monuments the user has actually unlocked
 *   TINCTURES — only from the accents of districts the user actually founded
 *   DIVISION  — free, because a division is pure geometry and carries no fact
 *
 * So a crest is assembled entirely out of someone's reading and arranged
 * entirely by them, and a crest that lies is not constructible. That claim only
 * holds if the catalogue is re-derived HERE, at write time, from
 * `UserNicheAnalytics` — the client renders the same gate, but a client-side
 * gate is a suggestion once the mutation is public.
 */

import type { z } from 'zod';
import type { worldCrestSchema } from './schema/userWorld';
import { CREST_DIVISIONS } from './worldStyle';

/**
 * Per-niche art, keyed by `Niche.slug`. The renderer owns the rest of a
 * district's look (roofs, bloom, seeds); the API only needs the three fields a
 * crest can be built out of, so only those are duplicated here.
 *
 * Signatures are deliberately not unique — `android` and `ios_apple` both raise
 * a canopy walk — so a charge is legal when ANY qualifying district carries it.
 */
export const NICHE_CREST_ART: Record<
  string,
  { sig: string; accent: number; accent2: number }
> = {
  ai_llm: { sig: 'obelisk', accent: 0xd97efe, accent2: 0x887bf8 },
  ai_agents: { sig: 'roost', accent: 0x887bf8, accent2: 0x6ef2fe },
  ai_infra: { sig: 'conduit', accent: 0x6ef2fe, accent2: 0xd97efe },
  ml_ds: { sig: 'orrery', accent: 0xffe877, accent2: 0xffb794 },
  data_eng: { sig: 'aqueduct', accent: 0x7ba7ff, accent2: 0x6ef2fe },
  ai_safety: { sig: 'wardring', accent: 0xffed99, accent2: 0xd97efe },
  python: { sig: 'coil', accent: 0xcfffa8, accent2: 0xffe877 },
  js_ts: { sig: 'loom', accent: 0xffe877, accent2: 0xffb794 },
  css_design: { sig: 'loom', accent: 0xff879f, accent2: 0xd97efe },
  android: { sig: 'canopywalk', accent: 0x8af4a9, accent2: 0xcfffa8 },
  ios_apple: { sig: 'canopywalk', accent: 0xf5f6fa, accent2: 0x6ef2fe },
  jvm: { sig: 'greenhouse', accent: 0xffb794, accent2: 0xf57869 },
  dotnet: { sig: 'greenhouse', accent: 0xd97efe, accent2: 0x887bf8 },
  php: { sig: 'wellspring', accent: 0x887bf8, accent2: 0x7ba7ff },
  ruby: { sig: 'wellspring', accent: 0xf57869, accent2: 0xff879f },
  c_cpp: { sig: 'bigwheel', accent: 0x7ba7ff, accent2: 0x6ef2fe },
  rust: { sig: 'bigwheel', accent: 0xffb794, accent2: 0xffe877 },
  linux_os: { sig: 'anvilyard', accent: 0xffe877, accent2: 0xffb794 },
  embedded: { sig: 'crucible', accent: 0x8af4a9, accent2: 0xcfffa8 },
  gamedev: { sig: 'crucible', accent: 0xd97efe, accent2: 0xff879f },
  niche_langs: { sig: 'pipeorgan', accent: 0x6ef2fe, accent2: 0x887bf8 },
  k8s: { sig: 'drydock', accent: 0x7ba7ff, accent2: 0x6ef2fe },
  cloud: { sig: 'drydock', accent: 0xf5f6fa, accent2: 0x6ef2fe },
  go: { sig: 'containers', accent: 0x6ef2fe, accent2: 0xffe877 },
  ci_devex: { sig: 'crane', accent: 0x8af4a9, accent2: 0xcfffa8 },
  observability: { sig: 'lighthouse', accent: 0xd97efe, accent2: 0xffb794 },
  databases: { sig: 'containers', accent: 0xffb794, accent2: 0xffe877 },
  distributed_arch: { sig: 'crane', accent: 0x887bf8, accent2: 0xd97efe },
  selfhost: { sig: 'lighthouse', accent: 0xffe877, accent2: 0xffb794 },
  sec_appsec: { sig: 'keep', accent: 0x7ba7ff, accent2: 0x6ef2fe },
  sec_crypto: { sig: 'vault', accent: 0xffe877, accent2: 0xfff3b7 },
  sec_threats: { sig: 'watchfire', accent: 0xffb794, accent2: 0xf57869 },
  devtools: { sig: 'workshop', accent: 0x6ef2fe, accent2: 0x7ba7ff },
  git_vcs: { sig: 'library', accent: 0xffb794, accent2: 0xffe877 },
  software_craft: { sig: 'workshop', accent: 0xff879f, accent2: 0xd97efe },
  cs_fundamentals: { sig: 'library', accent: 0x887bf8, accent2: 0xd97efe },
  career: { sig: 'clocktower', accent: 0x8af4a9, accent2: 0xcfffa8 },
  eng_mgmt: { sig: 'clocktower', accent: 0x7ba7ff, accent2: 0x887bf8 },
  industry_news: { sig: 'market', accent: 0xffe877, accent2: 0xffb794 },
  other: { sig: 'market', accent: 0xf5f6fa, accent2: 0xffe877 },
};

/**
 * Reads at which a district reaches L3 (CAMP) — the level whose art note is
 * "the district's signature motif appears". Below it there is no monument to
 * put on a shield, so there is no charge to claim.
 */
export const CREST_CHARGE_MIN_READS = 3;

type Crest = z.infer<typeof worldCrestSchema>;

/** A district as the crest rules see it: which niche, and how much read. */
export type CrestDistrict = { slug: string; reads: number };

/** Fallbacks for a world with nothing in it yet — brand violet on off-white. */
const FALLBACK_CHARGE = 'obelisk';
const FALLBACK_A = 0xba56e1;
const FALLBACK_B = 0xf5f6fa;

/**
 * What this world is entitled to fly. Districts below L3 have not raised a
 * monument, but a crest with no charge is not a crest — so when nothing is
 * earned yet the oldest district lends its own.
 *
 * `districts` is expected largest-first; the caller already orders by reads.
 */
export const earnedCharges = (districts: CrestDistrict[]): string[] => {
  const out: string[] = [];
  for (const { slug, reads } of districts) {
    const art = NICHE_CREST_ART[slug];
    if (art && reads >= CREST_CHARGE_MIN_READS && !out.includes(art.sig)) {
      out.push(art.sig);
    }
  }
  if (out.length) {
    return out;
  }
  const first = districts.find(({ slug }) => NICHE_CREST_ART[slug]);
  return [first ? NICHE_CREST_ART[first.slug].sig : FALLBACK_CHARGE];
};

/**
 * Both accents of every founded district. Founding is the only gate — a colour
 * is not a monument, so it does not wait for L3.
 */
export const earnedTinctures = (districts: CrestDistrict[]): number[] => {
  const out: number[] = [];
  for (const { slug } of districts) {
    const art = NICHE_CREST_ART[slug];
    if (!art) {
      continue;
    }
    for (const colour of [art.accent, art.accent2]) {
      if (!out.includes(colour)) {
        out.push(colour);
      }
    }
  }
  return out.length ? out : [FALLBACK_A, FALLBACK_B];
};

/**
 * Every world flies a crest from day one, derived the same way every name is:
 * the largest district gives the charge, the top two give the tinctures, and
 * the division comes off the user id — so the suggestion is already personal
 * and the user's job is to disagree with it rather than to invent one.
 */
export const defaultCrest = ({
  userId,
  districts,
}: {
  userId: string;
  districts: CrestDistrict[];
}): Crest => {
  const ranked = districts.filter(({ slug }) => NICHE_CREST_ART[slug]);
  const top = ranked[0];
  const second = ranked[1] || top;
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return {
    charge: top ? NICHE_CREST_ART[top.slug].sig : FALLBACK_CHARGE,
    div: CREST_DIVISIONS[hash % CREST_DIVISIONS.length],
    a: top ? NICHE_CREST_ART[top.slug].accent : FALLBACK_A,
    b: second ? NICHE_CREST_ART[second.slug].accent : FALLBACK_B,
  };
};
