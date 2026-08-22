import {
  deriveEcosystems,
  ecosystemsFromEvidenceUrl,
  ecosystemsFromName,
  unionEcosystems,
} from '../../src/common/ledgerEcosystem';
import {
  LedgerEcosystem,
  LedgerEntityKind,
} from '../../src/entity/claim/LedgerEntity';

describe('ledger ecosystem derivation', () => {
  it('should read the registry off a coordinate that names it by syntax', () => {
    expect(ecosystemsFromName('@nextcloud/vue')).toEqual([LedgerEcosystem.Npm]);
    expect(ecosystemsFromName('github.com/spf13/cobra')).toEqual([
      LedgerEcosystem.Go,
    ]);
    expect(ecosystemsFromName('golang.org/x/net')).toEqual([
      LedgerEcosystem.Go,
    ]);
    expect(ecosystemsFromName('k8s.io/api')).toEqual([LedgerEcosystem.Go]);
    expect(ecosystemsFromName('package:riverpod')).toEqual([
      LedgerEcosystem.Pub,
    ]);
    expect(ecosystemsFromName('org.springframework:spring-core')).toEqual([
      LedgerEcosystem.Maven,
    ]);
  });

  // The whole point of the column is that unknown is a legitimate answer, so a
  // name that could belong to three registries must produce none of them.
  it('should derive nothing from a bare name or an unqualified vendor/package pair', () => {
    expect(ecosystemsFromName('requests')).toEqual([]);
    expect(ecosystemsFromName('Ecto')).toEqual([]);
    expect(ecosystemsFromName('json')).toEqual([]);
    // A Composer coordinate, a GitHub slug and a namespace all at once.
    expect(ecosystemsFromName('laravel/framework')).toEqual([]);
    expect(ecosystemsFromName('Next.js')).toEqual([]);
  });

  // Every case below is a live prod row that the unguarded shape rule derived
  // WRONGLY, which is the whole exposure this column has: unknown costs nothing,
  // a wrong registry silently deletes real findings for that entity.
  it('should not read a container image reference as a go module path', () => {
    expect(ecosystemsFromName('ghcr.io/elementary-data/elementary')).toEqual(
      [],
    );
    expect(ecosystemsFromName('docker.io/bitnami')).toEqual([]);
    expect(ecosystemsFromName('us.gcr.io/daily-ops/daily-api')).toEqual([]);
  });

  it('should read a reverse-dns group as maven, not as the go path it looks like', () => {
    expect(
      ecosystemsFromName('org.fasterxml.jackson.core/jackson-databind'),
    ).toEqual([LedgerEcosystem.Maven]);
    // Clojars is a Maven repository, and Leiningen writes the coordinate with a
    // slash.
    expect(ecosystemsFromName('com.billpiel/sayid')).toEqual([
      LedgerEcosystem.Maven,
    ]);
  });

  // Go's `/vN` suffix always follows a module path, so a bare version straight
  // after the host is a website, not a module.
  it('should not read a versioned website as a go module path', () => {
    expect(ecosystemsFromName('xunit.net/v3')).toEqual([]);
    expect(ecosystemsFromName('github.com/jackc/pgx/v5')).toEqual([
      LedgerEcosystem.Go,
    ]);
  });

  // A Bedrock model id is the Maven colon form exactly, and a model is never a
  // Maven artifact.
  it('should not read a model id as a maven coordinate', () => {
    expect(
      ecosystemsFromName('amazon.nova-2-lite-v1:0', LedgerEntityKind.Model),
    ).toEqual([]);
    expect(
      ecosystemsFromName('amazon.titan-text:express', LedgerEntityKind.Model),
    ).toEqual([]);
    expect(
      ecosystemsFromName('androidx.core:core-ktx', LedgerEntityKind.Package),
    ).toEqual([LedgerEcosystem.Maven]);
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Model,
        canonicalName: 'Amazon Nova 2 Lite',
        aliases: ['amazon.nova-2-lite-v1:0'],
      }),
    ).toEqual([]);
  });

  it('should read the registry off a cited evidence host', () => {
    expect(
      ecosystemsFromEvidenceUrl('https://pypi.org/project/together/1.2.0/'),
    ).toEqual([LedgerEcosystem.Pypi]);
    expect(
      ecosystemsFromEvidenceUrl('https://www.npmjs.com/package/left-pad'),
    ).toEqual([LedgerEcosystem.Npm]);
    expect(ecosystemsFromEvidenceUrl('https://hex.pm/packages/ecto')).toEqual([
      LedgerEcosystem.Hex,
    ]);
    expect(ecosystemsFromEvidenceUrl('https://rubygems.org/gems/json')).toEqual(
      [LedgerEcosystem.RubyGems],
    );
  });

  it('should derive nothing from a host that is not a registry or a url it cannot parse', () => {
    expect(
      ecosystemsFromEvidenceUrl('https://nextjs.org/blog/next-15-2'),
    ).toEqual([]);
    // A lookalike host must not be taken for the registry it imitates.
    expect(ecosystemsFromEvidenceUrl('https://blog.npmjs.wtf/post')).toEqual(
      [],
    );
    expect(ecosystemsFromEvidenceUrl('not a url')).toEqual([]);
  });

  // The rule that keeps a spec or an api from being confined to one language:
  // such an entity is not installed from anywhere, so a registry page in its
  // evidence is a citation about something else.
  it('should let an evidence host speak only for kinds installed from a registry', () => {
    const evidenceUrls = ['https://pypi.org/project/authlib/'];

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        canonicalName: 'Authlib',
        evidenceUrls,
      }),
    ).toEqual([LedgerEcosystem.Pypi]);

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Spec,
        canonicalName: 'OAuth 2.1',
        evidenceUrls,
      }),
    ).toEqual([]);
  });

  // The shape is the coordinate whatever the kind says, so this half is not
  // restricted the way the host half is.
  it('should take the name shape for a kind no registry installs', () => {
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Service,
        canonicalName: '@vercel/blob',
      }),
    ).toEqual([LedgerEcosystem.Npm]);
  });

  it('should union both rules and every name the entity answers to', () => {
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        canonicalName: 'Ecto',
        aliases: ['ecto'],
        evidenceUrls: [
          'https://hex.pm/packages/ecto',
          'https://elixir-lang.org/blog/whatever',
        ],
      }),
    ).toEqual([LedgerEcosystem.Hex]);

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        canonicalName: '@scope/thing',
        evidenceUrls: ['https://pypi.org/project/thing/'],
      }),
    ).toEqual([LedgerEcosystem.Npm, LedgerEcosystem.Pypi]);
  });

  // Measured on the prod ledger before a single row was written: `Gemini API`
  // carries the alias `@google/genai` and `Apache Kafka` carries
  // `org.apache.kafka:kafka-clients`. Those are ONE CLIENT LIBRARY for a
  // cross-language thing, not the thing's own coordinate — reading a registry
  // off either would delete every finding on the API's Python surface.
  it('should not let one sdk coordinate filed as an alias confine a cross-language entity', () => {
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Api,
        canonicalName: 'Gemini API',
        aliases: ['@google/genai'],
      }),
    ).toEqual([]);

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Runtime,
        canonicalName: 'Apache Kafka',
        aliases: ['org.apache.kafka:kafka-clients'],
      }),
    ).toEqual([]);
  });

  // A `package` entity and its coordinate are the same object, so there the
  // alias IS the entity's own name and speaks for it.
  it('should take a coordinate alias for a package, whose canonical is just its bare name', () => {
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        canonicalName: 'gova',
        aliases: ['github.com/nv404/gova'],
      }),
    ).toEqual([LedgerEcosystem.Go]);

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        canonicalName: 'KPayment',
        aliases: ['com.kttipay:kpayment-core'],
      }),
    ).toEqual([LedgerEcosystem.Maven]);
  });

  // A coordinate as the CANONICAL name means the entity is that artifact,
  // whatever kind it is filed under.
  it('should take a coordinate canonical name for any kind', () => {
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Other,
        canonicalName: '@shadcn/react',
      }),
    ).toEqual([LedgerEcosystem.Npm]);
  });

  it('should dedupe a union and order it so two equal sets are equal arrays', () => {
    expect(
      unionEcosystems(
        [LedgerEcosystem.Pypi, LedgerEcosystem.Npm],
        [LedgerEcosystem.Npm],
        null,
      ),
    ).toEqual([LedgerEcosystem.Npm, LedgerEcosystem.Pypi]);
  });
});
