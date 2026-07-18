/**
 * Native Gemini Streaming — uses the `streamGenerateContent` endpoint
 * with function/tool calling support.
 *
 * Why native vs OpenAI-compat:
 * - Gemini's OpenAI-compat endpoint has limited streaming tool-call support
 * - The native endpoint is more reliable for agentic multi-turn flows
 */

import { createLogger } from '../../infra/index.js';
import type { StreamEvent } from '@voyr/shared';
import { TOOL_DEFINITIONS } from './tool-definitions.js';
import { UNIFIED_SYSTEM_PROMPT } from './system-prompt.js';

export type GeminiEventCallback = (event: StreamEvent) => void | Promise<void>;

const logger = createLogger('gemini-stream');

interface GeminiPart {
  text?: string;
  thought?: boolean; // Gemini 2.5 Flash thinking tokens — must be filtered out
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
}

interface GeminiChunk {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number };
}

function toGeminiTools() {
  return [
    {
      function_declarations: TOOL_DEFINITIONS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

function toGeminiHistory(messages: { role: string; content: string }[]): GeminiContent[] {
  const history: GeminiContent[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue; // system goes in systemInstruction
    history.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }
  return history;
}

export async function streamGemini(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  onEvent: GeminiEventCallback,
): Promise<void> {
  // Extract system messages as the system instruction
  const systemMessages = messages.filter((m) => m.role === 'system');
  const systemInstruction = [UNIFIED_SYSTEM_PROMPT, ...systemMessages.map((m) => m.content)]
    .filter(Boolean)
    .join('\n\n');

  const userAndAssistantMessages = messages.filter((m) => m.role !== 'system');

  // Separate last user message from history
  const lastMsg = userAndAssistantMessages[userAndAssistantMessages.length - 1];
  const history = toGeminiHistory(userAndAssistantMessages.slice(0, -1));

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      ...history,
      { role: 'user', parts: [{ text: lastMsg?.content ?? '' }] },
    ],
    tools: toGeminiTools(),
    generation_config: {
      temperature: 0.7,
      max_output_tokens: 8192,
    },
    tool_config: {
      function_calling_config: {
        mode: 'AUTO',
      },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Gemini fetch failed: ${(err as Error).message}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body from Gemini');

  const decoder = new TextDecoder();
  let buffer = '';
  const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Normalize \r\n to \n to handle Gemini's CRLF line endings
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    // Gemini sends "data: {...}\n\n" between events
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;

      let chunk: GeminiChunk;
      try {
        chunk = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (chunk.error) {
        logger.error('Gemini error in stream', { error: chunk.error.message });
        onEvent({ type: 'error', data: { message: chunk.error.message } });
        onEvent({ type: 'done', data: {} });
        return;
      }

      const candidate = chunk.candidates?.[0];
      if (!candidate) continue;

      const parts2 = candidate.content?.parts ?? [];
      for (const part2 of parts2) {
        // Skip thinking tokens — these are internal model reasoning, not visible output
        if (part2.thought) {
          logger.debug('Skipping thinking token from Gemini 2.5 Flash');
          continue;
        }
        if (part2.text) {
          logger.info('Gemini text chunk', { len: part2.text.length, preview: part2.text.slice(0, 40) });
          await onEvent({ type: 'text_delta', data: { text: part2.text } });
        }
        if (part2.functionCall) {
          const tc = {
            id: `call_${toolCalls.length}_${part2.functionCall.name}`,
            name: part2.functionCall.name,
            args: part2.functionCall.args ?? {},
          };
          toolCalls.push(tc);
          logger.info('Gemini function call', { name: tc.name });
          await onEvent({
            type: 'tool_call',
            data: { id: tc.id, name: tc.name, arguments: tc.args },
          });
        }
      }

      const finishReason = candidate.finishReason;
      if (finishReason === 'STOP' || finishReason === 'TOOL_CALLS' || finishReason === 'MAX_TOKENS' || finishReason === 'RECITATION') {
        await onEvent({ type: 'done', data: {} });
        return;
      }
    }
  }

  // Process any remaining buffer
  const remaining = buffer.trim();
  if (remaining.startsWith('data:')) {
    try {
      const chunk: GeminiChunk = JSON.parse(remaining.slice(5).trim());
      const candidate = chunk.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        if (part.thought) continue;
        if (part.text) await onEvent({ type: 'text_delta', data: { text: part.text } });
        if (part.functionCall) {
          await onEvent({
            type: 'tool_call',
            data: { id: `call_final_${part.functionCall.name}`, name: part.functionCall.name, arguments: part.functionCall.args ?? {} },
          });
        }
      }
    } catch {
      // ignore malformed final chunk
    }
  }

  onEvent({ type: 'done', data: {} });
}

