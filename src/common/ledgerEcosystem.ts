// Which package registry an entity is installed from — the mechanical half of
// rot-bench README "Known gaps" item 1, whose measured symptom is that the
// single largest collision class in the grader is a cross-ecosystem homonym:
// Ecto's `update_all` matching Active Record, an Elixir `MCP` namespace
// matching the MCP Ruby gem, Hugo's template `os.Stat` matching Go's,
// Python's `import json` matching the Ruby `json` gem.
//
// The contract, and it is the whole reason this column can be shipped
// half-populated: `ecosystem` EMPTY means UNKNOWN and matches everything. A
// non-empty value can only ever REMOVE a match, never add one, so filling the
// column is monotone — no backfill row can turn a true finding false.
//
// Two rules and nothing else, because the value has to be derivable without
// judgement or it is not worth having:
//
//   1. `ecosystemsFromName`  — the identifier's own SHAPE. `@scope/name` is an
//      npm coordinate, `github.com/x/y` is a Go module path, `package:x` is a
//      pub coordinate, `com.group:artifact` is a Maven one. These are not
//      guesses; they are the syntax of the registry that mints them.
//   2. `ecosystemsFromEvidenceUrl` — the HOST of a cited evidence URL, against
//      a closed exact-match table of registry hosts.
//
// Deliberately absent: anything read out of language prose. "a Python library"
// in a statement is not a registry, a package can be described in a language it
// is not written in, and a wrong ecosystem is strictly worse than none —
// unknown loses nothing while wrong silently deletes real findings.
import {
  LedgerEcosystem,
  LedgerEntityKind,
} from '../entity/claim/LedgerEntity';

// Registry hosts, exact after stripping a leading `www.`. Closed on purpose: a
// pattern like /npm/ would take `blog.npmjs.wtf` with it, and a host table is
// only defensible while every row names a registry someone publishes to.
//
// SYNC NOTE: this map is duplicated in the entity writers — smith
// (`smith/…/ledger_ecosystem.py`) and bragi (`bragi/ledger/ecosystem.py`) —
// following the same four-copy discipline as the signature specificity bar
// (playbook §13). daily-api is the canonical copy; a host added here has to be
// added there in the same change.
export const REGISTRY_EVIDENCE_HOSTS: Readonly<
  Record<string, LedgerEcosystem>
> = {
  'registry.npmjs.org': LedgerEcosystem.Npm,
  'npmjs.org': LedgerEcosystem.Npm,
  'npmjs.com': LedgerEcosystem.Npm,
  'pypi.org': LedgerEcosystem.Pypi,
  'files.pythonhosted.org': LedgerEcosystem.Pypi,
  'rubygems.org': LedgerEcosystem.RubyGems,
  'pkg.go.dev': LedgerEcosystem.Go,
  'proxy.golang.org': LedgerEcosystem.Go,
  'crates.io': LedgerEcosystem.Crates,
  'docs.rs': LedgerEcosystem.Crates,
  'hex.pm': LedgerEcosystem.Hex,
  'hexdocs.pm': LedgerEcosystem.Hex,
  'packagist.org': LedgerEcosystem.Packagist,
  'nuget.org': LedgerEcosystem.NuGet,
  'pub.dev': LedgerEcosystem.Pub,
  'mvnrepository.com': LedgerEcosystem.Maven,
  'search.maven.org': LedgerEcosystem.Maven,
  'repo1.maven.org': LedgerEcosystem.Maven,
  'central.sonatype.com': LedgerEcosystem.Maven,
};

// An npm coordinate: `@scope/name`. No other registry mints a leading `@`.
const NPM_SCOPED = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/;

// A Go module path: a HOST (a dotted label) followed by at least one path
// segment — `github.com/x/y`, `golang.org/x/net`, `k8s.io/api`,
// `gopkg.in/yaml.v3`. The dotted first segment is what makes this a module
// path rather than a Packagist `vendor/package`, which is why a bare `x/y`
// derives nothing here: it is a Composer coordinate, a GitHub slug and a
// RubyGems namespace all at once, and only the evidence host can separate them.
const GO_MODULE_PATH = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+\/[a-z0-9._~/-]+$/;

// A pub coordinate as `pubspec.yaml` and `dart pub add` write it.
const PUB_PACKAGE = /^package:[a-z_][a-z0-9_]*$/;

// A Maven coordinate: a dotted groupId, a colon, an artifactId. Checked after
// PUB_PACKAGE, whose `package` groupId carries no dot and so cannot collide.
const MAVEN_COORDINATE =
  /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+:[A-Za-z0-9][A-Za-z0-9._-]*$/;

// The registry a single identifier names by its own syntax. Applies to an
// entity of ANY kind: the shape IS the coordinate, so a `service` entity named
// `@scope/pkg` is as npm as a `package` one.
export const ecosystemsFromName = (name: string): LedgerEcosystem[] => {
  const value = name.trim();

  if (NPM_SCOPED.test(value)) {
    return [LedgerEcosystem.Npm];
  }

  if (PUB_PACKAGE.test(value)) {
    return [LedgerEcosystem.Pub];
  }

  if (MAVEN_COORDINATE.test(value)) {
    return [LedgerEcosystem.Maven];
  }

  if (GO_MODULE_PATH.test(value)) {
    return [LedgerEcosystem.Go];
  }

  return [];
};

// The registry a cited URL's host names, or none. Anything unparseable is none
// — a malformed evidence row must not become a wrong ecosystem.
export const ecosystemsFromEvidenceUrl = (url: string): LedgerEcosystem[] => {
  let host: string;

  try {
    host = new URL(url.trim()).hostname.toLowerCase();
  } catch {
    return [];
  }

  const registry = REGISTRY_EVIDENCE_HOSTS[host.replace(/^www\./, '')];

  return registry ? [registry] : [];
};

// The kinds that ARE installed from a registry, and therefore the only kinds
// whose evidence host is allowed to speak for them. A `spec`, `api` or
// `concept` entity is not a registry artifact: a claim about the OAuth spec may
// perfectly well cite a PyPI page for a library that implements it, and reading
// `pypi` off that row would wrongly confine the spec to Python. The name-shape
// rule has no such exposure and so has no such restriction.
export const REGISTRY_BEARING_KINDS = new Set([
  LedgerEntityKind.Package,
  LedgerEntityKind.Runtime,
  LedgerEntityKind.Tool,
]);

// Deduped, ordered by the enum so two equal sets compare equal as arrays and a
// diff of the column is readable.
const ECOSYSTEM_ORDER = Object.values(LedgerEcosystem);

export const normalizeEcosystems = (
  values: readonly LedgerEcosystem[],
): LedgerEcosystem[] => {
  const present = new Set(values);

  return ECOSYSTEM_ORDER.filter((value) => present.has(value));
};

// A merge keeps the UNION: two rows filed for one artifact each saw part of the
// evidence, and a package genuinely published to two registries (a Go module
// mirrored on npm through a wasm wrapper) is a real thing. Union is also the
// only direction that cannot lose a match — intersection could empty a column
// that was right on both sides and silently narrow the entity to nothing.
export const unionEcosystems = (
  ...groups: readonly (readonly LedgerEcosystem[] | null | undefined)[]
): LedgerEcosystem[] =>
  normalizeEcosystems(groups.flatMap((group) => group ?? []));

// Everything mechanically derivable about one entity, from the names it answers
// to and the evidence its claims cite. The single home of the rule: the route
// that mints an entity, the backfill script and the writers all call this, so
// there is exactly one answer to "what registry is this".
export const deriveEcosystems = ({
  kind,
  names,
  evidenceUrls = [],
}: {
  kind: LedgerEntityKind;
  names: readonly string[];
  evidenceUrls?: readonly string[];
}): LedgerEcosystem[] =>
  unionEcosystems(
    names.flatMap(ecosystemsFromName),
    REGISTRY_BEARING_KINDS.has(kind)
      ? evidenceUrls.flatMap(ecosystemsFromEvidenceUrl)
      : [],
  );
