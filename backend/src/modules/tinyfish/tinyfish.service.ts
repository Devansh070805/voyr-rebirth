import { createLogger, ValidationError } from '../../infra/index.js';

const logger = createLogger('tinyfish-service');
const BASE_URL = 'https://api.search.tinyfish.ai';

function getApiKey(): string {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) {
    throw new ValidationError('TINYFISH_API_KEY is not configured');
  }
  return key;
}

export interface TinyFishSearchResult {
  position: number;
  site_name: string;
  title: string;
  snippet: string;
  url: string;
}

export interface TinyFishSearchResponse {
  query: string;
  results: TinyFishSearchResult[];
  total_results: number;
}

export interface SearchWebParams {
  query: string;
  location?: string;
  language?: string;
}

export interface TinyFishService {
  searchWeb(params: SearchWebParams): Promise<TinyFishSearchResponse>;
}

export function createTinyFishService(): TinyFishService {
  return {
    async searchWeb(params: SearchWebParams): Promise<TinyFishSearchResponse> {
      const apiKey = getApiKey();
      const url = new URL(BASE_URL);
      url.searchParams.set('query', params.query);
      if (params.location) url.searchParams.set('location', params.location);
      if (params.language) url.searchParams.set('language', params.language);

      logger.info('Calling TinyFish Search API', { query: params.query });

      const response = await fetch(url.toString(), {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`TinyFish API error (${response.status}): ${errorBody}`);
      }

      return response.json() as Promise<TinyFishSearchResponse>;
    },
  };
}
