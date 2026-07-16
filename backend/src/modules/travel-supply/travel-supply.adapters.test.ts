import { describe, it, expect, vi } from 'vitest';
import {
  createAviationStackAdapter,
  createMakcorpsAdapter,
  createRiyaConnectAdapter,
} from './travel-supply.adapters.js';
import { NotImplementedSupplyError } from './travel-supply.types.js';

describe('travel-supply adapters', () => {
  it('makcorps adapter maps hotel search offers', async () => {
    const makcorps = {
      searchHotels: vi.fn().mockResolvedValue({
        hotels: [
          {
            hotelId: 1,
            name: 'Test Hotel',
            geocode: { latitude: 0, longitude: 0 },
            reviews: { rating: 4, count: 10 },
            vendor1: 'OTA',
            price1: '$99',
          },
        ],
      }),
    };
    const adapter = createMakcorpsAdapter(makcorps as never);
    const offers = await adapter.search({
      product: 'hotel',
      cityid: '123',
      checkin: '2026-07-01',
      checkout: '2026-07-04',
      travelers: 2,
    });
    expect(offers).toHaveLength(1);
    expect(offers[0].provider).toBe('makcorps');
    expect((offers[0].raw as { name: string }).name).toBe('Test Hotel');
  });

  it('aviation_stack adapter filters routes by arrival airport', async () => {
    const aviation = {
      getRoutes: vi.fn().mockResolvedValue({
        data: [
          {
            route_id: 'r1',
            airline_iata: 'SQ',
            airline_icao: 'SIA',
            departure_airport_iata: 'SIN',
            departure_airport_icao: 'WSSS',
            arrival_airport_iata: 'DPS',
            arrival_airport_icao: 'WADD',
          },
        ],
      }),
    };
    const adapter = createAviationStackAdapter(aviation as never);
    const offers = await adapter.search({ product: 'flight', arrivalIata: 'DPS', limit: 8 });
    expect(aviation.getRoutes).toHaveBeenCalledWith({ limit: 8, arrivalIata: 'DPS' });
    expect(offers).toHaveLength(1);
    expect(offers[0].provider).toBe('aviation_stack');
  });

  it('riya_connect book throws NotImplementedSupplyError', async () => {
    const adapter = createRiyaConnectAdapter();
    await expect(adapter.book('ref', [{ name: 'A', type: 'adult' }])).rejects.toBeInstanceOf(
      NotImplementedSupplyError,
    );
  });
});
