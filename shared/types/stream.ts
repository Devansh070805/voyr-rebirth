/**
 * Shared SSE stream types — wire format between AI gateway and chat UI.
 */

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultData {
  tool_call_id: string;
  tool_name: string;
  success: boolean;
  data: Record<string, unknown>;
}

export type StreamEvent =
  | { type: 'text_delta'; data: { text: string } }
  | { type: 'tool_call'; data: ToolCall }
  | { type: 'tool_result'; data: ToolResultData }
  | { type: 'error'; data: { message: string } }
  | { type: 'done'; data: Record<string, never> }
  | { type: 'suggestions'; data: string[] };
