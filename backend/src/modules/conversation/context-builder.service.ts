import { queryOne, queryRows } from '../../db/index.js';
import { NotFoundError, ForbiddenError } from '../../infra/index.js';
import type { ChatMessage, ConversationMessageRow, StoredToolCall } from '../conversation/chat.types.js';
import type { TripPlan } from '../trip-plan/trip-plan.types.js';

export interface UserTravelProfile {
  user_id: string;
  customer_segment: 'b2c' | 'b2b';
  home_airport: string | null;
  passport_country: string | null;
  default_currency: string | null;
  travel_style: string | null;
  dietary_notes: string | null;
  mobility_notes: string | null;
  party_default: { adults: number; children: number };
  learned_preferences: Record<string, unknown>;
  last_destinations: string[];
}

export interface BrokerContext {
  user: {
    id: string;
    email: string | null;
    segment: 'b2c' | 'b2b';
    travel_profile: UserTravelProfile | null;
  };
  conversation: {
    id: string;
    status: string;
    title: string;
    destination: string | null;
    booking_stage: string;
    rolling_summary: string | null;
  };
  plan_summary: string;
  recent_turns: ChatMessage[];
  cross_trip_hints: string | null;
}

const MAX_RECENT_TURNS = 12;

function toolSummaryFromPlan(plan: TripPlan): string {
  const parts: string[] = [];
  if (plan.selected_hotel) parts.push(`Hotel: ${plan.selected_hotel.name}`);
  if (plan.selected_activities.length) {
    parts.push(`Activities: ${plan.selected_activities.map((a) => a.name).join(', ')}`);
  }
  if (plan.selected_flight) parts.push(`Flight: ${plan.selected_flight.label}`);
  if (plan.selected_ticket) parts.push(`Ticket: ${plan.selected_ticket.name}`);
  return parts.length ? `[Plan selections: ${parts.join('; ')}]` : '';
}

function formatTurn(msg: Pick<ConversationMessageRow, 'role' | 'content' | 'tool_calls'>): ChatMessage {
  let content = msg.content;
  if (msg.role === 'assistant' && (!content || content === '(tool calls only)')) {
    const tools = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    const names = tools.map((t: StoredToolCall) => t.name).filter(Boolean);
    content = names.length ? `[Showed cards: ${names.join(', ')}]` : '[Responded with interactive cards]';
  }
  return { role: msg.role as ChatMessage['role'], content };
}

export function createContextBuilderService() {
  return {
    async assertConversationOwnership(conversationId: string, userId: string): Promise<void> {
      const row = await queryOne<{ user_id: string }>(
        `SELECT user_id FROM conversations WHERE id = $1 AND status != 'deleted'`,
        [conversationId],
      );
      if (!row) throw new NotFoundError('Conversation not found');
      if (row.user_id !== userId) throw new ForbiddenError('Conversation access denied');
    },

    async getTravelProfile(userId: string): Promise<UserTravelProfile | null> {
      const row = await queryOne<UserTravelProfile>(
        `SELECT * FROM user_travel_profiles WHERE user_id = $1`,
        [userId],
      );
      if (!row) return null;
      return {
        ...row,
        customer_segment: row.customer_segment || 'b2c',
        party_default: row.party_default ?? { adults: 2, children: 0 },
        learned_preferences: row.learned_preferences ?? {},
        last_destinations: row.last_destinations ?? [],
      };
    },

    async upsertDestinationHint(userId: string, destination: string): Promise<void> {
      const slug = destination.trim().toLowerCase();
      await queryOne(
        `INSERT INTO user_travel_profiles (user_id, last_destinations)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET
           last_destinations = (
             SELECT to_jsonb(ARRAY(
               SELECT DISTINCT x FROM unnest(
                 ARRAY[$3]::text[] || COALESCE(
                   (SELECT array_agg(elem::text) FROM jsonb_array_elements_text(user_travel_profiles.last_destinations) elem),
                   ARRAY[]::text[]
                 )
               ) AS x LIMIT 5
             ))
           ),
           updated_at = NOW()
         RETURNING user_id`,
        [userId, JSON.stringify([slug]), slug],
      );
    },

    async buildBrokerContext(params: {
      userId: string;
      userEmail?: string | null;
      conversationId: string;
      planSummary: string;
      plan?: TripPlan;
    }): Promise<BrokerContext> {
      const conv = await queryOne<{
        id: string;
        status: string;
        title: string;
        destination: string | null;
        rolling_summary: string | null;
      }>(
        `SELECT id, status, title, destination, rolling_summary FROM conversations WHERE id = $1`,
        [params.conversationId],
      );
      if (!conv) throw new NotFoundError('Conversation not found');

      const profile = await this.getTravelProfile(params.userId);
      const messages = await queryRows<Pick<ConversationMessageRow, 'role' | 'content' | 'tool_calls'>>(
        `SELECT role, content, tool_calls FROM conversation_messages
         WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [params.conversationId, MAX_RECENT_TURNS],
      );

      const recent_turns = messages.reverse().map(formatTurn);
      const selectionHint = params.plan ? toolSummaryFromPlan(params.plan) : '';
      if (selectionHint) {
        recent_turns.push({ role: 'system', content: selectionHint });
      }

      let cross_trip_hints: string | null = null;
      if (profile) {
        const hints: string[] = [];
        if (profile.travel_style) hints.push(`style: ${profile.travel_style}`);
        if (profile.home_airport) hints.push(`home airport: ${profile.home_airport}`);
        if (profile.dietary_notes) hints.push(`dietary: ${profile.dietary_notes}`);
        if (profile.last_destinations.length) {
          hints.push(`recent destinations: ${profile.last_destinations.slice(0, 3).join(', ')}`);
        }
        cross_trip_hints = hints.length ? hints.join('; ') : null;
      }

      return {
        user: {
          id: params.userId,
          email: params.userEmail ?? null,
          segment: profile?.customer_segment ?? 'b2c',
          travel_profile: profile,
        },
        conversation: {
          id: conv.id,
          status: conv.status,
          title: conv.title,
          destination: conv.destination,
          booking_stage: conv.status || 'planning',
          rolling_summary: conv.rolling_summary,
        },
        plan_summary: params.planSummary,
        recent_turns,
        cross_trip_hints,
      };
    },

    contextToHistory(ctx: BrokerContext): ChatMessage[] {
      const blocks: ChatMessage[] = [];
      if (ctx.conversation.rolling_summary) {
        blocks.push({ role: 'system', content: `Earlier conversation summary:\n${ctx.conversation.rolling_summary}` });
      }
      if (ctx.cross_trip_hints) {
        blocks.push({ role: 'system', content: `Returning client profile: ${ctx.cross_trip_hints}` });
      }
      blocks.push({
        role: 'system',
        content: `Booking stage: ${ctx.conversation.booking_stage}. Customer segment: ${ctx.user.segment}.`,
      });
      blocks.push({
        role: 'system',
        content: `## Current Trip Plan\n${ctx.plan_summary}\n\nYou are a human travel broker. Be warm and direct. Interactive cards show options — tell the user to tap to select.`,
      });
      return [...blocks, ...ctx.recent_turns];
    },
  };
}

export type ContextBuilderService = ReturnType<typeof createContextBuilderService>;
