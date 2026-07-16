# Architecture

System design for Voyr. For feature status, auth requirements, and schema
details, see **[STATUS.md](./STATUS.md)**.

## Overview

Voyr is a three-tier monorepo: a Next.js frontend, a Cloudflare Worker gateway,
and an Express backend. The backend follows a **modular monolith** pattern —
domain logic is organized into independent modules rather than microservices,
all sharing a single PostgreSQL database.

## System Architecture

```
                         ┌─────────────────────────────────────┐
                         │          Browser (User)              │
                         └──────────────┬──────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Next.js 15 App    │
                              │  (Cloudflare Pages)│
                              │                    │
                              │  /api/* rewrites   │
                              │  → gateway or      │
                              │    direct backend   │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Gateway Worker    │
                              │  (Cloudflare)      │
                              │                    │
                              │  • JWT validation  │
                              │  • Request routing │
                              │  • Metadata headers│
                              │  • Public endpoint │
                              │    passthrough     │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Express Backend   │
                              │  (Node.js/TS)      │
                              │                    │
                              │  Global middleware: │
                              │  requireAuth       │
                              │  (x-user-id check) │
                              │                    │
                              │  ┌─── Modules ───┐ │
                              │  │ auth          │ │
                              │  │ ai-gateway    │ │
                              │  │ conversation  │ │
                              │  │ trip-plan     │ │
                              │  │ curated-list. │ │
                              │  │ pricing       │ │
                              │  │ fulfillment   │ │
                              │  │ travel-supply │ │
                              │  │ aviation-stack│ │
                              │  │ booking       │ │
                              │  │ documents     │ │
                              │  │ geoapify      │ │
                              │  │ inventory     │ │
                              │  │ makcorps      │ │
                              │  │ notifications │ │
                              │  │ package       │ │
                              │  │ payment       │ │
                              │  │ quote         │ │
                              │  │ tinyfish      │ │
                              │  │ travel-visa   │ │
                              │  │ admin-ops     │ │
                              │  │ partner       │ │
                              │  │ saved-trips   │ │
                              │  └───────────────┘ │
                              └─────────┬─────────┘
                                        │
                              ┌─────────▼─────────┐
                              │    PostgreSQL      │
                              │    38 app tables   │
                              │    19 migrations   │
                              └───────────────────┘
```

## Broker model

Voyr is a **travel broker**, not a pure marketplace:

| Flow            | Description                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| Customer → Voyr | Razorpay / mock checkout on quote `final_amount`                                        |
| Voyr → supply   | Fulfillment ledger (`booking_fulfillments`) tracks cost, sell, margin per line          |
| Curated         | Admin-owned listings with explicit cost/sell; manual fulfillment                        |
| Provider APIs   | Makcorps / Geoapify / Aviation (discovery today); Riya Connect stub for production book |

Key tables (migrations 014–019):

- `curated_listings` — admin inventory with `cost_price`, `sell_price`, optional
  `inventory_option_id`
- `provider_margin_rules` — B2C/B2B margins by provider, destination, listing
  type
- `booking_fulfillments` — post-payment ledger (`pending_manual` curated,
  `pending_provider` API)
- `user_travel_profiles` — cross-conversation prefs and `customer_segment`
- `b2b_partners` / `b2b_partner_members` — B2B orgs and email-based access
  grants

Supply is accessed through **`travel-supply` adapters** so
Makcorps/Geoapify/Aviation can be swapped for Riya without rewriting chat.

## B2B customer segmentation

Voyr serves two customer types with different margin rules:

| Segment | Surface                       | Access                   | Pricing                                                          |
| ------- | ----------------------------- | ------------------------ | ---------------------------------------------------------------- |
| **B2C** | `/`, `/chat`, consumer routes | Any OTP user             | `provider_margin_rules` where `customer_segment = 'b2c'`         |
| **B2B** | `/partner/*`                  | Admin-granted email only | Same rules table where `customer_segment = 'b2b'` (lower markup) |

### Tables (migration 019)

- **`b2b_partners`** — partner organizations (`name`, `company_code`, `status`)
- **`b2b_partner_members`** — email grants linking users to a partner org

### Segment sync

On OTP or Google login, `auth.service` calls `syncUserSegment(userId, email)`:

1. Look up active membership by email in `b2b_partner_members`.
2. If found → upsert `user_travel_profiles.customer_segment = 'b2b'`.
3. If not found → set segment to `'b2c'`.
4. Revoking a member in admin sets membership inactive; next login resets to
   B2C.

`GET /auth/me` and `GET /partner/access` expose `customer_segment`,
`has_b2b_access`, and partner details to the frontend `AuthProvider`.

### Pricing application

The pricing engine (`pricing.service`) reads the user's segment when computing
`sell_amount` from `cost_amount` for API-sourced offers. Curated listings can
also respect segment-specific margin rules. Quote snapshots store
`customer_segment` on each line item for audit.

### Frontend gates

- **`PartnerGate`** — wraps `/partner/dashboard`, `/partner/chat`,
  `/partner/bookings`; redirects to `/partner` if `hasB2BAccess` is false.
- **`AdminGate`** — wraps admin routes; checks `GET /admin/access`.
- Partner and consumer chat share `ChatPageContent` / `BookingsContent` but
  route under different URL prefixes and segment context.

## Data Flow

### AI Chat Flow

```
User Message
    │
    ▼
Frontend POST /ai/stream  ───▶  Backend /ai/stream
    │                              │
    │                              ├── assert conversation ownership
    │                              ├── append user message (if conversation_id)
    │                              ├── build BrokerContext (plan summary, profile, recent turns)
    │                              ├── routeBrokerFlow → deterministic cards OR LLM
    │                              │
    │                              ▼
    │                   trip-plan.ensureFreshPlan → travel-supply adapters
    │                              │
    │                              ├── curated listings (DB, first in cards)
    │                              ├── Makcorps / Geoapify / Aviation (Redis-cached)
    │                              ├── applyMargin on API offers
    │                              │
    │                              ▼
    │                   AI Provider (when LLM path)
    │                              │
    │                              ├── text_delta ──▶ SSE ──▶ React Markdown
    │                              ├── tool_call cards (show_hotel_options, …)
    │                              ├── guardAssistantResponse on persist
    │                              └── booking tools:
    │                                  create_package  ──▶ planToPackageItems + /package
    │                                  generate_quote  ──▶ broker snapshots in quote_items
    │                                  start_checkout  ──▶ /payment/session
    │
    ▼
Card select POST /conversations/:id/plan/select ──▶ plan_data + confirmation cards
    │
    ▼
ToolCallRenderer ──▶ OptionCarousel / OptionList cards (Voyr Pick badges)
```

### Booking Flow

```
AI calls create_package  ──▶  Package created (DRAFT)
          │
          ▼
AI calls generate_quote  ──▶  Immutable quote with pricing (ACTIVE, 48h expiry)
          │
          ▼
AI calls start_checkout  ──▶  Payment session: checkout_url + payment_id + return_url
          │
          ▼
User completes mock checkout  ──▶  /payment/mock → POST /payment/mock/complete
          │
          ▼
/payment/return polls GET /payment/:id  ──▶  status paid
          │
          ▼
Booking auto-confirmed (BOOKING_CONFIRMED)
          │
          ├── booking_fulfillments per quote line (curated → pending_manual)
          ├── Document generation (inline if no QUEUE_URL, else queue consumer)
          │       └── PDF upload → R2 → public r2.dev URL
          └── Email notification (Resend)
          ▼
Booking progresses through document states → CUSTOMER_NOTIFIED (happy path)
```

### Conversation Persistence

```
Every user message + assistant turn is saved server-side when conversation_id is set.

Frontend:
  useStreamChat sends conversation_id (not full history) on /ai/stream.
  Card selections POST /conversations/:id/plan/select.
  useApi() → apiFetch / adminFetch with JWT refresh.

Backend:
  context-builder.service builds BrokerContext from DB messages + plan_data.
  ai-gateway persists assistant text + tool_calls; compactRollingSummary after 24+ messages.
  conversation.status tracks booking stage (package_created, quote_ready, checkout_ready).
  Share tokens → public read-only /chat/shared?token=.
```

## Key Design Decisions

### 1. Modular Monolith over Microservices

- Single deployment unit (Docker container) simplifies operations
- Shared database with foreign keys maintains data integrity
- Module boundaries enforced at the code level via route/service separation
- Easy to extract into microservices later if needed

### 2. Gateway Pattern (Cloudflare Worker)

- JWT validation at the edge — unauthenticated requests never reach the backend
- Public endpoints (/auth/login, /auth/verify, /webhook/\*) bypass auth
- Request metadata (x-request-id, x-timestamp) attached for tracing
- Can route to different backends or implement A/B testing

### 3. State Machine for Bookings

- 17 discrete states (DRAFT → PENDING → CONFIRMED → ACTIVE → ...)
- Validated transitions prevent illegal state changes
- Idempotency keys prevent duplicate operations
- Property-based tests verify state machine invariants

### 4. Immutable Quotes

- Quotes are write-once: a database trigger prevents updates
- Quotes expire after 48 hours (checked on read)
- Fresh pricing must regenerate a new quote

### 5. SSE + Tool Calling for AI

- Server-Sent Events stream tokens to the frontend in real-time
- Tool calls are executed server-side (not delegated to the client)
- Each tool call produces structured data that the frontend renders as a React
  component

### 6. Idempotency Layer

- Prevents double charges, duplicate bookings, and duplicate document generation
- Idempotency keys stored in a dedicated table with expiry
- Property-based tests ensure correctness under concurrent access

## Folder Structure Explained

```
voyr/
├── frontend/                 # Next.js 15 App Router — user-facing UI
│   └── src/app/
│       ├── page.tsx          # Landing page
│       ├── layout.tsx        # Root layout + font loading + AuthProvider
│       ├── chat/             # AI chat page + generative UI components
│       ├── travel-visa/      # Visa checker pages (main, detail, admin, compare)
│       ├── trips/            # Trip list page
│       ├── bookings/         # Booking list page
│       ├── saved/            # Wishlist persistence via backend API
│       ├── notifications/    # Notification center
│       ├── login/            # Email OTP login page
│       ├── verify/           # OTP verification page
│       ├── auth/             # AuthProvider (apiFetch, adminFetch), ProtectedRoute
│       ├── admin/ops/        # Admin operations dashboard + fulfillments
│       ├── admin/listings/   # Curated listing CRUD
│       ├── admin/pricing/    # Margin rules admin
│       ├── admin/partners/   # B2B partner orgs + member grants
│       ├── partner/          # B2B landing, dashboard, chat, bookings
│       ├── chat/components/cards/  # OptionCarousel, badges, SelectButton
│       ├── payment/return/   # Post-checkout status polling
│       ├── hooks/            # useAdminList, etc.
│       └── lib/              # api-url, payment-pending, format-time, conversation-status
│
├── backend/                  # Express + TypeScript API
│   └── src/
│       ├── index.ts          # Express setup: middleware, routes, error handler, shutdown
│       ├── db/               # PostgreSQL pool, migrations (19), seeds, verify-db
│       ├── infra/            # Cross-cutting concerns
│       │   ├── auth.middleware.ts     # requireAuth + requireAdmin
│       │   ├── idempotency.service.ts # Deduplication with property tests
│       │   ├── state-machine.engine.ts # 17-state booking lifecycle
│       │   ├── retry.ts               # Exponential backoff
│       │   ├── audit.service.ts       # Actor/action/entity logging
│       │   ├── metrics.service.ts     # Prometheus-style counters/histograms
│       │   ├── alerting.service.ts    # Slack webhook alerts
│       │   ├── error-handler.ts       # AppError hierarchy
│       │   ├── logger.ts              # Structured JSON logger
│       │   ├── request-context.middleware.ts # AsyncLocalStorage
│       │   └── validation.ts          # Request validation helpers
│       └── modules/          # Domain modules
│           ├── admin-ops/    # Admin dashboard + fulfillments queue
│           ├── ai-gateway/   # AI streaming, broker router, response guard
│           ├── auth/         # OTP login, JWT tokens
│           ├── aviation-stack/# Airport / route data
│           ├── booking/      # State machine + fulfillment hook
│           ├── conversation/ # Chat persistence + context builder
│           ├── curated-listings/ # Admin curated inventory
│           ├── documents/    # PDF generation + R2
│           ├── fulfillment/  # booking_fulfillments ledger
│           ├── geoapify/     # Places search
│           ├── inventory/    # Suppliers/services/options
│           ├── makcorps/     # Hotel pricing API
│           ├── notifications/# Email delivery
│           ├── package/      # Trip package CRUD
│           ├── partner/      # B2B access, admin partner CRUD
│           ├── payment/      # Mock + Razorpay webhook paths
│           ├── pricing/      # Margin rules engine
│           ├── quote/        # Immutable pricing + broker snapshots
│           ├── saved-trips/  # Wishlist persistence
│           ├── tinyfish/     # Web search for AI tools
│           ├── travel-supply/# Swappable supply adapters
│           ├── travel-visa/  # Visa requirement checker
│           └── trip-plan/    # plan_data, live fetch, selections
│
├── gateway/                  # Cloudflare Worker
│   └── src/index.ts          # JWT validation, routing, metadata
│
└── infra/                    # Cloudflare infrastructure configs
    ├── queues-config.toml    # Queue definitions (document gen, notifications)
    └── r2-config.toml        # R2 bucket config
```

## Module Pattern

Each backend module follows a consistent structure using **Dependency
Injection**:

```
module-name/
├── index.ts                 # Re-exports public API (routes, types), wires up dependencies
├── module-name.routes.ts    # Express route handlers, accepts injected service/callbacks
└── module-name.service.ts   # Business logic + DB queries, exports a factory function
```

- Services are created via factory functions (e.g.,
  `createBookingService({ callbacks })`), accepting external module dependencies
  via injected callbacks.
- Routes define HTTP methods and middleware, and receive the instantiated
  service.
- The `index.ts` barrel file constructs the module by wiring it up and passing
  necessary cross-module callbacks (e.g., payment webhook handlers triggering
  booking logic, booking confirm triggering document generation). This decoupled
  approach completely avoids circular dependencies.

## Security Architecture

1. **Authentication:** Email OTP → JWT access/refresh tokens (Google route
   optional, UI not shipped)
2. **Gateway:** Validates JWT at the edge; forwards `x-user-id` and
   `x-user-email`
3. **Backend Auth:** Global `requireAuth` middleware checks `x-user-id`
4. **Admin Auth:** `requireAdmin` checks `ADMIN_EMAILS` / `ADMIN_USER_IDS` from
   JWT-derived headers; `GET /admin/access` for UI gating
5. **Public endpoints:** `/health`, `/metrics`, `/auth/login`, `/auth/verify`,
   `/auth/refresh`, `/webhook/*` (gateway public list)
6. **Webhook security:** HMAC on payment webhooks (live Razorpay) or mock
   webhook secret
7. **Idempotency:** Prevents duplicate payments, bookings, and document jobs
