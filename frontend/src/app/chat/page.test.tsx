import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatPage from './page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock fetch to prevent API calls during tests
globalThis.fetch = vi.fn(() =>
  Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)
);

describe('Chat Interface', () => {
  // ── Sidebar Tests ──────────────────────────────────────────────────────────

  describe('Sidebar', () => {
    it('renders Voyr logo and AI Travel Planner subtitle', () => {
      render(<ChatPage />);
      expect(screen.getByText('Voyr')).toBeDefined();
      expect(screen.getByText('AI Travel Planner')).toBeDefined();
    });

    it('renders all navigation items', () => {
      render(<ChatPage />);
      expect(screen.getByText('Chat')).toBeDefined();
      expect(screen.getByText('My Trips')).toBeDefined();
      expect(screen.getByText('Bookings')).toBeDefined();
      expect(screen.getByText('Saved')).toBeDefined();
      expect(screen.getByText('Notifications')).toBeDefined();
    });

    it('renders New Trip button', () => {
      render(<ChatPage />);
      const newTripElements = screen.getAllByText('New Trip');
      expect(newTripElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders recent chats list', () => {
      render(<ChatPage />);
      expect(screen.getByText('Bali 5 Nights Trip')).toBeDefined();
      expect(screen.getByText('Switzerland Family Trip')).toBeDefined();
      expect(screen.getByText('Dubai Adventure')).toBeDefined();
    });

    it('renders Refer & Earn card with Invite Now button', () => {
      render(<ChatPage />);
      expect(screen.getByText('Refer & Earn')).toBeDefined();
      expect(screen.getByText(/Invite Now/)).toBeDefined();
    });

    it('renders user profile section', () => {
      render(<ChatPage />);
      expect(screen.getByText('Ananya Sharma')).toBeDefined();
      expect(screen.getByText('Premium Member')).toBeDefined();
    });

    it('renders notification badge with count 2', () => {
      render(<ChatPage />);
      expect(screen.getByText('2')).toBeDefined();
    });
  });

  // ── Chat Messages Tests ────────────────────────────────────────────────────

  describe('Chat Messages', () => {
    it('renders AI welcome message with Voyr AI branding', () => {
      render(<ChatPage />);
      expect(screen.getByText(/Voyr AI/)).toBeDefined();
    });

    it('renders welcome message with travel assistant introduction', () => {
      render(<ChatPage />);
      expect(screen.getByText(/travel assistant/)).toBeDefined();
    });
  });

  // ── Quick-Action Suggestion Buttons ────────────────────────────────────────

  describe('Quick-Action Suggestions', () => {
    it('renders initial suggestion buttons', () => {
      render(<ChatPage />);
      expect(screen.getByText('Plan a 5-night Bali trip for 2')).toBeDefined();
      expect(screen.getByText('Suggest adventure destinations in Asia')).toBeDefined();
      expect(screen.getByText('Help me plan a family trip to Europe')).toBeDefined();
      expect(screen.getByText('Compare Bali vs Thailand vs Vietnam')).toBeDefined();
    });
  });

  // ── Message Input Bar ──────────────────────────────────────────────────────

  describe('Message Input', () => {
    it('renders message input with placeholder and send button', () => {
      render(<ChatPage />);
      expect(screen.getByLabelText('Chat message input')).toBeDefined();
      expect(screen.getByLabelText('Send message')).toBeDefined();
    });

    it('renders input placeholder text', () => {
      render(<ChatPage />);
      const input = screen.getByLabelText('Chat message input') as HTMLInputElement;
      expect(input.placeholder).toContain('Plan a trip');
    });
  });

  // ── Header Tests ───────────────────────────────────────────────────────────

  describe('Chat Header', () => {
    it('renders default trip name when no trip is planned', () => {
      render(<ChatPage />);
      // "New Trip" appears in both sidebar button and header title
      const newTripElements = screen.getAllByText('New Trip');
      expect(newTripElements.length).toBeGreaterThanOrEqual(2);
    });

    it('renders Share and Export action buttons', () => {
      render(<ChatPage />);
      expect(screen.getByText('Share')).toBeDefined();
      expect(screen.getByText('Export')).toBeDefined();
    });
  });

  // ── Right Panel Tests ──────────────────────────────────────────────────────

  describe('Right Panel', () => {
    it('renders empty state when no trip is planned', () => {
      render(<ChatPage />);
      expect(screen.getByText('No trip yet')).toBeDefined();
      expect(screen.getByText(/Start chatting to plan your trip/)).toBeDefined();
    });
  });

  // ── AI Disclaimer ──────────────────────────────────────────────────────────

  describe('AI Disclaimer', () => {
    it('renders AI disclaimer text', () => {
      render(<ChatPage />);
      expect(screen.getByText(/AI estimates are approximate/)).toBeDefined();
    });
  });
});
