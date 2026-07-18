"use client";

import type { ToolCallData } from "@/types/chat";
import type { PlanSelectionItem, PlanSelectionType } from "@/types/plan-selection";
import type { SelectedPlanIds } from "./chat-types";
import ItineraryCard from "./ItineraryCard";
import BudgetCard from "./BudgetCard";
import HotelOptionsCard from "./HotelOptionsCard";
import ActivityOptionsCard from "./ActivityOptionsCard";
import FlightOptionsCard from "./FlightOptionsCard";
import TicketOptionsCard from "./TicketOptionsCard";
import ComparisonCard from "./ComparisonCard";
import PackageCreatedCard from "./PackageCreatedCard";
import QuoteCard from "./QuoteCard";
import CheckoutCard from "./CheckoutCard";
import VisaInfoCard from "./VisaInfoCard";

export interface ToolRenderContext {
  conversationId?: string | null;
}

export type { PlanSelectionType } from "@/types/plan-selection";

interface ToolCallRendererProps {
  toolCall: ToolCallData;
  conversationId?: string | null;
  onPlanSelect?: (type: PlanSelectionType, item: PlanSelectionItem) => void;
  selectedPlanIds?: SelectedPlanIds;
  selectingPlanId?: string | null;
}

type ToolFactory = (
  props: Record<string, unknown>,
  ctx: ToolRenderContext,
) => React.ReactElement;

const TOOL_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  show_itinerary: ItineraryCard as unknown as React.ComponentType<Record<string, unknown>>,
  show_budget_breakdown: BudgetCard as unknown as React.ComponentType<Record<string, unknown>>,
  show_comparison: ComparisonCard as unknown as React.ComponentType<Record<string, unknown>>,
  create_package: PackageCreatedCard as unknown as React.ComponentType<Record<string, unknown>>,
  generate_quote: QuoteCard as unknown as React.ComponentType<Record<string, unknown>>,
  show_visa_info: VisaInfoCard as unknown as React.ComponentType<Record<string, unknown>>,
};

const TOOL_FACTORIES: Record<string, ToolFactory> = {
  start_checkout: (props, ctx) => (
    <CheckoutCard
      quote_id={props.quote_id as string}
      checkout_url={props.checkout_url as string | undefined}
      payment_id={props.payment_id as string | undefined}
      return_url={props.return_url as string | undefined}
      conversation_id={ctx.conversationId ?? undefined}
      success={props.success as boolean | undefined}
      error={props.error as string | undefined}
    />
  ),
};

export default function ToolCallRenderer({
  toolCall,
  conversationId,
  onPlanSelect,
  selectedPlanIds,
  selectingPlanId,
}: ToolCallRendererProps) {
  const ctx: ToolRenderContext = { conversationId };

  if (toolCall.name === "show_hotel_options") {
    const options = toolCall.arguments.options as Array<
      Record<string, unknown> & { name: string; price_per_night: number; currency: string; category: string; rating: number }
    >;
    return (
      <HotelOptionsCard
        destination={toolCall.arguments.destination as string}
        options={options as unknown as Parameters<typeof HotelOptionsCard>[0]["options"]}
        selectedId={selectedPlanIds?.hotel}
        selectingId={selectingPlanId}
        onSelect={
          onPlanSelect
            ? (hotel) =>
                onPlanSelect("hotel", {
                  name: hotel.name,
                  price_per_night: hotel.price_per_night,
                  currency: hotel.currency,
                  category: hotel.category,
                  rating: hotel.rating,
                  location: hotel.location,
                  hotel_id: hotel.hotel_id,
                  vendor: hotel.vendor,
                  listing_id: hotel.listing_id || hotel.hotel_key,
                  source: hotel.source,
                  featured: hotel.featured,
                })
            : undefined
        }
      />
    );
  }

  if (toolCall.name === "show_activity_options") {
    const activities = toolCall.arguments.activities as Array<
      Record<string, unknown> & { name: string; description: string; duration: string; category: string }
    >;
    return (
      <ActivityOptionsCard
        destination={toolCall.arguments.destination as string}
        activities={activities as unknown as Parameters<typeof ActivityOptionsCard>[0]["activities"]}
        selectedIds={selectedPlanIds?.activities}
        selectingId={selectingPlanId}
        onSelect={
          onPlanSelect
            ? (activity) =>
                onPlanSelect("activity", {
                  name: activity.name,
                  description: activity.description,
                  duration: activity.duration,
                  category: activity.category,
                  place_id: activity.place_id,
                  address: activity.address,
                  listing_id: activity.listing_id,
                  source: activity.source,
                  featured: activity.featured,
                })
            : undefined
        }
      />
    );
  }

  if (toolCall.name === "show_flight_options") {
    const options = toolCall.arguments.options as Array<{
      route_id: string;
      airline_iata: string;
      departure_iata: string;
      arrival_iata: string;
      label: string;
      listing_id?: string;
      source?: string;
      featured?: boolean;
    }>;
    return (
      <FlightOptionsCard
        destination={toolCall.arguments.destination as string}
        note={toolCall.arguments.note as string | undefined}
        options={options as unknown as Parameters<typeof FlightOptionsCard>[0]["options"]}
        selectedId={selectedPlanIds?.flight}
        selectingId={selectingPlanId}
        onSelect={
          onPlanSelect
            ? (route) =>
                onPlanSelect("flight", {
                  route_id: route.route_id,
                  airline_iata: route.airline_iata,
                  departure_iata: route.departure_iata,
                  arrival_iata: route.arrival_iata,
                  label: route.label,
                  listing_id: route.listing_id,
                  source: route.source,
                  featured: route.featured,
                })
            : undefined
        }
      />
    );
  }

  if (toolCall.name === "show_ticket_options") {
    const tickets = toolCall.arguments.tickets as Array<{
      name: string;
      venue?: string;
      event_date?: string;
      seat_class?: string;
      price: number;
      cost_amount?: number;
      currency: string;
      listing_id?: string;
      description?: string;
      source?: string;
      featured?: boolean;
      badges?: string[];
    }>;
    return (
      <TicketOptionsCard
        destination={toolCall.arguments.destination as string}
        tickets={tickets as unknown as Parameters<typeof TicketOptionsCard>[0]["tickets"]}
        selectedId={selectedPlanIds?.ticket}
        selectingId={selectingPlanId}
        onSelect={
          onPlanSelect
            ? (ticket) => {
                if (!ticket.listing_id) return;
                onPlanSelect("ticket", {
                  name: ticket.name,
                  venue: ticket.venue,
                  event_date: ticket.event_date,
                  seat_class: ticket.seat_class,
                  listing_id: ticket.listing_id,
                  sell_amount: ticket.price,
                  cost_amount: ticket.price,
                  currency: ticket.currency,
                  source: ticket.source,
                  featured: ticket.featured,
                });
              }
            : undefined
        }
      />
    );
  }

  const factory = TOOL_FACTORIES[toolCall.name];

  if (factory) {
    return factory(toolCall.arguments, ctx);
  }

  const Component = TOOL_COMPONENTS[toolCall.name];
  if (!Component) {
    return (
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        <span className="font-mono text-xs">{toolCall.name}</span> — Tool result rendered
      </div>
    );
  }

  return <Component {...toolCall.arguments} />;
}
