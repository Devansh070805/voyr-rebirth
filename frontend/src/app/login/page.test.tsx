import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import LoginPage from './page';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));

// Mock auth context
const mockLogin = vi.fn();
vi.mock('../auth/context', () => ({
  useAuth: () => ({
    login: mockLogin,
    verifyOtp: vi.fn(),
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: null,
  }),
}));

function renderLoginPage() {
  return render(<LoginPage />);
}

function getEmailInput() {
  return document.getElementById('email') as HTMLInputElement;
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the login form with email input and submit button', () => {
    renderLoginPage();
    expect(getEmailInput()).toBeDefined();
    expect(screen.getByText('Continue')).toBeDefined();
  });

  it('shows validation error for empty email submission', async () => {
    renderLoginPage();
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByRole('alert').textContent).toBe('Please enter your email address');
  });

  it('shows validation error for invalid email format', async () => {
    renderLoginPage();
    fireEvent.change(getEmailInput(), { target: { value: 'not-an-email' } });
    // Use form submit to bypass native HTML5 email validation in happy-dom
    const form = screen.getByText('Continue').closest('form')!;
    fireEvent.submit(form);
    expect(screen.getByRole('alert').textContent).toBe('Please enter a valid email address');
  });

  it('calls login() with email on valid submission', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();
    fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com');
    });
  });

  it('navigates to /verify?email=... on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginPage();
    fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/verify?email=user%40example.com');
    });
  });

  it('shows error message when login API fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    renderLoginPage();
    fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Rate limit exceeded');
    });
  });

  it('shows "Sending OTP..." text while submitting', async () => {
    let resolveLogin: () => void;
    mockLogin.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveLogin = resolve; })
    );
    renderLoginPage();
    fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByText('Sending OTP...')).toBeDefined();
    });
    // Resolve to clean up
    resolveLogin!();
  });
});
