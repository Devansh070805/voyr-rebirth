// Documents Module — Invoice, itinerary, voucher generation
export { createDocumentService } from './document.service.js';
export type {
  DocumentService,
  DocumentResult,
  Document,
  DocumentJob,
  QueueMessage,
  R2Client,
  QueueClient,
} from './document.service.js';
export { documentRoutes } from './document.routes.js';
