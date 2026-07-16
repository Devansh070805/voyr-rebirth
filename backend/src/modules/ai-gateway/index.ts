// AI Gateway Module — Content enrichment, recommendations, streaming
export { aiGatewayRoutes } from './ai-gateway.routes.js';
export { createAIGatewayService } from './ai-gateway.service.js';
export { streamChat } from './ai-stream.service.js';
export type {
  AIGatewayService,
  ChatMessage,
  ContentEnrichment,
  UserPreferences,
  Recommendation,
} from './ai-gateway.service.js';
export type { StreamEvent, ToolCall, ToolResultData } from './ai-stream.service.js';
export type { ToolDefinition } from './tool-definitions.js';
