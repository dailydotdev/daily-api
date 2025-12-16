import type { DataSource } from 'typeorm/data-source';
import { DatasetLocation } from './DatasetLocation';
import { mapboxClient } from '../../integrations/mapbox/clients';

export const createLocationFromMapbox = async (
  con: DataSource,
  externalId: string,
): Promise<DatasetLocation | null> => {
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
};

/**
 * Find an existing location in the dataset_location table based on iso2 country code.
 */
export const findDatasetLocation = async (
  con: DataSource,
  locationData: {
    iso2?: string | null;
  },
): Promise<DatasetLocation | null> => {
  const { iso2 } = locationData;

  if (!iso2) {
    return null;
  }

  const repo = con.manager.getRepository(DatasetLocation);

  // Find location by iso2 country code
  const location = await repo.findOne({
    where: { iso2: iso2.toUpperCase() },
  });

  return location;
};
