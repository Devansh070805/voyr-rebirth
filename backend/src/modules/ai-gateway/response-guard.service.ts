import type { TripPlan } from '../trip-plan/trip-plan.types.js';

const PRICE_PATTERN = /\$\d+|\d+\s*(USD|INR|EUR|per night)/i;

function collectAllowedNames(plan: TripPlan): Set<string> {
  const names = new Set<string>();
  for (const h of plan.live_data.hotels) names.add(h.name.toLowerCase());
  for (const p of plan.live_data.places) names.add(p.name.toLowerCase());
  for (const c of plan.live_data.curated) names.add(c.title.toLowerCase());
  if (plan.selected_hotel) names.add(plan.selected_hotel.name.toLowerCase());
  for (const a of plan.selected_activities) names.add(a.name.toLowerCase());
  if (plan.selected_flight) names.add(plan.selected_flight.label.toLowerCase());
  if (plan.selected_ticket) names.add(plan.selected_ticket.name.toLowerCase());
  return names;
}

export interface GuardResult {
  text: string;
  violations: string[];
}

export function guardAssistantResponse(text: string, plan: TripPlan): GuardResult {
  const violations: string[] = [];
  const allowed = collectAllowedNames(plan);
  let output = text;

  if (/as an ai|language model|i'm an ai/i.test(output)) {
    violations.push('ai_self_reference');
    output = output.replace(/as an ai[^.!?]*[.!?]?/gi, '').trim();
  }

  const quoted = output.match(/"([^"]{3,60})"/g) ?? [];
  for (const q of quoted) {
    const name = q.slice(1, -1).toLowerCase();
    if (allowed.size > 0 && ![...allowed].some((a) => name.includes(a) || a.includes(name))) {
      violations.push(`ungrounded_name:${name}`);
    }
  }

  if (PRICE_PATTERN.test(output) && plan.live_data.hotels.length === 0 && plan.live_data.curated.length === 0) {
    violations.push('fabricated_price');
    output = output.replace(PRICE_PATTERN, 'see the cards above for rates');
  }

  if (violations.length > 0 && violations.every((v) => v.startsWith('ungrounded_name'))) {
    output += '\n\n*(Rates and options are in the cards above — tap to select.)*';
  }

  return { text: output, violations };
}
