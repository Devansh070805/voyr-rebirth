import { describe, it, expect } from 'vitest';
import {
  createStateMachine,
  TRANSITION_TABLE,
  type BookingState,
} from './state-machine.engine.js';
import { InvalidTransitionError } from './error-handler.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** All 8 valid booking states. */
const ALL_STATES = Object.keys(TRANSITION_TABLE) as BookingState[];

/** BFS over the transition table from a start state. */
function reachableStates(start: BookingState): Set<BookingState> {
  const visited = new Set<BookingState>();
  const queue: BookingState[] = [start];
  visited.add(start);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { to } of TRANSITION_TABLE[current]) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
      }
    }
  }
  return visited;
}

/** All outgoing state names from the table (not the keys, but the .to values). */
function allOutgoingTargets(): Set<BookingState> {
  const targets = new Set<BookingState>();
  for (const state of ALL_STATES) {
    for (const { to } of TRANSITION_TABLE[state]) {
      targets.add(to);
    }
  }
  return targets;
}

// ─── Suite ────────────────────────────────────────────────────────────────

const machine = createStateMachine();

describe('State Machine — Pure Transition Table Validation', () => {

  // ── Table structure ─────────────────────────────────────────────────

  it('has exactly 8 defined states', () => {
    expect(ALL_STATES).toHaveLength(8);
  });

  it('every outgoing target is a valid key in the transition table', () => {
    for (const target of allOutgoingTargets()) {
      expect(ALL_STATES).toContain(target);
    }
  });

  it('has no duplicate transitions (same from→to pair appears only once)', () => {
    for (const from of ALL_STATES) {
      const targets = TRANSITION_TABLE[from].map((t) => t.to);
      const unique = new Set(targets);
      expect(targets.length).toBe(unique.size);
    }
  });

  it('every transition has a non-empty trigger name', () => {
    for (const from of ALL_STATES) {
      for (const { trigger } of TRANSITION_TABLE[from]) {
        expect(trigger).toBeTruthy();
        expect(typeof trigger).toBe('string');
        expect(trigger.length).toBeGreaterThan(0);
      }
    }
  });

  // ── validTransitions ────────────────────────────────────────────────

  it('validTransitions matches the table for every state', () => {
    for (const state of ALL_STATES) {
      const result = machine.validTransitions(state);
      expect(result).toEqual(TRANSITION_TABLE[state]);
    }
  });

  it('validTransitions returns an empty array for terminal states', () => {
    const terminalStates: BookingState[] = ALL_STATES.filter(
      (s) => TRANSITION_TABLE[s].length === 0,
    );
    expect(terminalStates.length).toBeGreaterThan(0);
    for (const state of terminalStates) {
      expect(machine.validTransitions(state)).toEqual([]);
    }
  });

  // ── isValidTransition ───────────────────────────────────────────────

  it('isValidTransition returns true for every entry in the table', () => {
    for (const from of ALL_STATES) {
      for (const { to } of TRANSITION_TABLE[from]) {
        expect(machine.isValidTransition(from, to)).toBe(true);
      }
    }
  });

  it('isValidTransition returns false for every pair NOT in the table', () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const inTable = TRANSITION_TABLE[from].some((t) => t.to === to);
        if (!inTable) {
          expect(machine.isValidTransition(from, to)).toBe(false);
        }
      }
    }
  });

  it('isValidTransition is reflexive: no state can transition to itself', () => {
    for (const state of ALL_STATES) {
      const selfTransition = TRANSITION_TABLE[state].some((t) => t.to === state);
      if (selfTransition) {
        expect(machine.isValidTransition(state, state)).toBe(true);
      } else {
        expect(machine.isValidTransition(state, state)).toBe(false);
      }
    }
  });

  // ── validateTransition ──────────────────────────────────────────────

  it('validateTransition returns the matching target for valid transitions', () => {
    for (const from of ALL_STATES) {
      for (const expected of TRANSITION_TABLE[from]) {
        const result = machine.validateTransition(from, expected.to);
        expect(result).toEqual(expected);
      }
    }
  });

  it('validateTransition throws InvalidTransitionError for invalid transitions', () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const inTable = TRANSITION_TABLE[from].some((t) => t.to === to);
        if (!inTable) {
          expect(() => machine.validateTransition(from, to)).toThrow(InvalidTransitionError);
        }
      }
    }
  });

  it('validateTransition throws for transitions from terminal states', () => {
    for (const state of ALL_STATES) {
      if (TRANSITION_TABLE[state].length === 0) {
        for (const target of ALL_STATES) {
          if (target !== state) {
            expect(() => machine.validateTransition(state, target)).toThrow();
          }
        }
      }
    }
  });

  // ── Reachability invariants ─────────────────────────────────────────

  it('Draft can reach all expected terminal states via valid transitions', () => {
    const reachable = reachableStates('Draft');
    const expectedTerminals: BookingState[] = [
      'Refunded',
      'Failed',
    ];
    for (const terminal of expectedTerminals) {
      expect(reachable.has(terminal)).toBe(true);
    }
  });

  it('every state with an inbound transition is reachable from another state', () => {
    const hasInbound = new Set<BookingState>();
    for (const from of ALL_STATES) {
      for (const { to } of TRANSITION_TABLE[from]) {
        hasInbound.add(to);
      }
    }
    for (const state of hasInbound) {
      let reachableFromAny = false;
      for (const start of ALL_STATES) {
        if (start === state) continue;
        if (reachableStates(start).has(state)) {
          reachableFromAny = true;
          break;
        }
      }
      expect(reachableFromAny).toBe(true);
    }
  });

  it('Draft is the unique entry point (no transitions lead INTO it)', () => {
    for (const from of ALL_STATES) {
      for (const { to } of TRANSITION_TABLE[from]) {
        expect(to).not.toBe('Draft');
      }
    }
  });

  // ── Terminal state invariants ───────────────────────────────────────

  it('terminal states have exactly zero outgoing transitions', () => {
    const terminalStates = ALL_STATES.filter((s) => TRANSITION_TABLE[s].length === 0);
    for (const state of terminalStates) {
      expect(machine.validTransitions(state)).toEqual([]);
      for (const target of ALL_STATES) {
        expect(machine.isValidTransition(state, target)).toBe(false);
      }
    }
  });

  it('terminal states can still receive inbound transitions', () => {
    const terminalStates = ALL_STATES.filter((s) => TRANSITION_TABLE[s].length === 0);
    const incoming = new Map<BookingState, number>();
    for (const from of ALL_STATES) {
      for (const { to } of TRANSITION_TABLE[from]) {
        incoming.set(to, (incoming.get(to) || 0) + 1);
      }
    }
    for (const state of terminalStates) {
      expect(incoming.get(state) || 0).toBeGreaterThan(0);
    }
  });

  // ── Topological / structural ────────────────────────────────────────

  it('no state has more than 3 outgoing transitions (readability)', () => {
    for (const state of ALL_STATES) {
      expect(TRANSITION_TABLE[state].length).toBeLessThanOrEqual(3);
    }
  });

  it('Failed is a terminal state (no recovery path)', () => {
    expect(machine.validTransitions('Failed')).toEqual([]);
  });

  it('happy path: Draft → Requested → Confirmed → Paid → Ticketed/booked', () => {
    const happyPath: Array<[BookingState, BookingState, string]> = [
      ['Draft', 'Requested', 'booking_requested'],
      ['Requested', 'Confirmed', 'booking_confirmed'],
      ['Confirmed', 'Paid', 'payment_success'],
      ['Paid', 'Ticketed/booked', 'ticket_issued'],
    ];
    for (const [from, to, expectedTrigger] of happyPath) {
      expect(machine.isValidTransition(from, to)).toBe(true);
      const result = machine.validateTransition(from, to);
      expect(result.trigger).toBe(expectedTrigger);
    }
  });

  it('refund path: Cancelled → Refunded', () => {
    expect(machine.isValidTransition('Cancelled', 'Refunded')).toBe(true);
  });

  // ── Property-style exhaustive checks ────────────────────────────────

  it('every transition in the table can be validated then followed (contract: validate → isValid)', () => {
    for (const from of ALL_STATES) {
      for (const target of TRANSITION_TABLE[from]) {
        const validated = machine.validateTransition(from, target.to);
        expect(validated.to).toBe(target.to);
        expect(machine.isValidTransition(from, target.to)).toBe(true);
      }
    }
  });

  it('all 64 (8×8) possible state pairs are classified correctly', () => {
    let validCount = 0;
    let invalidCount = 0;
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const isValid = machine.isValidTransition(from, to);
        if (from === to) {
          const inTable = TRANSITION_TABLE[from].some((t) => t.to === to);
          expect(isValid).toBe(inTable);
        } else {
          const inTable = TRANSITION_TABLE[from].some((t) => t.to === to);
          expect(isValid).toBe(inTable);
        }
        if (isValid) validCount++;
        else invalidCount++;
      }
    }
    expect(validCount).toBeGreaterThan(0);
    expect(invalidCount).toBeGreaterThan(0);
  });
});
