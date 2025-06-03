import type { DataSource } from 'typeorm';
import { ContentPreferenceOrganization } from '../../entity/contentPreference/ContentPreferenceOrganization';

export * from './subscription';

export const isUserPartOfOrganization = async (
  con: DataSource,
  userId: string,
): Promise<boolean> =>
  con.getRepository(ContentPreferenceOrganization).existsBy({
    userId,
  });
