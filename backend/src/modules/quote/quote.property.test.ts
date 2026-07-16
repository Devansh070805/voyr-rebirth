/**
 * Property-based test for the Quote Service — JSON round-trip validation.
 *
 * Property 3: JSON serialization of Quote objects round-trips correctly.
 * Validates: Requirement 5.7
 *
 * No database mocking needed — uses native JSON.parse/JSON.stringify.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Quote } from './quote.service.js';


/**
 * Arbitrary UUID v4 string.
 */
function arbUuid(): fc.Arbitrary<string> {
  return fc.uuid();
}

/**
 * Arbitrary non-negative finite number with at most 2 decimal places.
 */
function arbAmount(): fc.Arbitrary<number> {
  return fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    .map((n) => Math.round(n * 100) / 100);
}

/**
 * Arbitrary ISO 8601 date string (UTC).
 */
function arbIsoDate(): fc.Arbitrary<string> {
  return fc.date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
  }).map((d) => d.toISOString());
}

/**
 * Arbitrary currency code (3-letter uppercase).
 */
function arbCurrency(): fc.Arbitrary<string> {
  return fc.constantFrom('INR', 'USD', 'EUR', 'GBP', 'AED', 'CHF', 'AUD');
}

/**
 * Arbitrary Quote status.
 */
function arbStatus(): fc.Arbitrary<'ACTIVE' | 'EXPIRED'> {
  return fc.constantFrom('ACTIVE' as const, 'EXPIRED' as const);
}

/**
 * Arbitrary Quote object matching the Quote interface.
 */
function arbQuote(): fc.Arbitrary<Quote> {
  return fc.record({
    id: arbUuid(),
    package_id: arbUuid(),
    currency: arbCurrency(),
    base_amount: arbAmount(),
    tax_amount: arbAmount(),
    markup_amount: arbAmount(),
    fee_amount: arbAmount(),
    discount_amount: arbAmount(),
    final_amount: arbAmount(),
    valid_until: arbIsoDate(),
    status: arbStatus(),
    created_at: arbIsoDate(),
  });
}


describe('Quote — JSON Round-Trip Property Tests', () => {
  it('Property 3: native JSON.stringify/parse round-trip is equivalent', () => {
    fc.assert(
      fc.property(
        arbQuote(),
        (quote) => {
          const serialized = JSON.stringify(quote);
          const deserialized = JSON.parse(serialized) as Quote;
          expect(deserialized).toEqual(quote);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('Property 3b: JSON.stringify produces valid JSON', () => {
    fc.assert(
      fc.property(
        arbQuote(),
        (quote) => {
          const serialized = JSON.stringify(quote);
          expect(() => JSON.parse(serialized)).not.toThrow();
          expect(serialized.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 3c: double round-trip is stable', () => {
    fc.assert(
      fc.property(
        arbQuote(),
        (quote) => {
          const first = JSON.parse(JSON.stringify(quote)) as Quote;
          const second = JSON.parse(JSON.stringify(first)) as Quote;
          expect(second).toEqual(first);
          expect(second).toEqual(quote);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 3d: JSON.stringify is deterministic', () => {
    fc.assert(
      fc.property(
        arbQuote(),
        (quote) => {
          const serialized1 = JSON.stringify(quote);
          const serialized2 = JSON.stringify(quote);
          expect(serialized1).toBe(serialized2);
        },
      ),
      { numRuns: 200 },
    );
  });
});
