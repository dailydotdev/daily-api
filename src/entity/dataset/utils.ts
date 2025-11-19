import type { DataSource } from 'typeorm/data-source';
import { DatasetLocation } from './DatasetLocation';
import { mapboxClient } from '../../integrations/mapbox/clients';
import { logger } from '../../logger';

export const createLocationFromMapbox = async (
  con: DataSource,
  externalId: string,
): Promise<DatasetLocation | null> => {
  try {
    const geocodingData = await mapboxClient.geocode(externalId);

    const feature = geocodingData.features[0];
    const properties = feature.properties;

    return await con.manager.getRepository(DatasetLocation).save({
      externalId: externalId,
      country: properties.context?.country?.name,
      city: properties.context?.place?.name,
      subdivision: properties.context?.region?.name,
      iso2: properties.context?.country?.country_code?.toUpperCase(),
      iso3: properties.context?.country?.country_code_alpha_3?.toUpperCase(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create location from Mapbox');
    throw error;
  }
};
