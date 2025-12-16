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
 * Find an existing location in the dataset_location table based on city, country, and subdivision.
 * Falls back to country+subdivision, then country only if more specific matches aren't found.
 */
export const findDatasetLocation = async (
  con: DataSource,
  locationData: {
    city?: string | null;
    country?: string | null;
    subdivision?: string | null;
  },
): Promise<DatasetLocation | null> => {
  const { city, country, subdivision } = locationData;

  if (!country) {
    return null;
  }

  const repo = con.manager.getRepository(DatasetLocation);

  // Try to find exact match: city + country + subdivision
  if (city && subdivision) {
    const exactMatch = await repo.findOne({
      where: { city, country, subdivision },
    });
    if (exactMatch) return exactMatch;
  }

  // Try city + country (subdivision null)
  if (city) {
    const cityCountryMatch = await repo.findOne({
      where: { city, country },
    });
    if (cityCountryMatch) return cityCountryMatch;
  }

  // Try country + subdivision (city null)
  if (subdivision) {
    const countrySubdivisionMatch = await repo.findOne({
      where: { country, subdivision },
    });
    if (countrySubdivisionMatch) return countrySubdivisionMatch;
  }

  // Try country only (city and subdivision null)
  const countryOnlyMatch = await repo.findOne({
    where: { country },
  });
  if (countryOnlyMatch) return countryOnlyMatch;

  // Location not found - return null
  // We don't create new locations without proper iso2/iso3 codes
  return null;
};
