/**
 * Unit tests for the Cloudflare Worker API Gateway.
 *
 * Tests cover:
 * - Public endpoint detection
 * - JWT validation (valid, expired, missing, malformed)
 * - Metadata attachment (x-request-id, x-timestamp, x-client-ip)
 * - Request routing (forwarding, 401 for protected routes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPublicEndpoint,
  validateJwt,
  verifyJwtToken,
  attachMetadata,
  routeRequest,
  isAllowedOrigin,
  buildCorsHeaders,
  handlePreflight,
  withCors,
  type Env,
} from './index.js';


const TEST_SECRET = 'test-jwt-secret';

/**
 * Create a valid HS256 JWT for testing using Web Crypto API.
 */
async function createTestJwt(
  payload: Record<string, unknown>,
  secret: string = TEST_SECRET,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };

  const encode = (obj: unknown): string => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );

  const sigBytes = new Uint8Array(signature);
  let sigBinary = '';
  for (const byte of sigBytes) {
    sigBinary += String.fromCharCode(byte);
  }
  const signatureB64 = btoa(sigBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function createRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Request {
  const url = `https://api.voyr.com${path}`;
  return new Request(url, {
    method: options.method || 'GET',
    headers: new Headers(options.headers || {}),
    body: options.body || undefined,
  });
}


describe('isPublicEndpoint', () => {
  it('should return true for /auth/login', () => {
    expect(isPublicEndpoint('/auth/login')).toBe(true);
  });

  it('should return true for /auth/verify', () => {
    expect(isPublicEndpoint('/auth/verify')).toBe(true);
  });

  it('should return true for /landing', () => {
    expect(isPublicEndpoint('/landing')).toBe(true);
  });

  it('should return true for /webhook/payment', () => {
    expect(isPublicEndpoint('/webhook/payment')).toBe(true);
  });

  it('should return true for /auth/google, /auth/refresh, /auth/logout', () => {
    expect(isPublicEndpoint('/auth/google')).toBe(true);
    expect(isPublicEndpoint('/auth/refresh')).toBe(true);
    expect(isPublicEndpoint('/auth/logout')).toBe(true);
  });

  it('should return false for protected endpoints', () => {
    expect(isPublicEndpoint('/package')).toBe(false);
    expect(isPublicEndpoint('/quote/generate')).toBe(false);
    expect(isPublicEndpoint('/admin/active-bookings')).toBe(false);
    expect(isPublicEndpoint('/ai/stream')).toBe(false);
  });

});

describe('validateJwt', () => {
  it('should return null when no Authorization header is present', async () => {
    const request = createRequest('/package');
    const result = await validateJwt(request, TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return null when Authorization header does not start with Bearer', async () => {
    const request = createRequest('/package', {
      headers: { authorization: 'Basic abc123' },
    });
    const result = await validateJwt(request, TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return null for a malformed token', async () => {
    const request = createRequest('/package', {
      headers: { authorization: 'Bearer not.a.valid.token' },
    });
    const result = await validateJwt(request, TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return null for an expired token', async () => {
    const expiredPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000) - 3600,
      exp: Math.floor(Date.now() / 1000) - 1800, // expired 30 min ago
    };
    const token = await createTestJwt(expiredPayload);
    const request = createRequest('/package', {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await validateJwt(request, TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return null for a token signed with wrong secret', async () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await createTestJwt(payload, 'wrong-secret');
    const request = createRequest('/package', {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await validateJwt(request, TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return payload for a valid token', async () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await createTestJwt(payload);
    const request = createRequest('/package', {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await validateJwt(request, TEST_SECRET);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe('user-123');
    expect(result!.email).toBe('test@example.com');
  });
});

describe('verifyJwtToken', () => {
  it('should return null for empty string', async () => {
    const result = await verifyJwtToken('', TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return null for token with wrong number of parts', async () => {
    const result = await verifyJwtToken('only.two', TEST_SECRET);
    expect(result).toBeNull();
  });

  it('should return payload for valid token', async () => {
    const payload = {
      sub: 'user-456',
      email: 'user@voyr.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
    };
    const token = await createTestJwt(payload);
    const result = await verifyJwtToken(token, TEST_SECRET);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe('user-456');
    expect(result!.email).toBe('user@voyr.com');
  });
});

describe('attachMetadata', () => {
  it('should add x-request-id as a UUID', () => {
    const request = createRequest('/package');
    const headers = attachMetadata(request);
    const requestId = headers.get('x-request-id');
    expect(requestId).not.toBeNull();
    // UUID v4 format
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should add x-timestamp as ISO 8601', () => {
    const request = createRequest('/package');
    const headers = attachMetadata(request);
    const timestamp = headers.get('x-timestamp');
    expect(timestamp).not.toBeNull();
    // Should be a valid ISO date
    expect(new Date(timestamp!).toISOString()).toBe(timestamp);
  });

  it('should add x-client-ip from cf-connecting-ip header', () => {
    const request = createRequest('/package', {
      headers: { 'cf-connecting-ip': '203.0.113.42' },
    });
    const headers = attachMetadata(request);
    expect(headers.get('x-client-ip')).toBe('203.0.113.42');
  });

  it('should fall back to x-forwarded-for if cf-connecting-ip is absent', () => {
    const request = createRequest('/package', {
      headers: { 'x-forwarded-for': '198.51.100.1' },
    });
    const headers = attachMetadata(request);
    expect(headers.get('x-client-ip')).toBe('198.51.100.1');
  });

  it('should use "unknown" if no IP headers are present', () => {
    const request = createRequest('/package');
    const headers = attachMetadata(request);
    expect(headers.get('x-client-ip')).toBe('unknown');
  });
});

describe('routeRequest', () => {
  const env: Env = {
    BACKEND_ORIGIN: 'http://localhost:3001',
    JWT_SECRET: TEST_SECRET,
  };

  beforeEach(() => {
    // Mock global fetch for backend forwarding
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return 401 for protected endpoint without JWT', async () => {
    const request = createRequest('/package', { method: 'POST' });
    const response = await routeRequest(request, env);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('should return 401 for protected endpoint with invalid JWT', async () => {
    const request = createRequest('/package', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    const response = await routeRequest(request, env);
    expect(response.status).toBe(401);
  });

  it('should forward public endpoint requests without JWT', async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const request = createRequest('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const response = await routeRequest(request, env);
    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Verify the forwarded request URL
    const forwardedRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(forwardedRequest.url).toBe('http://localhost:3001/auth/login');
  });

  it('should forward authenticated requests with user metadata', async () => {
    const payload = {
      sub: 'user-789',
      email: 'auth@voyr.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await createTestJwt(payload);

    const mockResponse = new Response(JSON.stringify({ data: 'ok' }), { status: 200 });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const request = createRequest('/package', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const response = await routeRequest(request, env);
    expect(response.status).toBe(200);

    // Verify forwarded request has metadata and user info
    const forwardedRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(forwardedRequest.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(forwardedRequest.headers.get('x-timestamp')).not.toBeNull();
    expect(forwardedRequest.headers.get('x-user-id')).toBe('user-789');
    expect(forwardedRequest.headers.get('x-user-email')).toBe('auth@voyr.com');
  });

  it('should return 502 when backend is unavailable', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Connection refused'));

    const request = createRequest('/auth/login', { method: 'POST' });
    const response = await routeRequest(request, env);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({ error: 'Backend unavailable' });
  });

  it('should preserve query string when forwarding', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const request = createRequest('/landing?page=1&limit=10');
    const response = await routeRequest(request, env);
    expect(response.status).toBe(200);

    const forwardedRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(forwardedRequest.url).toBe('http://localhost:3001/landing?page=1&limit=10');
  });

  it('should forward webhook/payment without JWT validation', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const request = createRequest('/webhook/payment', {
      method: 'POST',
      headers: { 'x-signature': 'some-hmac-signature' },
    });
    const response = await routeRequest(request, env);
    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('CORS', () => {
  const env: Env = {
    BACKEND_ORIGIN: 'http://localhost:3001',
    JWT_SECRET: TEST_SECRET,
    CORS_ORIGIN: 'https://voyr-frontend.pages.dev',
  };

  it('allows Pages production and preview origins', () => {
    expect(isAllowedOrigin('https://voyr-frontend.pages.dev', env.CORS_ORIGIN)).toBe(true);
    expect(isAllowedOrigin('https://abc123.voyr-frontend.pages.dev', env.CORS_ORIGIN)).toBe(true);
    expect(isAllowedOrigin('https://evil.example.com', env.CORS_ORIGIN)).toBe(false);
  });

  it('returns 204 for OPTIONS preflight with CORS headers', () => {
    const request = new Request('https://api.voyr.com/ai/stream', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://voyr-frontend.pages.dev',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const response = handlePreflight(request, env);
    expect(response?.status).toBe(204);
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('https://voyr-frontend.pages.dev');
  });

  it('adds CORS headers to proxied responses', () => {
    const request = new Request('https://api.voyr.com/health', {
      headers: { Origin: 'https://voyr-frontend.pages.dev' },
    });
    const corsHeaders = buildCorsHeaders(request, env);
    const wrapped = withCors(new Response('ok', { status: 200 }), corsHeaders);
    expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('https://voyr-frontend.pages.dev');
  });
});
