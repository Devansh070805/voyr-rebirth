import { emptyTripPlan, type TripPlan } from '../trip-plan/trip-plan.types.js';
import { sanitizeDisplayToolCall } from './display-tool-guard.js';

function planWithHotels(): TripPlan {
  return {
    ...emptyTripPlan(),
    destination: 'bali',
    nights: 3,
    days: 4,
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
      places: [],
      routes: [],
      curated: [],
      fetched_at: new Date().toISOString(),
    },
  };
}

describe('sanitizeDisplayToolCall', () => {
  it('passes through show_hotel_options when it contains real Xotelo options', () => {
    const plan = { ...emptyTripPlan(), destination: 'bali' };
    const xoteloOptions = [
      { name: 'Grand Hyatt Bali', category: 'Luxury', price_per_night: 250, currency: 'USD', rating: 5, highlights: ['Pool', 'Spa'] },
    ];
    const sanitized = sanitizeDisplayToolCall(
      {
        id: 'xotelo-1',
        name: 'show_hotel_options',
        arguments: { destination: 'Bali', options: xoteloOptions },
      },
      plan,
    );

    expect(sanitized).not.toBeNull();
    expect(sanitized!.id).toBe('xotelo-1');
    const options = (sanitized!.arguments as { options: { name: string }[] }).options;
    // Should pass through the Xotelo data unchanged
    expect(options.some((o) => o.name === 'Grand Hyatt Bali')).toBe(true);
  });

  it('drops show_hotel_options with empty options when plan has no backing data', () => {
    const plan = { ...emptyTripPlan(), destination: 'bali' };
    const sanitized = sanitizeDisplayToolCall(
      { id: 'llm-2', name: 'show_hotel_options', arguments: { destination: 'Bali', options: [] } },
      plan,
    );
    expect(sanitized).toBeNull();
  });

  it('drops visa cards when destination does not match the active plan', () => {
    const plan = { ...emptyTripPlan(), destination: 'bali', country: 'Indonesia' };
    const sanitized = sanitizeDisplayToolCall(
      {
        id: 'llm-3',
        name: 'show_visa_info',
        arguments: { destination: 'France', passport_country: 'India', visa_status: 'visa_required' },
      },
      plan,
    );
    expect(sanitized).toBeNull();
  });
});
