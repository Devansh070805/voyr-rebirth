/**
 * Integration Tests — API Gateway Routing
 *
 * Tests the full request routing pipeline through the Cloudflare Worker API Gateway,
 * exercising the interaction between JWT validation, public endpoint detection,
 * metadata attachment, and backend forwarding as a cohesive flow.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 *
 * Scenarios:
 * 1. Authenticated request forwarding with valid JWT
 * 2. 401 response for invalid/expired JWT on protected endpoints
 * 3. Public endpoint access without JWT
 * 4. Request metadata attachment (request ID, timestamp, client IP)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeRequest, type Env } from './index.js';


const TEST_SECRET = 'integration-test-jwt-secret';

const ENV: Env = {
  BACKEND_ORIGIN: 'http://localhost:3001',
  JWT_SECRET: TEST_SECRET,
};


function base64urlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(
  payload: Record<string, unknown>,
  secret: string = TEST_SECRET,
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(header);
  const payloadB64 = base64urlEncode(payload);
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
  const signatureB64 = btoa(sigBinary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: 'user-int-001',
    email: 'integration@voyr.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function makeRequest(
  path: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Request {
  return new Request(`https://api.voyr.com${path}`, {
    method: opts.method ?? 'GET',
    headers: new Headers(opts.headers ?? {}),
    body: opts.body ?? undefined,
  });
}


describe('Integration — API Gateway Routing', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 1: Authenticated request forwarding with valid JWT
  // Validates: Req 2.1
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 1: Authenticated request forwarding with valid JWT', () => {
    it('should forward a GET request to a protected endpoint with valid JWT', async () => {
      const token = await signJwt(validPayload());
      const request = makeRequest('/package/pkg-001', {
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/package/pkg-001');
      expect(forwarded.method).toBe('GET');
    });

    it('should forward a POST request to a protected endpoint', async () => {
      const token = await signJwt(validPayload());
      const request = makeRequest('/package', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(200);
      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/package');
      expect(forwarded.method).toBe('POST');
    });

    it('should attach x-user-id and x-user-email from JWT to forwarded request', async () => {
      const token = await signJwt(validPayload({ sub: 'user-abc', email: 'abc@voyr.com' }));
      const request = makeRequest('/quote/generate', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.headers.get('x-user-id')).toBe('user-abc');
      expect(forwarded.headers.get('x-user-email')).toBe('abc@voyr.com');
    });

    it('should forward requests to various protected endpoints', async () => {
      const protectedPaths: Array<{ path: string; method: string }> = [
        { path: '/booking/00000000-0000-0000-0000-000000000001', method: 'GET' },
        { path: '/admin/active-bookings', method: 'GET' },
        { path: '/ai/stream', method: 'POST' },
        { path: '/payment/session', method: 'POST' },
      ];

      for (const { path, method } of protectedPaths) {
        fetchSpy.mockClear();
        const token = await signJwt(validPayload());
        const request = makeRequest(path, {
          method,
          headers: { authorization: `Bearer ${token}` },
        });

        const response = await routeRequest(request, ENV);
        expect(response.status).toBe(200);

        const forwarded = fetchSpy.mock.calls[0][0] as Request;
        expect(forwarded.url).toBe(`http://localhost:3001${path}`);
      }
    });

    it('should preserve query parameters when forwarding authenticated requests', async () => {
      const token = await signJwt(validPayload());
      const request = makeRequest('/admin/active-bookings?page=2&limit=25', {
        headers: { authorization: `Bearer ${token}` },
      });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/admin/active-bookings?page=2&limit=25');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 2: 401 response for invalid/expired JWT
  // Validates: Req 2.2
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 2: 401 response for invalid/expired JWT', () => {
    it('should return 401 when no Authorization header is present on a protected endpoint', async () => {
      const request = makeRequest('/package', { method: 'POST' });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: 'Unauthorized' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return 401 for an expired JWT', async () => {
      const token = await signJwt(validPayload({
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
      }));
      const request = makeRequest('/booking/00000000-0000-0000-0000-000000000001', {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return 401 for a JWT signed with the wrong secret', async () => {
      const token = await signJwt(validPayload(), 'completely-wrong-secret');
      const request = makeRequest('/ai/stream', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return 401 for a malformed JWT (not three parts)', async () => {
      const request = makeRequest('/package', {
        headers: { authorization: 'Bearer not-a-jwt' },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return 401 for a tampered JWT payload', async () => {
      // Create a valid token, then tamper with the payload segment
      const token = await signJwt(validPayload());
      const parts = token.split('.');
      // Replace payload with a different one (keeps original signature)
      const tamperedPayload = base64urlEncode({
        sub: 'hacker',
        email: 'hacker@evil.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const request = makeRequest('/package', {
        headers: { authorization: `Bearer ${tamperedToken}` },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header uses Basic scheme', async () => {
      const request = makeRequest('/package', {
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should not forward the request to the backend on auth failure', async () => {
      const request = makeRequest('/quote/generate', { method: 'POST' });

      await routeRequest(request, ENV);

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 3: Public endpoint access without JWT
  // Validates: Req 2.3
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 3: Public endpoint access without JWT', () => {
    it('should forward /auth/login without requiring JWT', async () => {
      const request = makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/auth/login');
    });

    it('should forward /auth/verify without requiring JWT', async () => {
      const request = makeRequest('/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(200);
      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/auth/verify');
    });

    it('should forward /landing without requiring JWT', async () => {
      const request = makeRequest('/landing');

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(200);
      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/landing');
    });

    it('should forward /webhook/payment without requiring JWT', async () => {
      const request = makeRequest('/webhook/payment', {
        method: 'POST',
        headers: { 'x-signature': 'hmac-sig-value' },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(200);
      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/webhook/payment');
    });

    it('should not attach x-user-id or x-user-email on public endpoint requests', async () => {
      const request = makeRequest('/auth/login', { method: 'POST' });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.headers.get('x-user-id')).toBeNull();
      expect(forwarded.headers.get('x-user-email')).toBeNull();
    });

    it('should still forward public endpoints even when an invalid JWT is provided', async () => {
      const request = makeRequest('/auth/login', {
        method: 'POST',
        headers: { authorization: 'Bearer invalid.token.here' },
      });

      const response = await routeRequest(request, ENV);

      // Public endpoints bypass JWT validation entirely
      expect(response.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should preserve query parameters on public endpoint forwarding', async () => {
      const request = makeRequest('/landing?featured=true&region=asia');

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.url).toBe('http://localhost:3001/landing?featured=true&region=asia');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 4: Request metadata attachment
  // Validates: Req 2.4
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 4: Request metadata attachment (request ID, timestamp, client IP)', () => {
    it('should attach x-request-id as a valid UUID v4 on all forwarded requests', async () => {
      const request = makeRequest('/auth/login', { method: 'POST' });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      const requestId = forwarded.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should attach x-timestamp as a valid ISO 8601 UTC string', async () => {
      const before = new Date();
      const request = makeRequest('/auth/login', { method: 'POST' });

      await routeRequest(request, ENV);
      const after = new Date();

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      const timestamp = forwarded.headers.get('x-timestamp');
      expect(timestamp).not.toBeNull();

      const parsed = new Date(timestamp!);
      expect(parsed.toISOString()).toBe(timestamp);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(parsed.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should attach x-client-ip from cf-connecting-ip header', async () => {
      const request = makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.50' },
      });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.headers.get('x-client-ip')).toBe('203.0.113.50');
    });

    it('should fall back to x-forwarded-for when cf-connecting-ip is absent', async () => {
      const request = makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '198.51.100.10' },
      });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.headers.get('x-client-ip')).toBe('198.51.100.10');
    });

    it('should set x-client-ip to "unknown" when no IP headers are present', async () => {
      const request = makeRequest('/auth/login', { method: 'POST' });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      expect(forwarded.headers.get('x-client-ip')).toBe('unknown');
    });

    it('should attach metadata headers on authenticated protected requests', async () => {
      const token = await signJwt(validPayload());
      const request = makeRequest('/package', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'cf-connecting-ip': '10.0.0.1',
        },
      });

      await routeRequest(request, ENV);

      const forwarded = fetchSpy.mock.calls[0][0] as Request;
      // Metadata headers
      expect(forwarded.headers.get('x-request-id')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(forwarded.headers.get('x-timestamp')).not.toBeNull();
      expect(forwarded.headers.get('x-client-ip')).toBe('10.0.0.1');
      // User headers from JWT
      expect(forwarded.headers.get('x-user-id')).toBe('user-int-001');
      expect(forwarded.headers.get('x-user-email')).toBe('integration@voyr.com');
    });

    it('should generate unique x-request-id for each request', async () => {
      const request1 = makeRequest('/auth/login', { method: 'POST' });
      const request2 = makeRequest('/auth/verify', { method: 'POST' });

      await routeRequest(request1, ENV);
      await routeRequest(request2, ENV);

      const forwarded1 = fetchSpy.mock.calls[0][0] as Request;
      const forwarded2 = fetchSpy.mock.calls[1][0] as Request;
      const id1 = forwarded1.headers.get('x-request-id');
      const id2 = forwarded2.headers.get('x-request-id');

      expect(id1).not.toBeNull();
      expect(id2).not.toBeNull();
      expect(id1).not.toBe(id2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Scenario 5: Backend unavailability
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Scenario 5: Backend unavailability handling', () => {
    it('should return 502 when the backend is unreachable for a public endpoint', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const request = makeRequest('/auth/login', { method: 'POST' });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toEqual({ error: 'Backend unavailable' });
    });

    it('should return 502 when the backend is unreachable for an authenticated endpoint', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const token = await signJwt(validPayload());
      const request = makeRequest('/package', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await routeRequest(request, ENV);

      expect(response.status).toBe(502);
      const body = await response.json();
      expect(body).toEqual({ error: 'Backend unavailable' });
    });
  });
});
