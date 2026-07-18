/**
 * Cloudflare Worker API Gateway
 *
 * Implements the GatewayMiddleware interface from the design document:
 * - isPublicEndpoint(path): allow public routes without JWT
 * - validateJwt(request): extract and verify JWT from Authorization header
 * - attachMetadata(request): add x-request-id, x-timestamp, x-client-ip headers
 * - routeRequest(request): forward to backend origin; return 401 for invalid/expired JWT
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

export interface Env {
  BACKEND_ORIGIN: string;
  JWT_SECRET: string;
  CORS_ORIGIN?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  account_type?: string;
  account_id?: string;
  iat: number;
  exp: number;
  type?: string;
}

/**
 * Whether the browser origin may call this API (Pages prod + preview + local dev).
 */
export function isAllowedOrigin(origin: string | null, corsOrigin?: string): boolean {
  if (!origin) return false;

  const configured = (corsOrigin || 'https://voyr-frontend.pages.dev')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.includes('*')) return true;
  if (configured.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    if (url.hostname === 'voyr-frontend.pages.dev') return true;
    if (url.hostname.endsWith('.voyr-frontend.pages.dev')) return true;
  } catch {
    return false;
  }

  return false;
}

export function buildCorsHeaders(request: Request, env: Env): Headers | null {
  const origin = request.headers.get('Origin');
  if (!origin || !isAllowedOrigin(origin, env.CORS_ORIGIN)) {
    return null;
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-id, x-user-email, x-admin-id, x-request-id, x-idempotency-key, idempotency-key, x-signature',
  );
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export function withCors(response: Response, corsHeaders: Headers | null): Response {
  if (!corsHeaders) return response;

  const headers = new Headers(response.headers);
  corsHeaders.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function handlePreflight(request: Request, env: Env): Response | null {
  if (request.method !== 'OPTIONS') return null;

  const corsHeaders = buildCorsHeaders(request, env);
  if (!corsHeaders) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/google',
  '/auth/logout',
  '/landing',
  '/webhook/payment',
  '/hotels',
];

/**
 * Determines whether a request path is a public endpoint that does not require JWT.
 * Auth token exchange routes must be public (no access token yet).
 */
export function isPublicEndpoint(path: string): boolean {
  return PUBLIC_ENDPOINTS.some((ep) => path === ep || path.startsWith(ep + '/') || path.startsWith(ep + '?'));
}


/**
 * Base64url decode a string to Uint8Array.
 */
function base64urlDecode(str: string): Uint8Array {
  // Replace URL-safe chars and add padding
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Import the JWT secret as an HMAC CryptoKey for HS256 verification.
 */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/**
 * Validate a JWT token using Web Crypto API (HS256).
 * Returns the decoded payload on success, or null on failure.
 */
export async function validateJwt(
  request: Request,
  jwtSecret: string,
): Promise<JwtPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  return verifyJwtToken(token, jwtSecret);
}

/**
 * Verify and decode a JWT token string.
 * Returns the payload if valid, null otherwise.
 */
export async function verifyJwtToken(
  token: string,
  jwtSecret: string,
): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    // Verify the signature
    const key = await importHmacKey(jwtSecret);
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlDecode(signatureB64);

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) {
      return null;
    }

    // Decode and parse the payload
    const payloadBytes = base64urlDecode(payloadB64);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const payload: JwtPayload = JSON.parse(payloadStr);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}


/**
 * Attach structured request metadata headers for observability:
 * - x-request-id: UUID v4
 * - x-timestamp: ISO 8601 UTC timestamp
 * - x-client-ip: Client IP from Cloudflare header or fallback
 */
export function attachMetadata(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.set('x-request-id', crypto.randomUUID());
  headers.set('x-timestamp', new Date().toISOString());
  headers.set(
    'x-client-ip',
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown',
  );
  return headers;
}


/**
 * Route the request to the backend origin.
 * - Public endpoints bypass JWT validation.
 * - Protected endpoints require a valid JWT; returns 401 if invalid/expired.
 * - All requests get metadata headers attached.
 */
export async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Attach metadata to all requests
  const headers = attachMetadata(request);

  // Protected endpoints require JWT validation
  if (!isPublicEndpoint(path)) {
    const payload = await validateJwt(request, env.JWT_SECRET);
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Attach user info from JWT to forwarded request
    headers.set('x-user-id', payload.sub);
    headers.set('x-user-email', payload.email);
    if (payload.account_type) headers.set('x-account-type', payload.account_type);
    if (payload.account_id) headers.set('x-account-id', payload.account_id);
  }



  // Build the backend URL preserving path and query string
  const backendUrl = new URL(path + url.search, env.BACKEND_ORIGIN);

  const forwardedRequest = new Request(backendUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
  });

  try {
    return await fetch(forwardedRequest);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Backend unavailable' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const preflight = handlePreflight(request, env);
    if (preflight) return preflight;

    const corsHeaders = buildCorsHeaders(request, env);
    const response = await routeRequest(request, env);
    return withCors(response, corsHeaders);
  },
};
