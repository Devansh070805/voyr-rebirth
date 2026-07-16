/**
 * Property-based test for the State Machine Engine.
 *
 * Property 2: Reachability invariant — for all sequences of valid transitions
 * applied to a booking, the resulting state is reachable from the initial state
 * through the transition table.
 *
 * Validates: Requirement 6.6
 *
 * Strategy: We generate arbitrary sequences of valid transitions starting from
 * DRAFT_PACKAGE (the initial state). At each step, we pick a random valid
 * transition from the current state. After applying the full sequence, we verify
 * that the final state is reachable from DRAFT_PACKAGE by computing the set of
 * all reachable states via BFS over the transition table.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { TRANSITION_TABLE, type BookingState } from './state-machine.engine.js';


const INITIAL_STATE: BookingState = 'DRAFT_PACKAGE';

/**
 * Compute all states reachable from a given start state using BFS
 * over the transition table.
 */
function computeReachableStates(startState: BookingState): Set<BookingState> {
  const reachable = new Set<BookingState>();
  const queue: BookingState[] = [startState];
  reachable.add(startState);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const transitions = TRANSITION_TABLE[current];
    for (const { to } of transitions) {
      if (!reachable.has(to)) {
        reachable.add(to);
        queue.push(to);
      }
    }
  }

  return reachable;
}

/**
 * Generate a random sequence of valid transitions starting from DRAFT_PACKAGE.
 * Returns the sequence of states visited (including the initial state).
 */
function validTransitionSequenceArbitrary(
  maxLength: number,
): fc.Arbitrary<{ states: BookingState[]; triggers: string[] }> {
  return fc.integer({ min: 0, max: maxLength }).chain((length) => {
    // Build the sequence step by step using fc.clone and recursive generation
    return fc.func(fc.nat()).map((rngFn) => {
      const states: BookingState[] = [INITIAL_STATE];
      const triggers: string[] = [];
      let current: BookingState = INITIAL_STATE;

      for (let i = 0; i < length; i++) {
        const validNext = TRANSITION_TABLE[current];
        if (validNext.length === 0) break; // terminal state

        // Use the rng function to pick a random valid transition
        const idx = Math.abs(rngFn(i)) % validNext.length;
        const chosen = validNext[idx];
        current = chosen.to;
        states.push(current);
        triggers.push(chosen.trigger);
      }

      return { states, triggers };
    });
  });
}


let bookingStatus: string;

vi.mock('../db/index.js', () => {
  return {
    query: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    queryOne: vi.fn(async () => null),
    transaction: vi.fn(async (fn: (client: unknown) => Promise<void>) => {
      const mockClient = {
        query: vi.fn(async (text: string, params?: unknown[]) => {
          const sql = text.trim().toUpperCase();
          if (sql.startsWith('UPDATE BOOKINGS')) {
            // Simulate optimistic lock check
            const toState = params![0] as string;
            const fromState = params![2] as string;
            if (bookingStatus === fromState) {
              bookingStatus = toState;
              return { rowCount: 1 };
            }
            return { rowCount: 0 };
          }
          return { rows: [], rowCount: 1 };
        }),
      };
      await fn(mockClient);
    }),
  };
});

vi.mock('./audit.service.js', () => ({
  logAudit: vi.fn(async () => {}),
}));

vi.mock('./logger.js', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}));

// Import after mocking
const { createStateMachineEngine } = await import('./state-machine.engine.js');


describe('State Machine Engine — Property-Based Tests', () => {
  const reachableFromInitial = computeReachableStates(INITIAL_STATE);
  const engine = createStateMachineEngine();

  beforeEach(() => {
    bookingStatus = INITIAL_STATE;
  });

  it('Property 2: for all sequences of valid transitions, the resulting state is reachable from DRAFT_PACKAGE', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTransitionSequenceArbitrary(20),
        async ({ states, triggers }) => {
          // Reset booking status for each run
          bookingStatus = INITIAL_STATE;

          const bookingId = 'test-booking-id';

          // Apply each transition in the sequence
          for (let i = 0; i < triggers.length; i++) {
            const fromState = states[i];
            const toState = states[i + 1];
            const trigger = triggers[i];

            const result = await engine.transition(bookingId, fromState, toState, trigger);
            expect(result).toBe(toState);
          }

          // The final state must be reachable from the initial state
          const finalState = states[states.length - 1];
          expect(reachableFromInitial.has(finalState)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('Property 2b: every state in a valid transition sequence is individually reachable from DRAFT_PACKAGE', async () => {
    await fc.assert(
      fc.asyncProperty(
        validTransitionSequenceArbitrary(20),
        async ({ states }) => {
          // Every intermediate state in the sequence must be reachable
          for (const state of states) {
            expect(reachableFromInitial.has(state)).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('Property 2c: invalid transitions are always rejected', async () => {
    const allStates = Object.keys(TRANSITION_TABLE) as BookingState[];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...allStates),
        fc.constantFrom(...allStates),
        async (fromState, toState) => {
          // Only test pairs that are NOT valid transitions
          const isValid = engine.isValidTransition(fromState, toState);
          if (isValid) return; // skip valid transitions

          bookingStatus = fromState;

          await expect(
            engine.transition('test-booking-id', fromState, toState, 'invalid_trigger'),
          ).rejects.toThrow();
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Property 2d: validTransitions() returns only states reachable in one step from the transition table', () => {
    const allStates = Object.keys(TRANSITION_TABLE) as BookingState[];

    for (const state of allStates) {
      const engineResult = engine.validTransitions(state);
      const tableResult = TRANSITION_TABLE[state];

      // Same length
      expect(engineResult.length).toBe(tableResult.length);

      // Same targets
      const engineTargets = new Set(engineResult.map((t) => t.to));
      const tableTargets = new Set(tableResult.map((t) => t.to));
      expect(engineTargets).toEqual(tableTargets);
    }
  });

  it('Property 2e: isValidTransition is consistent with the transition table', () => {
    const allStates = Object.keys(TRANSITION_TABLE) as BookingState[];

    for (const from of allStates) {
      for (const to of allStates) {
        const engineSays = engine.isValidTransition(from, to);
        const tableSays = TRANSITION_TABLE[from].some((t) => t.to === to);
        expect(engineSays).toBe(tableSays);
      }
    }
  });

  it('Sanity: reachable states from DRAFT_PACKAGE include all expected terminal states', () => {
    // Terminal states that should be reachable through valid paths
    const expectedTerminals: BookingState[] = [
      'CUSTOMER_NOTIFIED',
      'PAYMENT_FAILED',
      'FAILED',
      'QUOTE_EXPIRED',
    ];

    for (const terminal of expectedTerminals) {
      expect(reachableFromInitial.has(terminal)).toBe(true);
    }
  });
});
