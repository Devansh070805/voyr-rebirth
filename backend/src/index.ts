import './instrument.js';
import * as Sentry from '@sentry/node';
import express from 'express';
import { connectRedis } from './infra/redis.js';
import { validateProductionEnvironment } from './infra/env-validation.js';

validateProductionEnvironment();

await connectRedis();
import {
  errorHandler,
  createLogger,
  requestLatencyMiddleware,
  getAlertingService,
  getMetricsService,
  requireAuth,
  requestContextMiddleware,
  cacheMiddleware,
  createRateLimiter,
} from './infra/index.js';
import { authRoutes } from './modules/auth/index.js';
import { inventoryRoutes } from './modules/inventory/index.js';
import { packageRoutes } from './modules/package/index.js';
import { quoteRoutes } from './modules/quote/index.js';
import { paymentRoutes, webhookRoutes } from './modules/payment/index.js';
import { bookingRoutes } from './modules/booking/index.js';
import { documentRoutes } from './modules/documents/index.js';
import { notificationRoutes } from './modules/notifications/index.js';
import { aiGatewayRoutes } from './modules/ai-gateway/index.js';
import { adminOpsRoutes } from './modules/admin-ops/index.js';
import { conversationRoutes } from './modules/conversation/index.js';
import { savedTripsRoutes } from './modules/saved-trips/index.js';
import { travelVisaRoutes, visaCorrectionsRoutes, visaAdminRoutes } from './modules/travel-visa/index.js';
import { geoapifyRoutes } from './modules/geoapify/index.js';
import { makcorpsRoutes } from './modules/makcorps/index.js';
import { aviationStackRoutes } from './modules/aviation-stack/index.js';
import { tinyfishRoutes } from './modules/tinyfish/index.js';
import { curatedListingsAdminRoutes } from './modules/curated-listings/index.js';
import { pricingAdminRoutes } from './modules/pricing/index.js';
import { partnerRoutes, partnerAdminRoutes } from './modules/partner/index.js';
import { xoteloRoutes } from './modules/xotelo/index.js';
import { accountsRoutes } from './modules/accounts/accounts.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const logger = createLogger('app');

// Request latency tracking — must be before route handlers
app.use(requestLatencyMiddleware);

// Request context — propagates x-request-id into AsyncLocalStorage for logging
app.use(requestContextMiddleware);

// CORS — allow requests from the frontend origin
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-email, x-admin-id, x-request-id, x-idempotency-key, idempotency-key, x-signature');
  if (_req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }
  next();
});

app.use(express.json());

// Authentication middleware — requires x-user-id on protected routes
app.use(requireAuth);

// Health check — verifies database connectivity
app.get('/health', async (_req, res) => {
  try {
    const { pool } = await import('./db/index.js');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Health check failed', { error: (err as Error).message });
    res.status(503).json({ status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// Module routes
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/package', packageRoutes);
app.use('/quote', quoteRoutes);
app.use('/payment', paymentRoutes);
app.use('/webhook', webhookRoutes); // POST /webhook/payment — matches gateway public endpoint
app.use('/booking', bookingRoutes);
app.use('/documents', documentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/ai', createRateLimiter(20, 3600), aiGatewayRoutes);
app.use('/admin', adminOpsRoutes);
app.use('/conversations', conversationRoutes);
app.use('/saved-trips', savedTripsRoutes);
app.use('/travel-visa', cacheMiddleware(86400), travelVisaRoutes);
app.use('/travel-visa', visaCorrectionsRoutes);
app.use('/admin', visaAdminRoutes);
app.use('/admin', curatedListingsAdminRoutes);
app.use('/admin', pricingAdminRoutes);
app.use('/admin', partnerAdminRoutes);
app.use('/partner', partnerRoutes);
app.use('/hotels', xoteloRoutes);
app.use('/accounts', accountsRoutes);

// Data source API routes
app.use('/places', cacheMiddleware(86400), geoapifyRoutes);
app.use('/hotels', cacheMiddleware(86400), makcorpsRoutes);
app.use('/flights', cacheMiddleware(86400), aviationStackRoutes);
app.use('/search', tinyfishRoutes);

if (process.env.NODE_ENV === 'development') {
  app.get('/debug-sentry', () => {
    throw new Error('My first Sentry error!');
  });
}

// Sentry error handler must be before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Error handling middleware — must be registered after all routes
app.use(errorHandler);

// Metrics endpoint for observability (Bearer token required in production)
app.get('/metrics', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const metricsToken = process.env.METRICS_TOKEN;
    const authHeader = req.headers.authorization;
    if (!metricsToken || authHeader !== `Bearer ${metricsToken}`) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
      });
      return;
    }
  }

  const metrics = getMetricsService();
  res.json(metrics.getSummary());
});

// Start periodic alert checks
const alerting = getAlertingService();
alerting.startPeriodicChecks();

app.listen(PORT, () => {
  logger.info(`Voyr backend running on port ${PORT}`);
});

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  alerting.stopPeriodicChecks();
  try {
    const { closePool } = await import('./db/index.js');
    await closePool();
    logger.info('Database pool closed');
  } catch (err) {
    logger.error('Error closing database pool', { error: (err as Error).message });
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
