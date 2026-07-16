import { describe, it, expect } from 'vitest';
import { createPricingService } from './pricing.service.js';

describe('createPricingService', () => {
  const pricing = createPricingService();

  it('applyMarginSync returns base price when no rules cached', () => {
    const result = pricing.applyMarginSync({
      provider: 'makcorps',
      listingType: 'hotel',
      basePrice: 100,
      customerSegment: 'b2c',
    });
    expect(result.displayPrice).toBe(100);
    expect(result.marginAmount).toBe(0);
  });

  it('previewMargin applies percent rule', () => {
    const result = pricing.previewMargin(100, {
      id: 'r1',
      provider: 'makcorps',
      listing_type: null,
      destination_slug: null,
      customer_segment: 'all',
      margin_type: 'percent',
      margin_value: 10,
      min_margin_amount: null,
      is_active: true,
    });
    expect(result.displayPrice).toBe(110);
    expect(result.marginAmount).toBe(10);
  });
});
