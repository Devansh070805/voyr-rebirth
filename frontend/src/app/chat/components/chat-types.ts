import type { ChatMessage, ToolCallData } from "@/types/chat";

export interface DayPlan {
  day_number: number;
  title: string;
  description: string;
  activities?: { name: string; description: string; duration_hours?: number; category?: string }[];
}

interface ShowItineraryArgs {
  destination?: string;
  travelers?: number;
  nights?: number;
  days?: number;
  estimated_budget?: number;
  days_plan?: DayPlan[];
  trip_type?: string[];
}

interface ShowBudgetArgs {
  destination?: string;
  travelers?: number;
  items?: { category: string; amount: number }[];
  total_per_person?: number;
}

function asItineraryArgs(args: Record<string, unknown>): ShowItineraryArgs {
  return args as ShowItineraryArgs;
}

function asBudgetArgs(args: Record<string, unknown>): ShowBudgetArgs {
  return args as ShowBudgetArgs;
}

export interface TripState {
  destination: string | null;
  travelers: number | null;
  nights: number | null;
  days: number;
  estimated_budget: number | null;
  days_plan: DayPlan[];
  trip_type: string[];
  budget_items: { category: string; amount: number }[];
}

export interface PlanSelections {
  hotel: { id: string; name: string } | null;
  activities: { id: string; name: string }[];
  flight: { id: string; label: string } | null;
  ticket: { id: string; name: string } | null;
}

export const EMPTY_PLAN_SELECTIONS: PlanSelections = {
  hotel: null,
  activities: [],
  flight: null,
  ticket: null,
};

export interface SelectedPlanIds {
  hotel?: string;
  activities: string[];
  flight?: string;
  ticket?: string;
}

export const EMPTY_SELECTED_IDS: SelectedPlanIds = {
  activities: [],
};

/** Currency-aware price formatter. INR gets Indian number formatting. */
export function formatPrice(amount: number, currency = "INR"): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  return `${currency} ${amount.toLocaleString()}`;
}

/** Day-card images shared between RightPanel and ItineraryCard. */
export const DAY_IMAGES = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1558005530-a7958896ec60?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=400&q=80",
];

/** Plain-text welcome message for conversation history (no markdown). */
export const WELCOME_INITIAL_CONTENT =
  "Hi there! I'm your Voyr AI travel assistant. Tell me about your dream trip and I'll craft the perfect plan for you.";

const EMPTY_STATE: TripState = {
  destination: null,
  travelers: null,
  nights: null,
  days: 0,
  estimated_budget: null,
  days_plan: [],
  trip_type: [],
  budget_items: [],
};

/**
 * Extract trip state from tool calls first (structured data), fall back to regex heuristic.
 */
export function extractTripState(messages: ChatMessage[]): TripState {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return EMPTY_STATE;

  const itineraryCall = lastAssistant.toolCalls?.find(
    (tc) => tc.name === "show_itinerary",
  );
  if (itineraryCall) {
    return fromItineraryToolCall(itineraryCall);
  }

  const budgetCall = lastAssistant.toolCalls?.find(
    (tc) => tc.name === "show_budget_breakdown",
  );
  if (budgetCall) {
    return fromBudgetToolCall(budgetCall, lastAssistant);
  }

  return extractFromProse(lastAssistant.content);
}

function fromItineraryToolCall(tc: ToolCallData): TripState {
  const args = asItineraryArgs(tc.arguments as Record<string, unknown>);
  const budget = args.estimated_budget;
  const nights = args.nights;

  return {
    destination: args.destination ?? null,
    travelers: args.travelers ?? null,
    nights: nights ?? null,
    days: args.days ?? (nights ? nights + 1 : 0),
    estimated_budget: budget ?? null,
    days_plan: args.days_plan ?? [],
    trip_type: args.trip_type ?? [],
    budget_items: budget
      ? [{ category: "Estimated Total", amount: budget }]
      : [],
  };
}

function fromBudgetToolCall(tc: ToolCallData, fallbackMessage: ChatMessage): TripState {
  const args = asBudgetArgs(tc.arguments as Record<string, unknown>);
  const items = args.items ?? [];
  const totalPerPerson = args.total_per_person;

  const budgetItems = [...items];
  if (totalPerPerson) {
    budgetItems.push({ category: "Total Per Person", amount: totalPerPerson });
  }

  const destination = args.destination ?? extractDestinationFromProse(fallbackMessage.content);

  return {
    ...EMPTY_STATE,
    destination,
    travelers: args.travelers ?? null,
    estimated_budget: totalPerPerson ?? null,
    budget_items: budgetItems,
  };
}

function extractFromProse(content: string): TripState {
  const destination = extractDestinationFromProse(content);
  const travelersMatch = content.match(/(\d+)\s*(?:travelers?|people|persons?|pax)/i);
  const daysMatch = content.match(/(\d+)\s*(?:days?|nights?)/i);
  const budgetMatch = content.match(/(?:budget|cost|rs\.?|inr)\s*[:\s]*([\d,]+)/i);

  const budget = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ""), 10) : null;
  const nights = daysMatch ? parseInt(daysMatch[1], 10) : null;

  return {
    destination,
    travelers: travelersMatch ? parseInt(travelersMatch[1], 10) : null,
    nights,
    days: nights ? nights + 1 : 0,
    estimated_budget: budget,
    days_plan: [],
    trip_type: [],
    budget_items: budget
      ? [{ category: "Estimated Total", amount: budget }]
      : [],
  };
}

function extractDestinationFromProse(content: string): string | null {
  const match = content.match(/(?:visiting?|trip to|travel to|heading to|going to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  return match?.[1] ?? null;
}
