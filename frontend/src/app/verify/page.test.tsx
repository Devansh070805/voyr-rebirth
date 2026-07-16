import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import VerifyPage from './page';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockEmail = 'user@example.com';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'email' ? mockEmail : null),
  }),
}));

// Mock auth context
const mockVerifyOtp = vi.fn();
const mockLogin = vi.fn();
vi.mock('../auth/context', () => ({
  useAuth: () => ({
    login: mockLogin,
    verifyOtp: mockVerifyOtp,
    refreshAccessToken: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: null,
  }),
}));

function fillOtp(digits: string) {
  digits.split('').forEach((digit, index) => {
    const input = screen.getByLabelText(`Digit ${index + 1}`);
    fireEvent.change(input, { target: { value: digit } });
  });
}

describe('Verify Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmail = 'user@example.com';
  });

  afterEach(() => {
    cleanup();
  });

  it('renders OTP input fields (6 digits) and verify button', () => {
    render(<VerifyPage />);
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Digit ${i}`)).toBeDefined();
    }
    expect(screen.getByText('Verify & Sign In')).toBeDefined();
  });

  it('shows the email from search params', () => {
    render(<VerifyPage />);
    expect(screen.getByText('user@example.com')).toBeDefined();
  });

  it('shows error for incomplete OTP submission', async () => {
    render(<VerifyPage />);
    // Fill only 3 digits
    fillOtp('123');
    // Submit the form directly
    const form = screen.getByText('Verify & Sign In').closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Please enter the complete 6-digit code'
      );
    });
  });

  it('calls verifyOtp() with email and OTP on valid submission', async () => {
    mockVerifyOtp.mockResolvedValueOnce(undefined);
    render(<VerifyPage />);
    fillOtp('123456');
    fireEvent.click(screen.getByText('Verify & Sign In'));
    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith('user@example.com', '123456');
    });
  });

  it('navigates to /chat on successful verification', async () => {
    mockVerifyOtp.mockResolvedValueOnce(undefined);
    render(<VerifyPage />);
    fillOtp('123456');
    fireEvent.click(screen.getByText('Verify & Sign In'));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/chat');
    });
  });

  it('shows error message when verification fails (invalid OTP)', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('Invalid or expired OTP'));
    render(<VerifyPage />);
    fillOtp('999999');
    fireEvent.click(screen.getByText('Verify & Sign In'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Invalid or expired OTP');
    });
  });

  it('clears OTP inputs on verification error', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('Invalid OTP'));
    render(<VerifyPage />);
    fillOtp('999999');
    fireEvent.click(screen.getByText('Verify & Sign In'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    // All inputs should be cleared
    for (let i = 1; i <= 6; i++) {
      const input = screen.getByLabelText(`Digit ${i}`) as HTMLInputElement;
      expect(input.value).toBe('');
    }
  });

  it('resend code button calls login() again', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<VerifyPage />);
    fireEvent.click(screen.getByText('Resend code'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com');
    });
  });

  it('redirects to /login if no email in search params', () => {
    mockEmail = '';
    render(<VerifyPage />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});
