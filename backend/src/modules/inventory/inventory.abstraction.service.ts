import { createLogger } from '../../infra/index.js';

const logger = createLogger('inventory-abstraction');

export interface CuratedExperience {
  id: string;
  title: string;
  destination: string;
  duration_days: number;
  inclusions: string[];
  exclusions: string[];
  day_by_day_itinerary: { day: number; title: string; description: string }[];
  images: string[];
  availability: 'AVAILABLE' | 'WAITLIST' | 'SOLD_OUT';
  terms: string;
  source: 'MANUAL_CURATED' | 'MAKCORPS' | 'AVIATION_STACK';
}

export interface InventoryAbstractionService {
  searchInventory(query: string, provider: 'MAKCORPS' | 'AVIATION_STACK' | 'ALL'): Promise<CuratedExperience[]>;
  getExperienceDetails(id: string): Promise<CuratedExperience | null>;
}

export function createInventoryAbstractionService(): InventoryAbstractionService {
  // Mock local fallback inventory
  const mockInventory: CuratedExperience[] = [
    {
      id: 'mock-1',
      title: 'Premium Kyoto Autumn Tour',
      destination: 'Kyoto, Japan',
      duration_days: 7,
      inclusions: ['Premium Hotels', 'Bullet Train Passes', 'Guided Tours'],
      exclusions: ['International Flights', 'Personal Expenses'],
      day_by_day_itinerary: [
        { day: 1, title: 'Arrival', description: 'Arrive in Tokyo, transfer to Kyoto' },
        { day: 2, title: 'Temples', description: 'Visit Kinkaku-ji and Fushimi Inari' },
      ],
      images: ['https://voyr.com/images/kyoto1.jpg'],
      availability: 'AVAILABLE',
      terms: 'Non-refundable within 30 days of departure.',
      source: 'MANUAL_CURATED'
    }
  ];

  return {
    async searchInventory(query: string, provider: 'MAKCORPS' | 'AVIATION_STACK' | 'ALL'): Promise<CuratedExperience[]> {
      try {
        if (provider === 'MAKCORPS' || provider === 'ALL') {
          // Attempt external hook
          logger.info(`Searching Makcorps for: ${query}`);
          // const res = await fetch(...)
          // throw new Error('Makcorps API unreachable'); // Simulate failure
        }
        
        // Simulating immediate fallback to local curated repo for demonstration
        logger.warn('External hooks failed or skipped. Falling back to local curated inventory.');
        return mockInventory.filter(exp => exp.destination.toLowerCase().includes(query.toLowerCase()) || exp.title.toLowerCase().includes(query.toLowerCase()));
      } catch (err) {
        logger.error('Inventory search failed entirely', { error: (err as Error).message });
        return mockInventory;
      }
    },

    async getExperienceDetails(id: string): Promise<CuratedExperience | null> {
      return mockInventory.find(exp => exp.id === id) || null;
    }
  };
}
