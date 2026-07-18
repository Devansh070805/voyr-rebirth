import { ValidationError } from '../../infra/error-handler.js';
import type {
  PlanSelectionRequest,
  SelectedActivity,
  SelectedFlightRoute,
  SelectedHotel,
  SelectedTicket,
} from './trip-plan.types.js';

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
}

function asNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(n)) return n;
  }
  throw new ValidationError(`${field} must be a number`);
}

function coerceNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
}

function parseHotelItem(raw: Record<string, unknown>): SelectedHotel {
  return {
    name: asString(raw.name, 'item.name'),
    price_per_night: coerceNumber(raw.price_per_night, 0),
    currency: optionalString(raw.currency) ?? 'USD',
    category: optionalString(raw.category) ?? 'Standard',
    rating: coerceNumber(raw.rating, 4),
    location: optionalString(raw.location),
    hotel_id: optionalNumber(raw.hotel_id),
    vendor: optionalString(raw.vendor),
    source: raw.source === 'curated' ? 'curated' : 'api',
    listing_id: optionalString(raw.listing_id),
    cost_amount: optionalNumber(raw.cost_amount),
    sell_amount: optionalNumber(raw.sell_amount),
    supply_source: optionalString(raw.supply_source)
      ?? (raw.source === 'curated' ? 'curated' : 'makcorps'),
  };
}

function parseActivityItem(raw: Record<string, unknown>): SelectedActivity {
  return {
    name: asString(raw.name, 'item.name'),
    description: optionalString(raw.description) ?? asString(raw.name, 'item.name'),
    duration: optionalString(raw.duration) ?? '3 hours',
    category: optionalString(raw.category) ?? 'Experience',
    place_id: optionalString(raw.place_id),
    address: optionalString(raw.address),
    source: raw.source === 'curated' ? 'curated' : 'api',
    listing_id: optionalString(raw.listing_id),
    price: optionalNumber(raw.price),
    currency: optionalString(raw.currency),
    cost_amount: optionalNumber(raw.cost_amount),
    sell_amount: optionalNumber(raw.sell_amount),
  };
}

function parseFlightItem(raw: Record<string, unknown>): SelectedFlightRoute {
  return {
    route_id: asString(raw.route_id, 'item.route_id'),
    airline_iata: asString(raw.airline_iata, 'item.airline_iata'),
    departure_iata: asString(raw.departure_iata, 'item.departure_iata'),
    arrival_iata: asString(raw.arrival_iata, 'item.arrival_iata'),
    label: asString(raw.label, 'item.label'),
    source: raw.source === 'curated' ? 'curated' : 'api',
    listing_id: optionalString(raw.listing_id),
    sell_amount: optionalNumber(raw.sell_amount),
    cost_amount: optionalNumber(raw.cost_amount),
  };
}

function parseTicketItem(raw: Record<string, unknown>): SelectedTicket {
  return {
    name: asString(raw.name, 'item.name'),
    venue: optionalString(raw.venue),
    event_date: optionalString(raw.event_date),
    seat_class: optionalString(raw.seat_class),
    listing_id: asString(raw.listing_id, 'item.listing_id'),
    sell_amount: asNumber(raw.sell_amount, 'item.sell_amount'),
    cost_amount: asNumber(raw.cost_amount, 'item.cost_amount'),
    currency: optionalString(raw.currency) ?? 'USD',
  };
}

export function parsePlanSelection(body: {
  type?: unknown;
  item?: unknown;
}): PlanSelectionRequest {
  const type = body.type;
  if (
    type !== 'hotel'
    && type !== 'activity'
    && type !== 'flight'
    && type !== 'ticket'
    && type !== 'remove_activity'
  ) {
    throw new ValidationError('type must be hotel, activity, flight, ticket, or remove_activity');
  }

  const item = body.item;
  if (!item || typeof item !== 'object') {
    throw new ValidationError('item is required');
  }
  const raw = item as Record<string, unknown>;

  switch (type) {
    case 'hotel':
      return { type: 'hotel', item: parseHotelItem(raw) };
    case 'activity':
      return { type: 'activity', item: parseActivityItem(raw) };
    case 'flight':
      return { type: 'flight', item: parseFlightItem(raw) };
    case 'ticket':
      return { type: 'ticket', item: parseTicketItem(raw) };
    case 'remove_activity':
      return {
        type: 'remove_activity',
        item: {
          name: asString(raw.name, 'item.name'),
          listing_id: optionalString(raw.listing_id),
        },
      };
  }
}
