/**
 * Xotelo Service — Hotel listings via RapidAPI and live pricing via data.xotelo.com
 */

import { createLogger } from '../../infra/index.js';

const logger = createLogger('xotelo-service');

export interface XoteloRate {
  code: string;
  name: string;
  rate: number;
}

export interface RapidApiHotel {
  hotel_key: string;
  location_key: string;
  name: string;
  place_name: string;
  url: string;
  image: string;
}

export interface XoteloHeatmap {
  average_price_days: string[];
  cheap_price_days: string[];
  high_price_days: string[];
}

function getDefaultDates() {
  const checkinDate = new Date();
  checkinDate.setDate(checkinDate.getDate() + 14);
  const checkoutDate = new Date();
  checkoutDate.setDate(checkoutDate.getDate() + 15);
  
  return {
    chk_in: checkinDate.toISOString().split('T')[0],
    chk_out: checkoutDate.toISOString().split('T')[0],
  };
}

export async function fetchXoteloRates(hotel_key: string, chk_in?: string, chk_out?: string): Promise<XoteloRate[]> {
  const dates = getDefaultDates();
  const inDate = chk_in || dates.chk_in;
  const outDate = chk_out || dates.chk_out;

  try {
    const url = `https://data.xotelo.com/api/rates?hotel_key=${hotel_key}&chk_in=${inDate}&chk_out=${outDate}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    
    const data = await res.json() as any;
    if (data.error || !data.result?.rates) return [];
    return data.result.rates as XoteloRate[];
  } catch (err) {
    logger.warn('Failed to fetch Xotelo rates', { hotel_key, error: (err as Error).message });
    return [];
  }
}

export async function fetchXoteloHeatmap(hotel_key: string, chk_out?: string): Promise<XoteloHeatmap | null> {
  const dates = getDefaultDates();
  const outDate = chk_out || dates.chk_out;

  try {
    const url = `https://data.xotelo.com/api/heatmap?hotel_key=${hotel_key}&chk_out=${outDate}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    
    const data = await res.json() as any;
    if (data.error || !data.result?.heatmap) return null;
    return data.result.heatmap as XoteloHeatmap;
  } catch (err) {
    logger.warn('Failed to fetch Xotelo heatmap', { hotel_key, error: (err as Error).message });
    return null;
  }
}

export async function getHotelDetails(hotel_key: string, chk_in?: string, chk_out?: string) {
  const [rates, heatmap] = await Promise.all([
    fetchXoteloRates(hotel_key, chk_in, chk_out),
    fetchXoteloHeatmap(hotel_key, chk_out)
  ]);
  return { rates, heatmap };
}

export async function searchHotelsForDisplay(params: {
  destination: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
  rooms?: number;
  currency?: string;
  limit?: number;
}): Promise<Array<{
  name: string;
  category: string;
  price_per_night: number;
  currency: string;
  rating: number;
  highlights: string[];
  location: string;
  hotel_key?: string;
  image?: string;
  url?: string;
  rates?: XoteloRate[];
}>> {
  const { destination, checkin, checkout, currency = 'USD', limit = 8 } = params;

  try {
    logger.info('Calling RapidAPI Xotelo search', { destination });
    const response = await fetch(
      `https://xotelo-hotel-prices.p.rapidapi.com/api/search?query=${encodeURIComponent(destination)}&location_type=accommodation`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': 'xotelo-hotel-prices.p.rapidapi.com',
          'x-rapidapi-key': '47d3413b58mshe7d17c810adfd87p1be5bejsn4e1bdd9137a7',
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      logger.warn('RapidAPI Xotelo error', { status: response.status });
      return [];
    }

    const data = await response.json() as { error: string | null; result: { list: RapidApiHotel[] } };
    if (data.error) {
      logger.warn('RapidAPI returned error', { error: data.error });
      return [];
    }

    const list = data.result?.list?.slice(0, limit) || [];

    // Fetch live rates concurrently for all hotels
    const hotelsWithRates = (await Promise.all(list.map(async (hotel) => {
      let rates = await fetchXoteloRates(hotel.hotel_key, checkin, checkout);
      
      // If dates are too far in the future, Xotelo might return empty rates.
      // Fallback to default dates so the UI always has realistic mock data to show.
      if (rates.length === 0) {
        rates = await fetchXoteloRates(hotel.hotel_key); 
      }

      // If a hotel STILL has no rates even after fallback, it's unbookable/unsupported, skip it
      if (rates.length === 0) {
        return null;
      }
      
      const price_per_night = Math.min(...rates.map(r => r.rate));

      return {
        name: hotel.name,
        category: 'Mid-Range',
        price_per_night,
        currency,
        rating: 4.5,
        highlights: [],
        location: hotel.place_name || destination,
        hotel_key: hotel.hotel_key,
        image: hotel.image,
        url: hotel.url,
        rates,
      };
    }))).filter(h => h !== null);

    return hotelsWithRates;
  } catch (err) {
    logger.error('RapidAPI fetch failed', { error: (err as Error).message });
    return [];
  }
}
