import { ValidationError } from './error-handler.js';

interface ResendErrorBody {
  message?: string;
  name?: string;
}

/** Build Resend `from` — dotenv strips unquoted spaces, so prefer EMAIL_FROM=onboarding@resend.dev */
export function getResendFromAddress(): string {
  const raw = process.env.EMAIL_FROM?.trim();
  if (!raw) {
    return 'Voyr <onboarding@resend.dev>';
  }
  if (raw.includes('@') && !raw.includes('<')) {
    const name = process.env.EMAIL_FROM_NAME?.trim() || 'Voyr';
    return `${name} <${raw}>`;
  }
  return raw;
}

export function isResendSandboxFrom(from: string): boolean {
  return /@resend\.dev/i.test(from);
}

export function resendFailureError(status: number, resendMessage?: string): ValidationError {
  if (status === 403) {
    if (resendMessage?.includes('testing emails to your own email')) {
      return new ValidationError(
        'OTP email cannot be sent to this address yet. With the Resend test sender, only your Resend account email works. Verify a domain at resend.com/domains and set EMAIL_FROM to that domain.',
      );
    }
    return new ValidationError(
      'Email sender is not authorized. Verify your domain in Resend and set EMAIL_FROM to an address on that domain.',
    );
  }

  if (status === 401) {
    return new ValidationError('Email service is misconfigured (invalid API key).');
  }

  if (status === 422) {
    return new ValidationError(
      resendMessage || 'Invalid email sender configuration. Check EMAIL_FROM on the server.',
    );
  }

  return new ValidationError('Could not send verification email. Please try again in a few minutes.');
}

export async function logResendFailure(
  logger: { error: (msg: string, meta?: Record<string, unknown>) => void },
  response: Response,
  meta: Record<string, unknown>,
): Promise<ValidationError> {
  let resendMessage: string | undefined;
  try {
    const body = (await response.json()) as ResendErrorBody;
    resendMessage = body.message;
  } catch {
    // Resend may return a non-JSON error body; status is still logged below.
  }

  logger.error('Resend API error', {
    ...meta,
    status: response.status,
    ...(resendMessage && { resendMessage }),
  });

  return resendFailureError(response.status, resendMessage);
}
