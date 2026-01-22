import type { DataSource } from 'typeorm';
import { Readable } from 'stream';
import { DatasetTool } from '../entity/dataset/DatasetTool';
import { uploadToolIcon } from './cloudinary';

const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';

const normalizeTitle = (title: string): string =>
  title.toLowerCase().trim().replace(/\s+/g, '');

const toSimpleIconsSlug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]/g, '');

const fetchAndUploadToolIcon = async (
  toolId: string,
  title: string,
): Promise<string | null> => {
  const slug = toSimpleIconsSlug(title);
  const url = `${SIMPLE_ICONS_CDN}/${slug}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const svgBuffer = Buffer.from(await response.arrayBuffer());
    const stream = Readable.from(svgBuffer);
    const result = await uploadToolIcon(toolId, stream);
    return result.url;
  } catch {
    return null;
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

    const faviconUrl = await fetchAndUploadToolIcon(tool.id, title);
    if (faviconUrl) {
      tool.faviconUrl = faviconUrl;
      tool.faviconSource = 'simple-icons';
      await repo.save(tool);
    }
  }

  return tool;
};
