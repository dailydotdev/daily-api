import type { DataSource, EntityManager } from 'typeorm';
import { Readable } from 'stream';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { FreeformPost } from '../entity/posts/FreeformPost';
import { PostOrigin } from '../entity/posts/Post';
import { TOOLS_SOURCE } from '../entity/Source';
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
