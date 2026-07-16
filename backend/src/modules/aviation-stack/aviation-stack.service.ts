import { createLogger, ValidationError } from '../../infra/index.js';

const logger = createLogger('aviation-stack-service');
const BASE_URL = 'https://api.aviationstack.com/v1';

function getApiKey(): string {
  const key = process.env.AVIATION_STACK_API_KEY;
  if (!key) {
    throw new ValidationError('AVIATION_STACK_API_KEY is not configured');
  }
  return key;
}

interface AviationStackResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
}

export interface Flight {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    delay: number;
    scheduled: string;
    estimated: string;
    actual: string;
    estimated_runway: string;
    actual_runway: string;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    baggage: string;
    delay: number;
    scheduled: string;
    estimated: string;
    actual: string;
    estimated_runway: string;
    actual_runway: string;
  };
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  flight: {
    number: string;
    iata: string;
    icao: string;
  };
  aircraft?: {
    registration: string;
    iata: string;
    icao: string;
    icao24: string;
  };
  live?: {
    updated: string;
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
    speed_vertical: number;
    is_ground: boolean;
  };
}

export interface Airport {
  airport_id: string;
  airport_name: string;
  iata_code: string;
  icao_code: string;
  country_name: string;
  city_name: string;
  latitude: number;
  longitude: number;
}

export interface Airline {
  airline_id: string;
  airline_name: string;
  iata_code: string;
  icao_code: string;
  country_name: string;
}

export interface Route {
  route_id: string;
  airline_iata: string;
  airline_icao: string;
  departure_airport_iata: string;
  departure_airport_icao: string;
  arrival_airport_iata: string;
  arrival_airport_icao: string;
}

export interface GetRoutesOptions {
  limit?: number;
  offset?: number;
  arrivalIata?: string;
  departureIata?: string;
}

export interface AviationStackService {
  getFlights(flightDate?: string, limit?: number, offset?: number): Promise<AviationStackResponse<Flight>>;
  getAirports(limit?: number, offset?: number): Promise<AviationStackResponse<Airport>>;
  getAirlines(limit?: number, offset?: number): Promise<AviationStackResponse<Airline>>;
  getRoutes(options?: GetRoutesOptions): Promise<AviationStackResponse<Route>>;
}

async function callAviationStack<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<AviationStackResponse<T>> {
  const apiKey = getApiKey();
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('access_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  logger.info('Calling Aviation Stack API', { endpoint });

  let response;
  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new Error(`Aviation Stack API network error: ${(error as Error).message}`);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Aviation Stack API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<AviationStackResponse<T>>;
}

export function createAviationStackService(): AviationStackService {
  return {
    async getFlights(flightDate?: string, limit = 100, offset = 0): Promise<AviationStackResponse<Flight>> {
      const params: Record<string, string | number> = { limit, offset };
      if (flightDate) params.flight_date = flightDate;
      return callAviationStack<Flight>('/flights', params);
    },

    async getAirports(limit = 100, offset = 0): Promise<AviationStackResponse<Airport>> {
      return callAviationStack<Airport>('/airports', { limit, offset });
    },

    async getAirlines(limit = 100, offset = 0): Promise<AviationStackResponse<Airline>> {
      return callAviationStack<Airline>('/airlines', { limit, offset });
    },

    async getRoutes(options: GetRoutesOptions = {}): Promise<AviationStackResponse<Route>> {
      const { limit = 100, offset = 0, arrivalIata, departureIata } = options;
      const params: Record<string, string | number> = { limit, offset };
      if (arrivalIata) params.arr_iata = arrivalIata;
      if (departureIata) params.dep_iata = departureIata;
      return callAviationStack<Route>('/routes', params);
    },
  };
}
