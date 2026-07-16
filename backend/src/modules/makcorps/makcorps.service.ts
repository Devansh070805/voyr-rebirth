import { createLogger, ValidationError } from '../../infra/index.js';

const logger = createLogger('makcorps-service');
const BASE_URL = 'https://api.makcorps.com';

function getApiKey(): string {
  const key = process.env.MAKCORPS_API_KEY;
  if (!key) {
    throw new ValidationError('MAKCORPS_API_KEY is not configured');
  }
  return key;
}

export interface MakcorpsHotel {
  hotelId: number;
  name: string;
  telephone?: string;
  geocode: {
    latitude: number;
    longitude: number;
  };
  reviews: {
    rating: number;
    count: number;
  };
  vendor1?: string;
  price1?: string;
  vendor2?: string;
  price2?: string;
  vendor3?: string;
  price3?: string;
  vendor4?: string;
  price4?: string;
}

export interface MakcorpsPagination {
  totalHotelCount: number;
  totalpageCount: number;
  currentPageHotelsCount: number;
  currentPageNumber: number;
}

export interface MakcorpsSearchResult {
  hotels: MakcorpsHotel[];
  pagination?: MakcorpsPagination;
}

export interface SearchHotelsParams {
  cityid: string;
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
  cur?: string;
  pagination?: number;
  tax?: boolean;
  children?: number;
}

export interface MakcorpsService {
  searchHotels(params: SearchHotelsParams): Promise<MakcorpsSearchResult>;
}

export function createMakcorpsService(): MakcorpsService {
  return {
    async searchHotels(params: SearchHotelsParams): Promise<MakcorpsSearchResult> {
      const apiKey = getApiKey();
      const queryParams = new URLSearchParams({
        api_key: apiKey,
        cityid: params.cityid,
        pagination: String(params.pagination ?? 0),
        cur: params.cur || 'USD',
        rooms: String(params.rooms),
        adults: String(params.adults),
        checkin: params.checkin,
        checkout: params.checkout,
      });
      if (params.tax !== undefined) queryParams.set('tax', String(params.tax));
      if (params.children !== undefined) queryParams.set('children', String(params.children));

      const url = `${BASE_URL}/city?${queryParams.toString()}`;

      logger.info('Calling Makcorps API', { cityid: params.cityid });

      let response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new Error(`Makcorps API network error: ${(error as Error).message}`);
  }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Makcorps API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json() as (MakcorpsHotel[] | MakcorpsHotel[][]);

      const hotels = Array.isArray(data) ? data.slice(0, -1).flat() as MakcorpsHotel[] : [];
      const pagination = Array.isArray(data) && data.length > 0
        ? (data[data.length - 1] as unknown as MakcorpsPagination[])
        : undefined;

      return {
        hotels,
        pagination: pagination?.[0],
      };
    },
  };
}
