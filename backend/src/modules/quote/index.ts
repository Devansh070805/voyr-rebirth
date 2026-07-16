// Quote Module — Immutable snapshot, expiry logic, pricing engine
export { quoteRoutes } from './quote.routes.js';
export { createQuoteService } from './quote.service.js';
export type {
  QuoteService,
  Quote,
  QuoteItem,
  GenerateQuoteRequest,
  GenerateQuoteResponse,
} from './quote.service.js';
