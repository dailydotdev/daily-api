import type { DataSource } from 'typeorm/data-source';
import { DatasetLocation } from './DatasetLocation';

export interface MapboxContext {
  country?: {
    id: string;
    name: string;
    country_code: string;
    country_code_alpha_3: string;
  };
  region?: {
    id: string;
    name: string;
    region_code: string;
    region_code_full: string;
  };
  district?: {
    id: string;
    name: string;
  };
}

export interface MapboxFeature {
  type: 'Feature';
  geometry: {
    coordinates: [number, number];
    type: 'Point';
  };
  properties: {
    name: string;
    mapbox_id: string;
    feature_type: string;
    place_formatted: string;
    context: MapboxContext;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    bbox?: number[];
    language: string;
    maki: string;
    metadata: Record<string, unknown>;
    distance?: number;
  };
}

export interface MapboxResponse {
  type: 'FeatureCollection';
  features: MapboxFeature[];
  attribution: string;
  response_id: string;
}

export const createLocationFromMapbox = async (
  con: DataSource,
  externalId: string,
) => {
  let mapboxGeocodingUrl = `${process.env.MAPBOX_GEOCODING_URL}?q=${encodeURIComponent(externalId)}&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;

  if (process.env.NODE_ENV === 'production') {
    mapboxGeocodingUrl += '&permanent=true';
  }

  const response = await fetch(mapboxGeocodingUrl);

  if (!response.ok) {
    throw new Error('API error');
  }

  const geocodingData = await response.json();

  const feature = geocodingData.features[0];
  const properties = feature.properties;

  return await con.manager.getRepository(DatasetLocation).save({
    externalId: externalId,
    country: properties.context?.country?.name,
    city: properties.context?.place?.name,
    subdivision: properties.context?.region?.name,
    iso2: properties.context?.country?.country_code.toUpperCase(),
    iso3: properties.context?.country?.country_code_alpha_3.toUpperCase(),
  });
};
