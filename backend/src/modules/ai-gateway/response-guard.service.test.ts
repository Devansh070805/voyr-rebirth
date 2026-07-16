import { emptyTripPlan } from '../trip-plan/trip-plan.types.js';
import { guardAssistantResponse } from './response-guard.service.js';

describe('guardAssistantResponse', () => {
  it('strips AI self-reference phrasing', () => {
    const plan = emptyTripPlan();
    const result = guardAssistantResponse('As an AI language model, I suggest Bali.', plan);
    expect(result.violations).toContain('ai_self_reference');
    expect(result.text.toLowerCase()).not.toContain('language model');
  });

  it('flags fabricated prices when no inventory cards exist', () => {
    const plan = emptyTripPlan();
    const result = guardAssistantResponse('Hotels start at $120 per night.', plan);
    expect(result.violations).toContain('fabricated_price');
  });

  it('allows quoted names present in plan data', () => {
    const plan = {
      ...emptyTripPlan(),
      live_data: {
        ...emptyTripPlan().live_data,
        curated: [
          {
            listing_id: 'c1',
            listing_type: 'hotel' as const,
            title: 'Voyr Resort',
            description: '',
            destination_slug: 'bali',
            cost_price: 80,
            sell_price: 120,
            currency: 'USD',
            source: 'curated' as const,
            featured: true,
            supply_source: 'curated',
            payload: {},
            badges: ['Voyr Pick'],
          },
        ],
      },
    };
    const result = guardAssistantResponse('I recommend "Voyr Resort" from the cards above.', plan);
    expect(result.violations.filter((v) => v.startsWith('ungrounded_name'))).toHaveLength(0);
  });
});
