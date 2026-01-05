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
 * Find an existing location by externalId or create one from Mapbox.
 */
export const findOrCreateDatasetLocation = async (
  con: DataSource,
  externalLocationId: string | null | undefined,
): Promise<DatasetLocation | null> => {
  if (!externalLocationId) {
    return null;
  }

  let location = await con.getRepository(DatasetLocation).findOne({
    where: { externalId: externalLocationId },
  });

  if (!location) {
    location = await createLocationFromMapbox(con, externalLocationId);
  }

  return location;
};

/**
 * Find an existing location in the dataset_location table based on iso2 country code.
 */
export const findDatasetLocation = async (
  con: DataSource,
  locationData: Partial<Pick<DatasetLocation, 'iso2' | 'city' | 'subdivision'>>,
): Promise<DatasetLocation | null> => {
  const { iso2 } = locationData;

  if (!iso2) {
    return null;
  }

  const locationQuery = con.manager
    .getRepository(DatasetLocation)
    .createQueryBuilder()
    .where('iso2 = :iso2Only', { iso2Only: iso2 })
    .andWhere('city IS NULL')
    .andWhere('subdivision IS NULL');

  const location = await locationQuery.getOne();

  return location;
};
