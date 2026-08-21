import type { DataSource, EntityManager } from 'typeorm';
import { Readable } from 'stream';
import { ForbiddenError } from 'apollo-server-errors';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { FreeformPost } from '../entity/posts/FreeformPost';
import { PostOrigin } from '../entity/posts/Post';
import { TOOLS_SOURCE } from '../entity/Source';
import { UserCompany } from '../entity/UserCompany';
import { Company } from '../entity/Company';
import { getDomainVariants } from './companyEnrichment';
import { generateShortId } from '../ids';
import { markdown } from './markdown';
import { uploadToolIcon } from './cloudinary';

const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';
const DEVICON_CDN = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
const ICONIFY_API = 'https://api.iconify.design/logos';
const ICON_FETCH_TIMEOUT_MS = 500;

export type IconSource = 'simple-icons' | 'devicon' | 'iconify' | 'none';

export const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/\./g, 'dot')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '');

const tryFetchIcon = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(ICON_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
};

export const fetchAndUploadToolIcon = async (
  toolId: string,
  title: string,
): Promise<{ url: string; source: IconSource } | null> => {
  const slug = normalizeTitle(title);

  const sources: Array<{
    url: string;
    source: Exclude<IconSource, 'none'>;
  }> = [
    {
      url: `${SIMPLE_ICONS_CDN}/${slug}`,
      source: 'simple-icons',
    },
    {
      url: `${DEVICON_CDN}/${slug}/${slug}-original.svg`,
      source: 'devicon',
    },
    {
      url: `${ICONIFY_API}:${slug}.svg`,
      source: 'iconify',
    },
  ];

  // Try each source in order
  for (const { url, source } of sources) {
    const svgBuffer = await tryFetchIcon(url);
    if (svgBuffer) {
      try {
        const stream = Readable.from(svgBuffer);
        const result = await uploadToolIcon(toolId, stream);
        return { url: result.url, source };
      } catch {
        // Continue to next source if upload fails
        continue;
      }
    }
  }

  return null;
};

// Hidden host post for a tool's discussion: comments on tools are ordinary
// post comments, so threading, votes, notifications and moderation come from
// the existing machinery.
export const createToolDiscussionPost = async (
  con: DataSource | EntityManager,
  tool: DatasetTool,
): Promise<FreeformPost> => {
  const id = await generateShortId();
  const content = `Community discussion about ${tool.title} on daily.dev.`;

  return con.getRepository(FreeformPost).save({
    id,
    shortId: id,
    title: `${tool.title} discussion`,
    sourceId: TOOLS_SOURCE,
    content,
    contentHtml: markdown.render(content),
    visible: true,
    visibleAt: new Date(),
    private: false,
    showOnFeed: false,
    origin: PostOrigin.UserGenerated,
    flags: {
      visible: true,
      private: false,
      showOnFeed: false,
    },
  });
};

// Tool discussions (comments on the TOOLS_SOURCE host post) are limited to
// users who have verified at least one work email, so takes carry some
// professional accountability. Votes stay open to everyone.
export const ensureVerifiedForToolDiscussion = async (
  con: DataSource | EntityManager,
  userId: string,
): Promise<void> => {
  const isVerified = await con
    .getRepository(UserCompany)
    .existsBy({ userId, verified: true });

  if (!isVerified) {
    throw new ForbiddenError('Verify your work email to join tool discussions');
  }
};

export const findOrCreateDatasetTool = async (
  con: DataSource,
  title: string,
): Promise<DatasetTool> => {
  const titleNormalized = normalizeTitle(title);
  const repo = con.getRepository(DatasetTool);

  let tool = await repo.findOne({
    where: { titleNormalized },
  });

  if (!tool) {
    tool = repo.create({
      title: title.trim(),
      titleNormalized,
      faviconSource: 'none',
    });
    await repo.save(tool);

    const iconResult = await fetchAndUploadToolIcon(tool.id, title);
    if (iconResult) {
      tool.faviconUrl = iconResult.url;
      tool.faviconSource = iconResult.source;
      await repo.save(tool);
    }
  }

  return tool;
};

// Tolerates URLs stored with or without a scheme; anything unparseable can't
// be verified against, so callers treat a null result as ineligible.
export const getToolDomain = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    try {
      return new URL(`https://${url}`).hostname.toLowerCase() || null;
    } catch {
      return null;
    }
  }
};

// Multi-tenant hosts where the tool's own url identifies the platform, not
// its vendor - a verified employee of the platform (e.g. GitHub) should not
// become eligible to claim every tool hosted there. Fails closed: unknown
// hosts stay claimable, this list is what curation can extend over time.
export const SHARED_HOST_BLOCKLIST = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'npmjs.com',
  'pypi.org',
  'rubygems.org',
  'crates.io',
  'pkg.go.dev',
  'marketplace.visualstudio.com',
  'plugins.jetbrains.com',
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org',
  'sourceforge.net',
  'apps.apple.com',
  'play.google.com',
];

export const isSharedHost = (domain: string): boolean =>
  SHARED_HOST_BLOCKLIST.some(
    (host) => domain === host || domain.endsWith(`.${host}`),
  );

export type VerifiedCompanyDomains = { companyId: string; domains: string[] };

// The viewer's verified companies and their domains, fetched once per request
// (see DataLoaderService.verifiedCompanies) and reused across every tool that
// resolver touches, instead of a DB round trip per parent.
export const getViewerVerifiedCompanies = (
  con: DataSource | EntityManager,
  userId: string,
): Promise<VerifiedCompanyDomains[]> =>
  con
    .getRepository(UserCompany)
    .createQueryBuilder('uc')
    .innerJoin(Company, 'c', 'c.id = uc."companyId"')
    .where('uc."userId" = :userId', { userId })
    .andWhere('uc.verified = true')
    .select('c.id', 'companyId')
    .addSelect('c.domains', 'domains')
    .getRawMany<VerifiedCompanyDomains>();

// A tool can be claimed by a viewer with a verified work email at a company
// whose domains cover the tool's own site. Pure and DB-free: callers pass in
// the viewer's already-fetched verified companies (see
// getViewerVerifiedCompanies) so this can run once per tool without a query.
export const findClaimableCompanyId = (
  verifiedCompanies: VerifiedCompanyDomains[],
  toolUrl: string,
): string | null => {
  const domain = getToolDomain(toolUrl);
  if (!domain || isSharedHost(domain)) {
    return null;
  }

  // Reuses the same domain-variant overlap check enrichment uses to match a
  // domain to an existing Company.
  const variants = new Set(getDomainVariants(domain));
  const match = verifiedCompanies.find(({ domains }) =>
    domains.some((companyDomain) => variants.has(companyDomain)),
  );

  return match?.companyId ?? null;
};
