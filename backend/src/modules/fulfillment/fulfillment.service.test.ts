import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryOne, mockQueryRows } = vi.hoisted(() => ({
  mockQueryOne: vi.fn(),
  mockQueryRows: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRows: (...args: unknown[]) => mockQueryRows(...args),
}));

import { createFulfillmentService } from './fulfillment.service.js';

describe('fulfillment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates fulfillments only for quote items with broker supply metadata', async () => {
    mockQueryRows.mockResolvedValueOnce([
      {
        id: 'qi-1',
        service_snapshot: {
          supply_source: 'curated',
          supply_product: 'hotel',
          cost_amount: 80,
          sell_amount: 120,
          margin_amount: 40,
          currency: 'USD',
          curated_listing_id: 'listing-1',
        },
      },
      {
        id: 'qi-2',
        service_snapshot: { option_name: 'Legacy item without broker metadata' },
      },
    ]);

    mockQueryOne.mockResolvedValueOnce({
      id: 'ful-1',
      booking_id: 'book-1',
      quote_item_id: 'qi-1',
      supply_source: 'curated',
      supply_product: 'hotel',
      curated_listing_id: 'listing-1',
      cost_amount: 80,
      sell_amount: 120,
      margin_amount: 40,
      currency: 'USD',
      margin_rule_id: null,
      customer_segment: 'b2c',
      provider_search_ref: null,
      provider_booking_ref: null,
      fulfillment_status: 'pending_manual',
      settlement_status: 'unpaid',
      payload: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const service = createFulfillmentService();
    const created = await service.createFromQuoteItems('book-1', 'quote-1');

    expect(created).toHaveLength(1);
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
    expect(created[0].supply_source).toBe('curated');
    expect(created[0].fulfillment_status).toBe('pending_manual');
  });
});
