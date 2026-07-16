import { describe, it, expect } from 'vitest';
import { routeBrokerFlow } from './broker-flow.router.js';
import { guardAssistantResponse } from './response-guard.service.js';
import { emptyTripPlan } from '../trip-plan/trip-plan.types.js';

const COVERAGE: Array<{
  name: string;
  message: string;
  plan: ReturnType<typeof emptyTripPlan>;
  history?: { role: 'user' | 'assistant'; content: string }[];
  expectType: 'followup_cards' | 'full_plan_cards' | 'llm';
  followUp?: string;
}> = [
  {
    name: 'follow-up hotels',
    message: 'show me hotels',
    plan: { ...emptyTripPlan(), destination: 'bali' },
    expectType: 'followup_cards',
    followUp: 'hotels',
  },
  {
    name: 'follow-up tickets',
    message: 'any concert tickets?',
    plan: { ...emptyTripPlan(), destination: 'bali' },
    expectType: 'followup_cards',
    followUp: 'tickets',
  },
  {
    name: 'new trip with destination in plan',
    message: 'plan bali 5 nights',
    plan: { ...emptyTripPlan(), destination: 'bali' },
    expectType: 'full_plan_cards',
  },
  {
    name: 'checkout with hotel selected',
    message: 'ready to pay now',
    plan: {
      ...emptyTripPlan(),
      destination: 'bali',
      selected_hotel: {
        name: 'Resort',
        price_per_night: 100,
        currency: 'USD',
        category: 'Mid-Range',
        rating: 4,
      },
    },
    expectType: 'llm',
  },
  {
    name: 'general greeting',
    message: 'hello there',
    plan: emptyTripPlan(),
    expectType: 'llm',
  },
];

describe('routeBrokerFlow coverage', () => {
  it.each(COVERAGE)('$name → $expectType', ({ message, plan, history, expectType, followUp }) => {
    const action = routeBrokerFlow(message, history ?? [], plan);
    expect(action.type).toBe(expectType);
    if (expectType === 'followup_cards' && action.type === 'followup_cards') {
      expect(action.followUp).toBe(followUp);
    }
  });
});

describe('guardAssistantResponse', () => {
  it('strips AI self-reference', () => {
    const plan = emptyTripPlan();
    const result = guardAssistantResponse('As an AI I cannot help.', plan);
    expect(result.violations).toContain('ai_self_reference');
  });
});
