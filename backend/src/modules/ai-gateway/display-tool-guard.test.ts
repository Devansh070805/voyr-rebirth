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
  it('replaces LLM hotel card args with plan_data inventory', () => {
    const plan = planWithHotels();
    const sanitized = sanitizeDisplayToolCall(
      {
        id: 'llm-1',
        name: 'show_hotel_options',
        arguments: {
          destination: 'Bali',
          options: [{ name: 'Fabricated Palace', category: 'Luxury', price_per_night: 50, currency: 'USD', rating: 5, highlights: [] }],
        },
      },
      plan,
    );

    expect(sanitized).not.toBeNull();
    expect(sanitized!.id).toBe('llm-1');
    const options = (sanitized!.arguments as { options: { name: string }[] }).options;
    expect(options.some((o) => o.name === 'Live Resort Ubud')).toBe(true);
    expect(options.some((o) => o.name === 'Fabricated Palace')).toBe(false);
  });

  it('drops plan-grounded tools when plan has no backing data', () => {
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
