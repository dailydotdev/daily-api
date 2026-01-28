import type { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { uploadToolIcon } from './cloudinary';

const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';
const DEVICON_CDN = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
const ICONIFY_API = 'https://api.iconify.design/logos';

type IconSource = 'simple-icons' | 'devicon' | 'iconify' | 'none';

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/\./g, 'dot')
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '');

const toSimpleIconsSlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]/g, '');

const toDeviconSlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]/g, '');

const toIconifySlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]/g, '');

const tryFetchIcon = async (url: string): Promise<Buffer | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
};

const fetchAndUploadToolIcon = async (
  toolId: string,
  title: string,
): Promise<{ url: string; source: IconSource } | null> => {
  const sources: Array<{ url: string; source: IconSource }> = [];

  // Simple Icons
  const simpleIconsSlug = toSimpleIconsSlug(title);
  sources.push({
    url: `${SIMPLE_ICONS_CDN}/${simpleIconsSlug}`,
    source: 'simple-icons',
  });

  // Devicon
  const deviconSlug = toDeviconSlug(title);
  sources.push({
    url: `${DEVICON_CDN}/${deviconSlug}/${deviconSlug}-original.svg`,
    source: 'devicon',
  });

  // Iconify
  const iconifySlug = toIconifySlug(title);
  sources.push({
    url: `${ICONIFY_API}:${iconifySlug}.svg`,
    source: 'iconify',
  });

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
