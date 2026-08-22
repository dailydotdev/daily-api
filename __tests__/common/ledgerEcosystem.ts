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
        names: ['Authlib'],
        evidenceUrls,
      }),
    ).toEqual([LedgerEcosystem.Pypi]);

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Spec,
        names: ['OAuth 2.1'],
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
        names: ['@vercel/blob'],
      }),
    ).toEqual([LedgerEcosystem.Npm]);
  });

  it('should union both rules and every name the entity answers to', () => {
    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        names: ['Ecto', 'ecto'],
        evidenceUrls: [
          'https://hex.pm/packages/ecto',
          'https://elixir-lang.org/blog/whatever',
        ],
      }),
    ).toEqual([LedgerEcosystem.Hex]);

    expect(
      deriveEcosystems({
        kind: LedgerEntityKind.Package,
        names: ['@scope/thing'],
        evidenceUrls: ['https://pypi.org/project/thing/'],
      }),
    ).toEqual([LedgerEcosystem.Npm, LedgerEcosystem.Pypi]);
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
