import { createLogger, ValidationError } from '../../infra/index.js';

const logger = createLogger('geoapify-service');
const BASE_URL = 'https://api.geoapify.com/v2';

function getApiKey(): string {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) {
    throw new ValidationError('GEOAPIFY_API_KEY is not configured');
  }
  return key;
}

export interface GeoapifyPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  categories: string[];
  distance?: number;
}

export interface PlacesSearchParams {
  text?: string;
  categories?: string;
  filter?: string;
  bias?: string;
  limit?: number;
}

export interface NearbyPlacesParams {
  lat: number;
  lon: number;
  categories: string;
  radius?: number;
  limit?: number;
}

export interface GeoapifyService {
  searchPlaces(params: PlacesSearchParams): Promise<GeoapifyPlace[]>;
  getNearbyPlaces(params: NearbyPlacesParams): Promise<GeoapifyPlace[]>;
}

async function callGeoapify(endpoint: string, params: Record<string, string | number>): Promise<GeoapifyPlace[]> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  logger.info('Calling Geoapify API', { endpoint: url.pathname });

  let response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new Error(`Geoapify API network error: ${(error as Error).message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Geoapify API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json() as {
    features?: Array<{
      properties: {
        place_id: string;
        name: string;
        address_line1?: string;
        address_line2?: string;
        categories: string[];
        distance?: number;
      };
      geometry: {
        coordinates: [number, number];
      };
    }>;
  };

  return (data.features || []).map((f) => ({
    id: f.properties.place_id,
    name: f.properties.name || 'Unknown',
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    address: [f.properties.address_line1, f.properties.address_line2].filter(Boolean).join(', '),
    categories: f.properties.categories || [],
    distance: f.properties.distance,
  }));
}

export function createGeoapifyService(): GeoapifyService {
  return {
    async searchPlaces(params: PlacesSearchParams): Promise<GeoapifyPlace[]> {
      const apiKey = getApiKey();
      let filter = params.filter;
      
      // If text is provided but no filter, geocode it first to get a place_id
      if (params.text && !filter) {
        try {
          const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(params.text)}&limit=1&apiKey=${apiKey}`;
          const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(5000) });
          if (geoRes.ok) {
            const geoData = await geoRes.json() as any;
            const placeId = geoData?.features?.[0]?.properties?.place_id;
            if (placeId) {
              filter = `place:${placeId}`;
            }
          }
        } catch (e) {
          logger.warn('Geocoding fallback failed', { error: (e as Error).message });
        }
        
        // If we still don't have a filter after attempting geocoding, we must return empty
        // because /v2/places requires a filter or bias.
        if (!filter && !params.bias) {
          return [];
        }
      }

      const queryParams: Record<string, string | number> = {};
      if (params.categories) queryParams.categories = params.categories;
      if (filter) queryParams.filter = filter;
      if (params.bias) queryParams.bias = params.bias;
      queryParams.limit = params.limit || 20;

      return callGeoapify('/places', queryParams);
    },

    async getNearbyPlaces(params: NearbyPlacesParams): Promise<GeoapifyPlace[]> {
      const filter = `circle:${params.lon},${params.lat},${params.radius || 5000}`;
      const bias = `proximity:${params.lon},${params.lat}`;

      return callGeoapify('/places', {
        categories: params.categories,
        filter,
        bias,
        limit: params.limit || 20,
      });
    },
  };
}
