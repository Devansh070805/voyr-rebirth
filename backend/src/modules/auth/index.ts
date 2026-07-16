// Auth Module — Email OTP login, JWT access tokens, refresh tokens
export { createAuthService } from './auth.service.js';
export type { AuthService, LoginResponse, VerifyResponse, RefreshResponse, JwtPayload } from './auth.service.js';
export { authRoutes } from './auth.routes.js';
