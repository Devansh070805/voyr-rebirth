import { emptyTripPlan, type TripPlan } from '../trip-plan/trip-plan.types.js';
import { buildDisplayToolsFromPlan, buildFollowUpToolsFromPlan } from './display-tools-builder.js';

describe('buildDisplayToolsFromPlan', () => {
  it('builds cards only from live API data', () => {
    const plan: TripPlan = {
      ...emptyTripPlan(),
      destination: 'bali',
      nights: 5,
      days: 6,
      travelers: 2,
      live_data: {
        hotels: [
          {
            hotelId: 1,
            name: 'Live Resort Ubud',
            geocode: { latitude: 0, longitude: 0 },
            reviews: { rating: 4.5, count: 200 },
            vendor1: 'Booking.com',
            price1: '$120',
          },
        ],
        places: [
          {
            id: 'p1',
            name: 'Tegallalang Rice Terrace',
            lat: 0,
            lon: 0,
            address: 'Ubud',
            categories: ['tourism.sights'],
          },
        ],
        routes: [
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
        curated: [],
        fetched_at: new Date().toISOString(),
      },
    };

    const tools = buildDisplayToolsFromPlan(plan);
    const names = tools.map((t) => t.name);

    expect(names).toContain('show_hotel_options');
    expect(names).toContain('show_activity_options');
    expect(names).toContain('show_flight_options');
    expect(names).toContain('show_itinerary');
    expect(names).toContain('show_budget_breakdown');

    const hotels = tools.find((t) => t.name === 'show_hotel_options');
    expect(hotels?.arguments).toEqual(
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ name: 'Live Resort Ubud' }),
        ]),
      }),
    );
  });

  it('returns no hotel card when live hotels are empty', () => {
    const plan: TripPlan = {
      ...emptyTripPlan(),
      destination: 'bali',
      nights: 3,
      days: 4,
      travelers: 2,
      live_data: {
        hotels: [],
        places: [],
        routes: [],
        curated: [],
        fetched_at: null,
      },
    };

    const tools = buildDisplayToolsFromPlan(plan);
    expect(tools.some((t) => t.name === 'show_hotel_options')).toBe(false);
  });

  it('prepends curated listings before API hotels', () => {
    const plan: TripPlan = {
      ...emptyTripPlan(),
      destination: 'bali',
      nights: 3,
      days: 4,
      travelers: 2,
      live_data: {
        hotels: [
          {
            hotelId: 1,
            name: 'API Hotel',
            geocode: { latitude: 0, longitude: 0 },
            reviews: { rating: 4, count: 10 },
            vendor1: 'OTA',
            price1: '$100',
          },
        ],
        places: [],
        routes: [],
        curated: [
          {
            listing_id: 'c1',
            listing_type: 'hotel',
            title: 'Voyr Resort',
            description: 'Pick',
            destination_slug: 'bali',
            cost_price: 80,
            sell_price: 120,
            currency: 'USD',
            source: 'curated',
            featured: true,
            supply_source: 'curated',
            payload: { rating: 5 },
            badges: ['Voyr Pick'],
          },
        ],
        fetched_at: new Date().toISOString(),
      },
    };

    const tools = buildDisplayToolsFromPlan(plan);
    const hotels = tools.find((t) => t.name === 'show_hotel_options');
    const options = (hotels?.arguments as { options: { name: string; featured?: boolean }[] }).options;
    expect(options[0].name).toBe('Voyr Resort');
    expect(options[0].featured).toBe(true);
  });
});

describe('buildFollowUpToolsFromPlan', () => {
  it('returns activity card for activity follow-up', () => {
    const plan: TripPlan = {
      ...emptyTripPlan(),
      destination: 'bali',
      live_data: {
        hotels: [],
        places: [{ id: '1', name: 'Temple', lat: 0, lon: 0, address: 'Bali', categories: [] }],
        routes: [],
        curated: [],
        fetched_at: null,
      },
    };

    const tools = buildFollowUpToolsFromPlan(plan, 'activities');
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('show_activity_options');
  });
});
