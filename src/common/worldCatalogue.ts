import type { z } from 'zod';
import type { worldCrestSchema } from './schema/userWorld';

/**
 * What a world is allowed to be dressed with, and why.
 *
 * The catalogue is deliberately NOT a property of the niche taxonomy. Reading is
 * one source of entitlements and the first one, but a charge is an item rather
 * than a fact about a subject — so anything else that grants items later
 * (achievements, seasons, events) becomes another source without this model
 * moving, and without the crest having to mean "a monument I raised".
 *
 * Every entitlement carries the source that granted it, which is what keeps the
 * mark legible as the sources multiply: a charge unlocked by reading says so,
 * and a charge everybody starts with says that instead of quietly implying a
 * monument nobody raised.
 */

export enum WorldEntitlementKind {
  Charge = 'charge',
  Tincture = 'tincture',
}

/**
 * Granted to everyone, so a world with no reading behind it still has a mark to
 * fly. `base` is also where non-reading customisations will land.
 */
export const BASE_SOURCE = 'base';

export type WorldEntitlement = {
  kind: WorldEntitlementKind;
  /** A charge signature, or a tincture as `#rrggbb`. */
  id: string;
  /** `base`, or `niche:<slug>` — why this world has it. */
  source: string;
};

/**
 * Per-niche grants, keyed by `Niche.slug`. The renderer owns the rest of a
 * district's look; only what a crest can be built out of is duplicated here.
 *
 * Signatures are deliberately not unique — `android` and `ios_apple` both raise
 * a canopy walk — so a charge is granted when ANY qualifying district carries it.
 *
 * A slug missing from this table grants nothing. That is a real gap when the
 * taxonomy grows, but it is a silent one rather than a wrong one: the user keeps
 * their base entitlements instead of being handed another subject's monument.
 */
export const NICHE_GRANTS: Record<
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
 * "the district's signature motif appears". Below it there is no monument to put
 * on a shield, so reading has granted no charge yet.
 */
export const CREST_CHARGE_MIN_READS = 3;

/**
 * Grants nobody has to earn.
 *
 * Empty, and that is the point: a reader of nothing is not entitled to a crest.
 * A mark that everybody starts with is not a mark — it says nothing about whose
 * world it is flying over, which is the only job a crest has.
 *
 * The arrays stay because this is where non-reading grants land when they
 * arrive. Anything added here becomes available to every world at once, so it
 * wants to be a deliberate act rather than a default.
 */
export const BASE_CHARGES: readonly string[] = [];

export const BASE_TINCTURES: readonly number[] = [];

export type Crest = z.infer<typeof worldCrestSchema>;

/** A district as the catalogue sees it: which niche, and how much read. */
export type CrestDistrict = { slug: string; reads: number };

/** Tinctures travel as `#rrggbb`, so every entitlement id is one type. */
export const toTinctureId = (colour: number): string =>
  `#${colour.toString(16).padStart(6, '0')}`;

/**
 * Everything this world may be dressed with.
 *
 * Reading is resolved BEFORE the base grants, so a charge that is both earned
 * and universal reports the earned source: an LLM reader's obelisk says
 * `niche:ai_llm`, everybody else's says `base`.
 *
 * `districts` is expected largest-first; the caller already orders by reads.
 */
export const resolveEntitlements = (
  districts: CrestDistrict[],
): WorldEntitlement[] => {
  const out: WorldEntitlement[] = [];
  const seen = new Set<string>();
  const grant = (kind: WorldEntitlementKind, id: string, source: string) => {
    const key = `${kind}:${id}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ kind, id, source });
    }
  };

  for (const { slug, reads } of districts) {
    const art = NICHE_GRANTS[slug];
    if (!art) {
      continue;
    }
    const source = `niche:${slug}`;
    if (reads >= CREST_CHARGE_MIN_READS) {
      grant(WorldEntitlementKind.Charge, art.sig, source);
    }
    // A colour is not a monument, so founding is the only gate on a tincture.
    grant(WorldEntitlementKind.Tincture, toTinctureId(art.accent), source);
    grant(WorldEntitlementKind.Tincture, toTinctureId(art.accent2), source);
  }

  for (const charge of BASE_CHARGES) {
    grant(WorldEntitlementKind.Charge, charge, BASE_SOURCE);
  }
  for (const tincture of BASE_TINCTURES) {
    grant(WorldEntitlementKind.Tincture, toTinctureId(tincture), BASE_SOURCE);
  }

  return out;
};

/**
 * Reject a crest this world is not entitled to.
 *
 * The division is not checked because a division encodes nothing — it is the one
 * axis where taste is allowed to be taste.
 */
export const assertCrestEntitled = ({
  crest,
  entitlements,
}: {
  crest: Pick<Crest, 'charge' | 'a' | 'b'>;
  entitlements: WorldEntitlement[];
}): string | null => {
  const held = (kind: WorldEntitlementKind, id: string) =>
    entitlements.some((item) => item.kind === kind && item.id === id);

  if (!isCrestEligible(entitlements)) {
    return 'this world has not raised anything to put on a crest';
  }
  if (!held(WorldEntitlementKind.Charge, crest.charge)) {
    return `charge "${crest.charge}" is not available to this world`;
  }
  for (const [key, colour] of [
    ['a', crest.a],
    ['b', crest.b],
  ] as const) {
    if (!held(WorldEntitlementKind.Tincture, toTinctureId(colour))) {
      return `tincture "${key}" is not available to this world`;
    }
  }
  return null;
};

/**
 * Whether this world may fly a crest at all.
 *
 * Eligibility is having raised something. There is no derived starter crest and
 * no default charge to stand in — a world with nothing behind it simply has no
 * mark, and an empty shield is the honest answer rather than a poor one.
 */
export const isCrestEligible = (entitlements: WorldEntitlement[]): boolean =>
  entitlements.some(({ kind }) => kind === WorldEntitlementKind.Charge);
