import { Reader, type ReaderModel } from '@maxmind/geoip2-node';
import type { GeoRecord } from '../types';
import { logger } from '../logger';
import { isProd } from './utils';
import { join } from 'path';

export enum Continent {
  Africa = 'AF',
  Antarctica = 'AN',
  Asia = 'AS',
  Europe = 'EU',
  Oceania = 'OC',
  NorthAmerica = 'NA',
  SouthAmerica = 'SA',
}

export const countryCodeToContinent: Record<string, Continent> = {
  AF: Continent.Asia,
  AX: Continent.Europe,
  AL: Continent.Europe,
  DZ: Continent.Africa,
  AS: Continent.Oceania,
  AD: Continent.Europe,
  AO: Continent.Africa,
  AI: Continent.NorthAmerica,
  AQ: Continent.Antarctica,
  AG: Continent.NorthAmerica,
  AR: Continent.SouthAmerica,
  AM: Continent.Asia,
  AW: Continent.NorthAmerica,
  AU: Continent.Oceania,
  AT: Continent.Europe,
  AZ: Continent.Asia,
  BS: Continent.NorthAmerica,
  BH: Continent.Asia,
  BD: Continent.Asia,
  BB: Continent.NorthAmerica,
  BY: Continent.Europe,
  BE: Continent.Europe,
  BZ: Continent.NorthAmerica,
  BJ: Continent.Africa,
  BM: Continent.NorthAmerica,
  BT: Continent.Asia,
  BO: Continent.SouthAmerica,
  BA: Continent.Europe,
  BW: Continent.Africa,
  BV: Continent.Antarctica,
  BR: Continent.SouthAmerica,
  IO: Continent.Asia,
  BN: Continent.Asia,
  BG: Continent.Europe,
  BF: Continent.Africa,
  BI: Continent.Africa,
  KH: Continent.Asia,
  CM: Continent.Africa,
  CA: Continent.NorthAmerica,
  CV: Continent.Africa,
  KY: Continent.NorthAmerica,
  CF: Continent.Africa,
  TD: Continent.Africa,
  CL: Continent.SouthAmerica,
  CN: Continent.Asia,
  CX: Continent.Asia,
  CC: Continent.Asia,
  CO: Continent.SouthAmerica,
  KM: Continent.Africa,
  CG: Continent.Africa,
  CD: Continent.Africa,
  CK: Continent.Oceania,
  CR: Continent.NorthAmerica,
  CI: Continent.Africa,
  HR: Continent.Europe,
  CU: Continent.NorthAmerica,
  CY: Continent.Asia,
  CZ: Continent.Europe,
  DK: Continent.Europe,
  DJ: Continent.Africa,
  DM: Continent.NorthAmerica,
  DO: Continent.NorthAmerica,
  EC: Continent.SouthAmerica,
  EG: Continent.Africa,
  SV: Continent.NorthAmerica,
  GQ: Continent.Africa,
  ER: Continent.Africa,
  EE: Continent.Europe,
  SZ: Continent.Africa,
  ET: Continent.Africa,
  FK: Continent.SouthAmerica,
  FO: Continent.Europe,
  FJ: Continent.Oceania,
  FI: Continent.Europe,
  FR: Continent.Europe,
  GF: Continent.SouthAmerica,
  PF: Continent.Oceania,
  TF: Continent.Antarctica,
  GA: Continent.Africa,
  GM: Continent.Africa,
  GE: Continent.Asia,
  DE: Continent.Europe,
  GH: Continent.Africa,
  GI: Continent.Europe,
  GR: Continent.Europe,
  GL: Continent.NorthAmerica,
  GD: Continent.NorthAmerica,
  GP: Continent.NorthAmerica,
  GU: Continent.Oceania,
  GT: Continent.NorthAmerica,
  GG: Continent.Europe,
  GN: Continent.Africa,
  GW: Continent.Africa,
  GY: Continent.SouthAmerica,
  HT: Continent.NorthAmerica,
  HM: Continent.Antarctica,
  VA: Continent.Europe,
  HN: Continent.NorthAmerica,
  HK: Continent.Asia,
  HU: Continent.Europe,
  IS: Continent.Europe,
  IN: Continent.Asia,
  ID: Continent.Asia,
  IR: Continent.Asia,
  IQ: Continent.Asia,
  IE: Continent.Europe,
  IM: Continent.Europe,
  IL: Continent.Asia,
  IT: Continent.Europe,
  JM: Continent.NorthAmerica,
  JP: Continent.Asia,
  JE: Continent.Europe,
  JO: Continent.Asia,
  KZ: Continent.Asia,
  KE: Continent.Africa,
  KI: Continent.Oceania,
  KP: Continent.Asia,
  KR: Continent.Asia,
  KW: Continent.Asia,
  KG: Continent.Asia,
  LA: Continent.Asia,
  LV: Continent.Europe,
  LB: Continent.Asia,
  LS: Continent.Africa,
  LR: Continent.Africa,
  LY: Continent.Africa,
  LI: Continent.Europe,
  LT: Continent.Europe,
  LU: Continent.Europe,
  MO: Continent.Asia,
  MG: Continent.Africa,
  MW: Continent.Africa,
  MY: Continent.Asia,
  MV: Continent.Asia,
  ML: Continent.Africa,
  MT: Continent.Europe,
  MH: Continent.Oceania,
  MQ: Continent.NorthAmerica,
  MR: Continent.Africa,
  MU: Continent.Africa,
  YT: Continent.Africa,
  MX: Continent.NorthAmerica,
  FM: Continent.Oceania,
  MD: Continent.Europe,
  MC: Continent.Europe,
  MN: Continent.Asia,
  ME: Continent.Europe,
  MS: Continent.NorthAmerica,
  MA: Continent.Africa,
  MZ: Continent.Africa,
  MM: Continent.Asia,
  NA: Continent.Africa,
  NR: Continent.Oceania,
  NP: Continent.Asia,
  NL: Continent.Europe,
  NC: Continent.Oceania,
  NZ: Continent.Oceania,
  NI: Continent.NorthAmerica,
  NE: Continent.Africa,
  NG: Continent.Africa,
  NU: Continent.Oceania,
  NF: Continent.Oceania,
  MK: Continent.Europe,
  MP: Continent.Oceania,
  NO: Continent.Europe,
  OM: Continent.Asia,
  PK: Continent.Asia,
  PW: Continent.Oceania,
  PS: Continent.Asia,
  PA: Continent.NorthAmerica,
  PG: Continent.Oceania,
  PY: Continent.SouthAmerica,
  PE: Continent.SouthAmerica,
  PH: Continent.Asia,
  PN: Continent.Oceania,
  PL: Continent.Europe,
  PT: Continent.Europe,
  PR: Continent.NorthAmerica,
  QA: Continent.Asia,
  RE: Continent.Africa,
  RO: Continent.Europe,
  RU: Continent.Europe,
  RW: Continent.Africa,
  BL: Continent.NorthAmerica,
  SH: Continent.Africa,
  KN: Continent.NorthAmerica,
  LC: Continent.NorthAmerica,
  MF: Continent.NorthAmerica,
  PM: Continent.NorthAmerica,
  VC: Continent.NorthAmerica,
  WS: Continent.Oceania,
  SM: Continent.Europe,
  ST: Continent.Africa,
  SA: Continent.Asia,
  SN: Continent.Africa,
  RS: Continent.Europe,
  SC: Continent.Africa,
  SL: Continent.Africa,
  SG: Continent.Asia,
  SX: Continent.NorthAmerica,
  SK: Continent.Europe,
  SI: Continent.Europe,
  SB: Continent.Oceania,
  SO: Continent.Africa,
  ZA: Continent.Africa,
  GS: Continent.Antarctica,
  SS: Continent.Africa,
  ES: Continent.Europe,
  LK: Continent.Asia,
  SD: Continent.Africa,
  SR: Continent.SouthAmerica,
  SJ: Continent.Europe,
  SE: Continent.Europe,
  CH: Continent.Europe,
  SY: Continent.Asia,
  TW: Continent.Asia,
  TJ: Continent.Asia,
  TZ: Continent.Africa,
  TH: Continent.Asia,
  TL: Continent.Asia,
  TG: Continent.Africa,
  TK: Continent.Oceania,
  TO: Continent.Oceania,
  TT: Continent.NorthAmerica,
  TN: Continent.Africa,
  TR: Continent.Asia,
  TM: Continent.Asia,
  TC: Continent.NorthAmerica,
  TV: Continent.Oceania,
  UG: Continent.Africa,
  UA: Continent.Europe,
  AE: Continent.Asia,
  GB: Continent.Europe,
  US: Continent.NorthAmerica,
  UM: Continent.Oceania,
  UY: Continent.SouthAmerica,
  UZ: Continent.Asia,
  VU: Continent.Oceania,
  VE: Continent.SouthAmerica,
  VN: Continent.Asia,
  VG: Continent.NorthAmerica,
  VI: Continent.NorthAmerica,
  WF: Continent.Oceania,
  EH: Continent.Africa,
  YE: Continent.Asia,
  ZM: Continent.Africa,
  ZW: Continent.Africa,
};

let geoReader: ReaderModel | null = null;

export /**
 * Loads the GeoIP2 database and returns a reader instance
 * Requires the GEOIP_PATH environment variable to be set
 * and file to be mounted, in prod it is mounted as a volume
 * check .infra for more details
 *
 * @return {*}  {(Promise<ReaderModel | undefined>)}
 */
const initGeoReader = async (): Promise<ReaderModel | undefined> => {
  try {
    if (!process.env.GEOIP_PATH) {
      throw new Error('GEOIP_PATH not set');
    }

    const reader = await Reader.open(
      join(process.env.GEOIP_PATH, 'GeoIP2-Country.mmdb'),
      {
        cache: {
          max: 10_000,
        },
        watchForUpdates: false, // db updates on each deploy
        watchForUpdatesNonPersistent: true,
      },
    );

    geoReader = reader;

    return reader;
  } catch (error) {
    const errorMessage = 'Error loading GeoIP2 database';

    logger.error({ err: error }, errorMessage);
  }
};

export const getGeo = ({ ip }: { ip: string }): GeoRecord => {
  if (!isProd && !geoReader) {
    return {
      country: 'US',
      continent: 'NA',
    };
  }

  if (!geoReader) {
    throw new Error('Geo reader not initialized');
  }

  try {
    const geo = geoReader.country(ip);

    return {
      country: geo.country?.isoCode,
      continent: geo.continent?.code,
    };
  } catch (error) {
    logger.warn({ err: error, ip }, 'Error fetching geo data');

    return {};
  }
};
