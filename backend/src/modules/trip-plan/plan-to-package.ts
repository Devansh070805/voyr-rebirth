import { NotFoundError } from '../../infra/index.js';
import type { CuratedListingsService } from '../curated-listings/curated-listings.service.js';
import type { CustomerSegment } from '../curated-listings/curated-listings.types.js';
import type { SupplyLineSnapshot } from '../pricing/pricing.types.js';
import type { TripPlan } from './trip-plan.types.js';
import { defaultStartDate, marginBetween } from './trip-plan.utils.js';

export interface PlanPackageLine {
  option_id: string;
  quantity: number;
  selected_date: string;
  broker: SupplyLineSnapshot & { name: string; listing_id?: string };
}

export type SkippedSelectionReason = 'missing_listing_id' | 'missing_inventory_link';

export interface SkippedPlanSelection {
  kind: 'hotel' | 'activity' | 'flight' | 'ticket';
  name: string;
  reason: SkippedSelectionReason;
}

export interface PlanToPackageResult {
  lines: PlanPackageLine[];
  skipped: SkippedPlanSelection[];
}

async function resolveInventoryOptionId(
  curatedListings: CuratedListingsService,
  listingId?: string,
): Promise<string | null> {
  if (!listingId) return null;
  try {
    const listing = await curatedListings.getById(listingId);
    return listing.inventory_option_id ?? null;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

function countPlanSelections(plan: TripPlan): number {
  let count = 0;
  if (plan.selected_hotel) count += 1;
  count += plan.selected_activities.length;
  if (plan.selected_flight) count += 1;
  if (plan.selected_ticket) count += 1;
  return count;
}

export function planHasSelections(plan: TripPlan): boolean {
  return countPlanSelections(plan) > 0;
}

export async function planToPackageItems(
  plan: TripPlan,
  deps: { curatedListings: CuratedListingsService },
): Promise<PlanToPackageResult> {
  const lines: PlanPackageLine[] = [];
  const skipped: SkippedPlanSelection[] = [];
  const segment: CustomerSegment = plan.customer_segment ?? 'b2c';
  const selectedDate = plan.checkin || defaultStartDate();

  if (plan.selected_hotel) {
    const hotel = plan.selected_hotel;
    if (!hotel.listing_id) {
      skipped.push({ kind: 'hotel', name: hotel.name, reason: 'missing_listing_id' });
    } else {
      const optionId = await resolveInventoryOptionId(deps.curatedListings, hotel.listing_id);
      if (!optionId) {
        skipped.push({ kind: 'hotel', name: hotel.name, reason: 'missing_inventory_link' });
      } else {
        const sell = hotel.sell_amount ?? hotel.price_per_night;
        const cost = hotel.cost_amount ?? sell;
        lines.push({
          option_id: optionId,
          quantity: Math.max(1, plan.nights),
          selected_date: selectedDate,
          broker: {
            name: hotel.name,
            listing_id: hotel.listing_id,
            supply_source: hotel.supply_source ?? (hotel.source === 'curated' ? 'curated' : 'makcorps'),
            supply_product: 'hotel',
            cost_amount: cost,
            sell_amount: sell,
            margin_amount: marginBetween(sell, cost),
            margin_rule_id: null,
            customer_segment: segment,
            curated_listing_id: hotel.listing_id,
            currency: hotel.currency,
          },
        });
      }
    }
  }

  for (const activity of plan.selected_activities) {
    if (!activity.listing_id) {
      skipped.push({ kind: 'activity', name: activity.name, reason: 'missing_listing_id' });
      continue;
    }
    const optionId = await resolveInventoryOptionId(deps.curatedListings, activity.listing_id);
    if (!optionId) {
      skipped.push({ kind: 'activity', name: activity.name, reason: 'missing_inventory_link' });
      continue;
    }
    const sell = activity.sell_amount ?? activity.price ?? 0;
    const cost = activity.cost_amount ?? sell;
    lines.push({
      option_id: optionId,
      quantity: 1,
      selected_date: selectedDate,
      broker: {
        name: activity.name,
        listing_id: activity.listing_id,
        supply_source: activity.source === 'curated' ? 'curated' : 'geoapify',
        supply_product: 'activity',
        cost_amount: cost,
        sell_amount: sell,
        margin_amount: marginBetween(sell, cost),
        margin_rule_id: null,
        customer_segment: segment,
        curated_listing_id: activity.listing_id,
        currency: activity.currency ?? 'USD',
      },
    });
  }

  if (plan.selected_flight) {
    const flight = plan.selected_flight;
    if (!flight.listing_id) {
      skipped.push({ kind: 'flight', name: flight.label, reason: 'missing_listing_id' });
    } else {
      const optionId = await resolveInventoryOptionId(deps.curatedListings, flight.listing_id);
      if (!optionId) {
        skipped.push({ kind: 'flight', name: flight.label, reason: 'missing_inventory_link' });
      } else {
        const sell = flight.sell_amount ?? 0;
        const cost = flight.cost_amount ?? sell;
        lines.push({
          option_id: optionId,
          quantity: 1,
          selected_date: selectedDate,
          broker: {
            name: flight.label,
            listing_id: flight.listing_id,
            supply_source: flight.source === 'curated' ? 'curated' : 'aviation_stack',
            supply_product: 'flight',
            cost_amount: cost,
            sell_amount: sell,
            margin_amount: marginBetween(sell, cost),
            margin_rule_id: null,
            customer_segment: segment,
            curated_listing_id: flight.listing_id,
            currency: 'USD',
          },
        });
      }
    }
  }

  if (plan.selected_ticket) {
    const ticket = plan.selected_ticket;
    const optionId = await resolveInventoryOptionId(deps.curatedListings, ticket.listing_id);
    if (!optionId) {
      skipped.push({
        kind: 'ticket',
        name: ticket.name,
        reason: 'missing_inventory_link',
      });
    } else {
      lines.push({
        option_id: optionId,
        quantity: 1,
        selected_date: selectedDate,
        broker: {
          name: ticket.name,
          listing_id: ticket.listing_id,
          supply_source: 'curated',
          supply_product: 'ticket',
          cost_amount: ticket.cost_amount,
          sell_amount: ticket.sell_amount,
          margin_amount: marginBetween(ticket.sell_amount, ticket.cost_amount),
          margin_rule_id: null,
          customer_segment: segment,
          curated_listing_id: ticket.listing_id,
          currency: ticket.currency,
        },
      });
    }
  }

  return { lines, skipped };
}

export function brokerSnapshotForPackageLine(
  broker: PlanPackageLine['broker'],
): Record<string, unknown> {
  return {
    supply_source: broker.supply_source,
    supply_product: broker.supply_product,
    cost_amount: broker.cost_amount,
    sell_amount: broker.sell_amount,
    margin_amount: broker.margin_amount,
    margin_rule_id: broker.margin_rule_id,
    customer_segment: broker.customer_segment,
    curated_listing_id: broker.curated_listing_id,
    currency: broker.currency,
    broker_name: broker.name,
  };
}
