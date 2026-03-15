import { URL } from 'node:url';
import { fetchOptions as globalFetchOptions } from '../../http';
import { HttpError, retryFetchParse, type RetryOptions } from '../retry';

const brandDevRetryOptions: RetryOptions = {
  retries: 3,
};

type BrandDevLogo = {
  url?: string;
  type?: string;
  mode?: string;
  resolution?: {
    width?: number;
    height?: number;
  };
};

type BrandDevLinks = {
  home?: string;
};

type BrandDevBrand = {
  domain?: string;
  title?: string;
  logos?: BrandDevLogo[];
  links?: BrandDevLinks;
};

type BrandDevResponse = {
  brand?: BrandDevBrand;
};

const getBrandDevApiKey = (): string | undefined =>
  process.env.BRAND_DEV_API_KEY;

export const getBrandDevDomain = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  try {
    const normalizedValue = value.includes('://') ? value : `https://${value}`;
    const hostname = new URL(normalizedValue).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const getLogoScore = (logo: BrandDevLogo): number => {
  const area = (logo.resolution?.width || 0) * (logo.resolution?.height || 0);
  const typeScore = logo.type === 'logo' ? 100 : 0;
  const modeScore = logo.mode === 'light' ? 10 : 0;

  return typeScore + modeScore + area;
};

export const pickBrandDevLogo = (logos?: BrandDevLogo[]): string | undefined =>
  logos
    ?.filter((logo): logo is BrandDevLogo & { url: string } =>
      Boolean(logo.url),
    )
    .sort((first, second) => getLogoScore(second) - getLogoScore(first))[0]
    ?.url;

export const fetchBrandProfile = async (
  domain: string,
): Promise<BrandDevBrand | undefined> => {
  const apiKey = getBrandDevApiKey();
  if (!apiKey) {
    return undefined;
  }

  const url = new URL('/v1/brand/retrieve', 'https://api.brand.dev');
  url.searchParams.set('domain', domain);

  try {
    const response = await retryFetchParse<BrandDevResponse>(
      url,
      {
        ...globalFetchOptions,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
      brandDevRetryOptions,
    );

    return response.brand;
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 404) {
      return undefined;
    }

    throw error;
  }
};
