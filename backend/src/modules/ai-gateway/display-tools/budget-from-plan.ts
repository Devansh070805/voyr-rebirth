import type { TripPlan } from '../../trip-plan/trip-plan.types.js';
import { capitalize, curatedByType, parsePrice } from './plan-helpers.js';

export function buildBudgetFromPlan(plan: TripPlan): Record<string, unknown> | null {
  if (!plan.destination) return null;

  const nightly = plan.selected_hotel?.price_per_night
    ?? curatedByType(plan, 'hotel')[0]?.sell_price
    ?? (() => {
      const prices = plan.live_data.hotels
        .map((h) => parsePrice(h.price1 || h.price2))
        .filter((p) => p > 0);
      return prices.length > 0
        ? prices.reduce((sum, p) => sum + p, 0) / prices.length
        : 0;
    })();

  if (nightly <= 0 && !plan.selected_hotel && !plan.selected_ticket) return null;

  const hotelTotal = Math.round((nightly || 0) * plan.nights);
  const activityTotal = plan.selected_activities.reduce((sum, a) => sum + (a.sell_amount ?? a.price ?? 40), 0);
  const ticketTotal = plan.selected_ticket?.sell_amount ?? 0;
  const flightNote = plan.selected_flight
    ? `Route ${plan.selected_flight.label} — fare on request`
    : 'Estimate — select a route for a tailored quote';
  const flights = plan.selected_flight?.sell_amount ?? (plan.selected_flight ? 500 : 0);
  const meals = Math.round(plan.days * 35);
  const transfers = 80;
  const totalPerPerson = hotelTotal + flights + activityTotal + ticketTotal + meals + transfers;

  const items = [
    ...(flights > 0
      ? [{ category: 'Flights (est.)', amount: flights, note: flightNote }]
      : [{ category: 'Flights', amount: 0, note: flightNote }]),
    ...(hotelTotal > 0
      ? [{ category: 'Hotels', amount: hotelTotal, note: `${plan.nights} nights${plan.selected_hotel ? ` at ${plan.selected_hotel.name}` : ''}` }]
      : []),
    ...(activityTotal > 0
      ? [{ category: 'Activities', amount: activityTotal, note: `${plan.selected_activities.length} selected experiences` }]
      : []),
    ...(ticketTotal > 0
      ? [{ category: 'Tickets', amount: ticketTotal, note: plan.selected_ticket?.name }]
      : []),
    { category: 'Meals', amount: meals, note: 'Mix of local & mid-range dining' },
    { category: 'Transfers', amount: transfers, note: 'Airport & local transport' },
  ];

  return {
    destination: capitalize(plan.destination),
    currency: 'USD',
    travelers: plan.travelers,
    items,
    total_per_person: totalPerPerson,
    total_trip: totalPerPerson * plan.travelers,
  };
}
