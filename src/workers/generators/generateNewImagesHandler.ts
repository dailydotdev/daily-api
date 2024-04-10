import {
  ContentImageUsedByType,
  updateUsedImagesInContent,
} from '../../entity';
import { DataSource } from 'typeorm';

export const generateNewImagesHandler = async (
  data: { id: string; contentHtml: string },
  type: ContentImageUsedByType,
  con: DataSource,
) => {
  if (!data || !data?.id || !data?.contentHtml) return;

  await updateUsedImagesInContent(con, type, data.id, data.contentHtml);
};
