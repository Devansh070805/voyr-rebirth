/**
 * AI Stream Service — Streaming chat with tool calling over SSE.
 */

import { createLogger } from '../../infra/index.js';
import { iterSSEDataLines } from '../../infra/sse-utils.js';
import type { ChatMessage } from '../conversation/chat.types.js';
import type { StreamEvent } from '@voyr/shared';
import { TOOL_DEFINITIONS } from './tool-definitions.js';
import { UNIFIED_SYSTEM_PROMPT } from './system-prompt.js';
import { getAIConfig } from './ai-provider-config.js';
import type { AIProviderConfig } from './ai-provider-config.js';

const logger = createLogger('ai-stream-service');

export type { StreamEvent, ToolCall, ToolResultData } from '@voyr/shared';

function toOpenAITools() {
  return TOOL_DEFINITIONS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}


function toAnthropicTools() {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}


export type StreamCallback = (event: StreamEvent) => void;

/**
 * Stream a unified AI response with tool calling.
 * Calls the AI provider's streaming API and emits events via callback.
 */
export async function streamChat(
  message: string,
  conversationHistory: ChatMessage[],
  onEvent: StreamCallback,
): Promise<void> {
  const config = getAIConfig();

  if (!config.apiKey) {
    onEvent({ type: 'error', data: { message: 'AI provider is not configured. Set AI_PROVIDER and the matching API key (e.g. DEEPSEEK_API_KEY).' } });
    console.log("Sending done event"); onEvent({ type: 'done', data: {} });
    console.log("Returning from streamOpenAI"); return;
  }

  const messages = [
    ...conversationHistory.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user' as const, content: message },
  ];

  try {
    if (config.provider === 'anthropic') {
      await streamAnthropic(config, messages, onEvent);
    } else {
      await streamOpenAI(config, messages, onEvent);
    }
  } catch (error) {
    logger.error('Stream error', { error: (error as Error).message });
    onEvent({ type: 'error', data: { message: (error as Error).message } });
    console.log("Sending done event"); onEvent({ type: 'done', data: {} });
  }
}


async function streamOpenAI(
  config: AIProviderConfig,
  messages: { role: string; content: string }[],
  onEvent: StreamCallback,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://voyr.com';
    headers['X-Title'] = 'Voyr';
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: UNIFIED_SYSTEM_PROMPT }, ...messages],
      tools: toOpenAITools(),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

  for await (const data of iterSSEDataLines(reader, decoder)) {
    if (data === '[DONE]') {
      // Emit any accumulated tool calls
      for (const [, tc] of toolCalls) {
        try {
          const args = JSON.parse(tc.arguments);
          onEvent({
            type: 'tool_call',
            data: { id: tc.id, name: tc.name, arguments: args },
          });
        } catch {
          logger.warn('Failed to parse tool call arguments', { name: tc.name });
        }
      }
      // Generate context-aware suggestions
      const fullText = messages[messages.length - 1]?.content || '';
      const suggestions = generateSuggestions(toolCalls, fullText);
      if (suggestions.length > 0) {
        onEvent({ type: 'suggestions', data: suggestions });
      }
      console.log("Sending done event"); onEvent({ type: 'done', data: {} });
      console.log("Returning from streamOpenAI"); return;
    }

    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      // Text content
      if (delta.content) {
        onEvent({ type: 'text_delta', data: { text: delta.content } });
      }

      // Tool calls (accumulated across chunks)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls.has(idx)) {
            toolCalls.set(idx, { id: tc.id || '', name: tc.function?.name || '', arguments: '' });
          }
          const existing = toolCalls.get(idx)!;
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.arguments += tc.function.arguments;
        }
      }
    } catch {
      logger.warn('Skipped malformed SSE JSON line from AI provider');
    }
  }

  // If we get here without [DONE], still emit accumulated tool calls
  for (const [, tc] of toolCalls) {
    try {
      const args = JSON.parse(tc.arguments);
      onEvent({ type: 'tool_call', data: { id: tc.id, name: tc.name, arguments: args } });
    } catch {
      logger.warn('Failed to parse accumulated tool call arguments');
    }
  }
  console.log("Sending done event"); onEvent({ type: 'done', data: {} });
}


async function streamAnthropic(
  config: AIProviderConfig,
  messages: { role: string; content: string }[],
  onEvent: StreamCallback,
): Promise<void> {
  // Filter out system messages for Anthropic (system goes in separate field)
  const anthropicMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    }));

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      system: UNIFIED_SYSTEM_PROMPT,
      messages: anthropicMessages,
      tools: toAnthropicTools(),
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let currentToolName = '';
  let currentToolId = '';
  let currentToolInput = '';
  const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
  let toolCallIndex = 0;

  for await (const data of iterSSEDataLines(reader, decoder)) {
    try {
      const parsed = JSON.parse(data);

      switch (parsed.type) {
        case 'content_block_start':
          if (parsed.content_block?.type === 'tool_use') {
            currentToolName = parsed.content_block.name || '';
            currentToolId = parsed.content_block.id || '';
            currentToolInput = '';
          }
          break;

        case 'content_block_delta':
          if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
            onEvent({ type: 'text_delta', data: { text: parsed.delta.text } });
          }
          if (parsed.delta?.type === 'input_json_delta' && parsed.delta.partial_json) {
            currentToolInput += parsed.delta.partial_json;
          }
          break;

        case 'content_block_stop':
          if (currentToolName) {
            try {
              const args = JSON.parse(currentToolInput);
              onEvent({
                type: 'tool_call',
                data: { id: currentToolId, name: currentToolName, arguments: args },
              });
              toolCalls.set(toolCallIndex++, {
                id: currentToolId,
                name: currentToolName,
                arguments: currentToolInput,
              });
            } catch {
              logger.warn('Failed to parse Anthropic tool input', { name: currentToolName });
            }
            currentToolName = '';
            currentToolId = '';
            currentToolInput = '';
          }
          break;

        case 'message_stop': {
          const fullText = messages[messages.length - 1]?.content || '';
          const suggestions = generateSuggestions(toolCalls, fullText);
          if (suggestions.length > 0) {
            onEvent({ type: 'suggestions', data: suggestions });
          }
          console.log("Sending done event"); onEvent({ type: 'done', data: {} });
          console.log("Returning from streamOpenAI"); return;
        }
      }
    } catch {
      logger.warn('Skipped malformed SSE JSON line from Anthropic provider');
    }
  }

  console.log("Sending done event"); onEvent({ type: 'done', data: {} });
}


const SUGGESTIONS_BY_TOOL: Record<string, string[]> = {
  show_itinerary: [
    'Show me the budget breakdown',
    'Suggest different hotels',
    'Add more adventure activities',
    'Make it more budget-friendly',
  ],
  show_budget_breakdown: [
    'How can I reduce costs?',
    'Upgrade to luxury hotels',
    'Show activity options',
    'I\'m ready to book this',
  ],
  show_hotel_options: [
    'Show me the full itinerary',
    'Compare with other destinations',
    'What activities are nearby?',
    'Book the mid-range option',
  ],
  show_activity_options: [
    'Add these to my itinerary',
    'Show me the updated budget',
    'Any family-friendly options?',
    'What about water sports?',
  ],
  create_package: [
    'Generate a price quote',
    'Show me the final itinerary',
    'What\'s included in the package?',
    'Share with my travel partner',
  ],
  generate_quote: [
    'Proceed to payment',
    'Can I get a discount?',
    'How long is this quote valid?',
    'Modify the package first',
  ],
  start_checkout: [
    'Show me the booking details',
    'What\'s the cancellation policy?',
    'Add travel insurance',
    'Start a new trip',
  ],
  show_visa_info: [
    'What documents do I need?',
    'How long can I stay?',
    'Is there an e-visa option?',
    'Check visa for another country',
  ],
} satisfies Record<string, string[]>;

const DEFAULT_SUGGESTIONS = [
  'Plan a beach vacation',
  'Suggest adventure destinations',
  'Help me plan a family trip',
  'Compare Bali vs Thailand',
];

function generateSuggestions(
  toolCalls: Map<number, { id: string; name: string; arguments: string }>,
  _userMessage: string,
): string[] {
  // Iterate tool calls and return the first matching group
  for (const [, tc] of toolCalls) {
    const group = SUGGESTIONS_BY_TOOL[tc.name];
    if (group) return group;
  }
  return DEFAULT_SUGGESTIONS;
}
