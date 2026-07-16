import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Home from './page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock fetch to prevent issues when running alongside other test files
globalThis.fetch = vi.fn(() =>
  Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response)
);

describe('Landing Page', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the header with Voyr logo and navigation', () => {
    render(<Home />);
    expect(screen.getAllByText('Voyr').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Travel Beyond Limits').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Destinations/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Experiences/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Packages/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/About Us/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Support/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Log in and Sign up buttons', () => {
    render(<Home />);
    expect(screen.getAllByText('Log in').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sign up').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the hero section with headline', () => {
    render(<Home />);
    const headings = screen.getAllByRole('heading', { level: 1 });
    const heroHeading = headings.find((h: HTMLElement) => h.textContent?.includes('Your Dream Trip,'));
    expect(heroHeading).toBeDefined();
    expect(heroHeading!.textContent).toContain('Designed');
    expect(heroHeading!.textContent).toContain('by AI');
  });

  it('renders the trip creation form with all fields', () => {
    render(<Home />);
    expect(screen.getAllByText('Where to?').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('When?').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Travelers').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Budget').length).toBeGreaterThanOrEqual(1);
    // The form now has a real input for destination
    const destInput = screen.getByPlaceholderText('e.g. Bali, Thailand');
    expect(destInput).toBeDefined();
    // Create My Trip button
    expect(screen.getAllByText(/Create My Trip/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the features section with 4 cards', () => {
    render(<Home />);
    expect(screen.getAllByText('AI-Powered Itineraries').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Best Price Guarantee').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Secure Payments').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('24/7 Support').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the destinations section', () => {
    render(<Home />);
    expect(screen.getAllByText('Explore Top Destinations').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Bali/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Maldives/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Dubai/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Switzerland/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders destination starting prices', () => {
    render(<Home />);
    expect(screen.getAllByText(/₹29,999/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/₹49,999/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/₹33,999/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/₹79,999/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the how-it-works section with 4 steps', () => {
    render(<Home />);
    expect(screen.getAllByText(/How It Works/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tell Us Your Preferences').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('AI Builds Your Itinerary').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Review & Book').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pack Your Bags').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the CTA section', () => {
    render(<Home />);
    expect(screen.getAllByText(/Ready to plan your next adventure/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Start Planning with AI/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Explore Packages/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the currency selector', () => {
    render(<Home />);
    expect(screen.getAllByText('INR').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the footer with legal links', () => {
    render(<Home />);
    expect(screen.getAllByText(/Privacy Policy/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Terms of Service/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Refund Policy/).length).toBeGreaterThanOrEqual(1);
  });
});
