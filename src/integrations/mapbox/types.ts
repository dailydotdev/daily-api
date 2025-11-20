import { IGarmrClient } from '../garmr';

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
  place?: {
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

export interface IMapboxClient extends IGarmrClient {
  geocode(query: string): Promise<MapboxResponse>;
  autocomplete(query: string): Promise<MapboxResponse>;
}
