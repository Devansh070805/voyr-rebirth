# API Reference

**Authentication:** Protected endpoints require `x-user-id` (and usually
`x-user-email`) set by the gateway from the JWT. When calling the backend
directly, also send `Authorization: Bearer <access_token>`. Admin routes require
an authenticated user whose email or ID is in `ADMIN_EMAILS` / `ADMIN_USER_IDS`.
See [Authentication](#authentication).

**Base URLs:**

| Environment              | URL                                                   |
| ------------------------ | ----------------------------------------------------- |
| Local (gateway)          | `http://127.0.0.1:8787`                               |
| Local (backend direct)   | `http://localhost:3001`                               |
| Production (via gateway) | `https://voyr-travel-ops.aryansaxenaalig.workers.dev` |

---

## Authentication

| Header              | Required On                 | Description                             |
| ------------------- | --------------------------- | --------------------------------------- |
| `Authorization`     | Protected (via gateway)     | `Bearer <access_token>` from OTP login  |
| `x-user-id`         | Protected                   | Set by gateway from JWT `sub`           |
| `x-user-email`      | Admin (production)          | Set by gateway from JWT `email`         |
| `x-idempotency-key` | Payment, booking, documents | Prevents duplicate operations           |
| `x-signature`       | Webhook                     | HMAC signature for webhook verification |

**Public endpoints** (no JWT at gateway; no `x-user-id` on backend):

| Endpoint                | Notes                                               |
| ----------------------- | --------------------------------------------------- |
| `POST /auth/login`      | Send OTP                                            |
| `POST /auth/verify`     | Exchange OTP for tokens                             |
| `POST /auth/refresh`    | Refresh access token                                |
| `POST /auth/google`     | Google ID token (no UI)                             |
| `POST /auth/logout`     | Revoke refresh token                                |
| `POST /webhook/payment` | Live Razorpay webhook                               |
| `GET /health`           | Backend only — not proxied as public via gateway    |
| `GET /metrics`          | Backend only — Bearer `METRICS_TOKEN` in production |

**All other routes require JWT** when using the gateway, including:

- `/ai/stream`, `/conversations/*`, `/travel-visa/*`, `/package`, `/quote`,
  `/payment/session`, `/partner/*`, `/admin/*`

`GET /conversations/shared/:token` is documented for public sharing but is
**currently blocked** by gateway JWT and backend `requireAuth` — see
[STATUS.md](./STATUS.md).

---

## 1. Health & Observability

### `GET /health`

Health check — verifies database connectivity.

**Response `200`**

```json
{ "status": "ok", "database": "connected", "timestamp": "2026-05-07T..." }
```

**Response `503`**

```json
{
  "status": "degraded",
  "database": "disconnected",
  "timestamp": "2026-05-07T..."
}
```

### `GET /metrics`

Prometheus-style metrics summary (request latency, event counts, etc.).

---

## 2. Auth — `/auth`

### `POST /auth/login`

Send an OTP code to the user's email.

**Body**

```json
{ "email": "user@example.com" }
```

**Response `200`**

```json
{ "message": "OTP sent", "expires_in": 300 }
```

### `POST /auth/verify`

Verify the OTP and receive JWT tokens.

**Body**

```json
{ "email": "user@example.com", "otp": "123456" }
```

**Response `200`**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}
```

### `POST /auth/refresh`

Refresh an expired access token.

**Body**

```json
{ "refresh_token": "eyJ..." }
```

**Response `200`**

```json
{ "access_token": "eyJ...", "expires_in": 900 }
```

### `GET /auth/me`

Return the authenticated user's profile, B2B segment, and partner info. Called
by the frontend `AuthProvider` after login and on profile refresh.

**Headers:** `x-user-id`, `x-user-email` (from gateway JWT).

**Response `200`**

```json
{
  "user": { "id": "uuid", "email": "partner@agency.com" },
  "customer_segment": "b2b",
  "has_b2b_access": true,
  "partner": {
    "id": "uuid",
    "name": "Acme Travel",
    "company_code": "ACME",
    "status": "active"
  }
}
```

When the user has no B2B grant, `customer_segment` is `"b2c"`, `has_b2b_access`
is `false`, and `partner` is `null`.

**Response `401`** — missing `x-user-id`.

### `POST /auth/google`

Sign in with a Google ID token. **Backend route exists; frontend UI is not
shipped** (OTP-only login).

**Body**

```json
{ "credential": "<google-id-token>" }
```

**Response `200`**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}
```

### `POST /auth/logout`

Revoke a refresh token.

**Body**

```json
{ "refresh_token": "eyJ..." }
```

---

## 3. AI Gateway — `/ai`

### `POST /ai/stream`

Unified SSE streaming endpoint with server-side tool calling and broker flow
routing.

**Headers:** `x-user-id`, `x-user-email` (recommended for admin segment /
profile)

**Body**

```json
{
  "message": "Plan a trip to Bali for 5 nights",
  "conversation_id": "uuid"
}
```

When `conversation_id` is provided, the server loads history and plan context
from the database. `conversation_history` in the body is ignored (legacy
fallback only when `conversation_id` is omitted).

**Response:** SSE stream with events:

- `text_delta` — Token-by-token content
- `tool_call` — Structured card data (hotels, activities, flights, tickets, …)
- `suggestions` — Follow-up prompt chips
- `tool_result` — Booking tool outcomes
- `error` — Stream failure
- `done` — End of stream

**Behavior:**

- Trip intent → fetch live supply (curated + Makcorps/Geoapify/Aviation) → emit
  cards without LLM when possible
- Assistant turns persisted server-side with `tool_calls` and response guard
- Booking tools: `create_package`, `generate_quote`, `start_checkout`

**Rate limit:** 20 requests/hour per user (backend middleware on `/ai`).

### `POST /ai/enrich`

Enrich content for a destination.

**Body** `{ "destination": string }`

### `POST /ai/recommend`

Get personalized travel recommendations.

**Body** `{ "preferences": object }`

---

## 4. Conversations — `/conversations`

### `POST /conversations`

Create a new conversation.

**Headers:** `x-user-id`

**Body** `{ "title"?: string }`

### `GET /conversations`

List user's conversations.

**Headers:** `x-user-id`

**Query:** `?limit=20` (max 50, defaults to 20)

### `GET /conversations/:id`

Get a conversation by ID.

### `GET /conversations/shared/:token`

Get a conversation by share token for read-only display at
`/chat/shared?token=`.

**Intended:** public (no auth).

**Current limitation:** gateway and backend `requireAuth` block unauthenticated
requests — share links return 401 in production until public route is
whitelisted. See [STATUS.md](./STATUS.md).

### `GET /conversations/:id/messages`

Get messages for a conversation.

**Query:** `?limit=100` (max 500, defaults to 100)

### `POST /conversations/:id/messages`

Append a message.

**Body**

```json
{
  "role": "user" | "assistant",
  "content": "string",
  "tool_calls"?: object[]
}
```

### `PUT /conversations/:id/title`

Update conversation title.

**Body** `{ "title": string }`

### `POST /conversations/:id/share`

Generate a public share token.

**Response**

```json
{
  "share_token": "abc123",
  "share_url": "http://localhost:3000/chat/shared/abc123"
}
```

### `DELETE /conversations/:id`

Soft-delete a conversation.

### `GET /conversations/:id/plan`

Get the active trip plan (`plan_data`) for a conversation.

**Headers:** `x-user-id` (ownership enforced)

**Response:** Trip plan JSON (`destination`, `selected_hotel`,
`live_data.curated`, …)

### `POST /conversations/:id/plan/select`

Apply a card selection to the plan.

**Headers:** `x-user-id` (ownership enforced)

**Body**

```json
{
  "type": "hotel" | "activity" | "flight" | "ticket" | "remove_activity",
  "item": { "name": "...", "listing_id": "...", "source": "curated" | "api", ... }
}
```

**Response**

```json
{
  "plan": { ... },
  "message": "Got it — **Hotel Name** is now your hotel...",
  "tool_calls": [ ... ],
  "assistant_message": { ... }
}
```

---

## 5. Package — `/package`

### `POST /package`

Create a new draft package.

**Headers:** `x-user-id`

**Body**

```json
{ "destination": "Japan", "nights": 14, "people": 2 }
```

### `GET /package/:id`

Get package details.

### `GET /package/:id/items`

List items in a package.

### `POST /package/:id/items`

Add an item to a draft package.

**Body**

```json
{ "option_id": "uuid", "quantity": 1, "selected_date": "2026-06-15" }
```

### `DELETE /package/:id/items/:itemId`

Remove an item from a draft package.

---

## 6. Quote — `/quote`

### `POST /quote/generate`

Generate an immutable quote for a package. Pricing: base + 18% tax + 10%
markup + ₹500 service fee.

**Body** `{ "package_id": string }`

### `GET /quote/:id`

Get quote details. Checks and updates expiry status on read (quotes expire after
48 hours).

---

## 7. Payment — `/payment`

When `PAYMENT_MODE=mock` (Tier C default), checkout URLs point to
`/payment/mock?payment_id=...` on the frontend. Use
`POST /payment/mock/complete` to simulate a successful payment.

### `POST /payment/session`

Create a payment session (checkout URL).

**Headers:** `Idempotency-Key` or `x-idempotency-key`

**Body** `{ "quote_id": string }`

**Response (mock mode)**

```json
{
  "checkout_url": "https://your-frontend.com/payment/mock?payment_id=uuid",
  "payment_id": "uuid",
  "return_url": "https://your-frontend.com/payment/return?payment_id=uuid"
}
```

**Response (live Razorpay — not yet enabled)**

```json
{
  "checkout_url": "https://checkout.razorpay.com/pay/razorpay_<payment_id>",
  "payment_id": "uuid",
  "return_url": "https://your-frontend.com/payment/return?payment_id=uuid"
}
```

`return_url` is built from backend `FRONTEND_URL`. The frontend opens
`checkout_url` and polls via `/payment/return`.

### `POST /payment/mock/complete`

**Mock mode only.** Simulates provider webhook completion.

**Body** `{ "payment_id": string, "status"?: "paid" | "failed" }`

### `GET /payment/:id`

Get payment details (used by `/payment/return` polling). Response includes
`payment_mode`: `"mock"` or `"live"`.

---

## 8. Webhook — `/webhook`

### `POST /webhook/payment`

Process payment provider webhook. Used for **live Razorpay**; mock flow uses
`POST /payment/mock/complete` instead.

**Headers:** `x-signature`, `Idempotency-Key`

**Body**

```json
{
  "payment_id": "string",
  "status": "paid",
  "event": "checkout.session.completed"
}
```

---

## 9. Booking — `/booking`

### `GET /booking/:id`

Get booking details.

Bookings are created and confirmed automatically after payment (webhook or mock
complete). There is no manual confirm/reject API.

---

## 10. Inventory — `/inventory`

### `POST /inventory/suppliers`

Create a supplier. **Body:** `{ name, type, metadata? }`

### `GET /inventory/suppliers`

List suppliers. **Query:** `?type=`

### `POST /inventory/services`

Create a service. **Body:**
`{ supplier_id, location_id, type, name, metadata? }`

### `GET /inventory/services`

List services. **Query:** `?supplier_id=&location_id=&type=`

### `POST /inventory/options`

Create a service option. **Body:** `{ service_id, name, capacity, metadata? }`

### `GET /inventory/options`

List options. **Query:** `?service_id=` (required)

### `POST /inventory/prices`

Set a price for an option. **Body:**
`{ option_id, price, currency, valid_from, valid_to }`

### `POST /inventory/availability`

Set availability for an option. **Body:** `{ option_id, date, available }`

### `POST /inventory/policies`

Set a policy. **Body:** `{ service_id, cancellation_policy, refund_rules }`

### `POST /inventory/locations`

Create a location. **Body:** `{ city, country, lat, lng }`

### `GET /inventory/locations`

List locations. **Query:** `?country=&city=`

---

## 11. Documents — `/documents`

### `GET /documents/:bookingId`

List all documents for a booking.

### `POST /documents/enqueue`

Queue document generation.

**Body** `{ "booking_id": string, "idempotency_key": string }`

### `POST /documents/process`

Process a queue message (internal consumer).

**Body** `{ "bookingId": string, "jobId": string, "attempt"?: number }`

---

## 12. Notifications — `/notifications`

### `POST /notifications/send-documents`

Send booking documents via email (Resend).

**Body**
`{ "booking_id": string, "user_id": string, "idempotency_key": string }`

---

## 13. Admin Ops — `/admin`

Requires authenticated user in `ADMIN_EMAILS` or `ADMIN_USER_IDS`
(`requireAdmin` middleware). Call `GET /admin/access` from the UI first.

| Method | Path                       | Description                             |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/admin/access`            | Whether current user may access admin   |
| GET    | `/admin/active-bookings`   | Confirmed bookings in document pipeline |
| GET    | `/admin/failed-payments`   | Failed payments                         |
| GET    | `/admin/expired-quotes`    | Expired quotes                          |
| GET    | `/admin/supplier-pending`  | Pending supplier confirmations          |
| GET    | `/admin/document-failures` | Failed document generation jobs         |
| GET    | `/admin/refund-requests`   | Refund-pending bookings                 |
| GET    | `/admin/fulfillments`      | Broker fulfillment ledger (pending)     |
| PATCH  | `/admin/fulfillments/:id`  | Update fulfillment / settlement status  |

**Frontend:** `/admin/ops` — monitoring queues + fulfillments tab.

**Fulfillment PATCH body:**

```json
{
  "fulfillment_status": "confirmed" | "pending_manual" | "pending_provider" | ...,
  "settlement_status": "unpaid" | "invoiced" | "settled"
}
```

Bookings move to **active-bookings** automatically after payment. Fulfillment
rows are created on booking confirm from quote line snapshots with
`supply_source`.

---

## 14. Travel Visa — `/travel-visa`

### `GET /travel-visa/countries`

List all 40 countries.

### `GET /travel-visa/countries/popular`

Get popular tourist destinations.

### `GET /travel-visa/countries/:code`

Get country by 2-letter ISO code (e.g., `JP`, `TH`).

### `POST /travel-visa/check`

Check visa requirement for a single destination.

**Body**

```json
{
  "passport_country": "IN",
  "destination_country": "JP",
  "purpose"?: "tourist" | "business"
}
```

### `POST /travel-visa/check-multiple`

Check visa requirements for multiple destinations (max 50).

**Body**

```json
{
  "passport_country": "IN",
  "destinations": ["JP", "TH", "SG"],
  "purpose"?: string
}
```

### `GET /travel-visa/destinations/:code/documents`

Get required documents. **Query:** `?visa_type=`

### `GET /travel-visa/destinations/:code/fees`

Get visa fees. **Query:** `?visa_type=`

### `GET /travel-visa/destinations/:code`

Get complete visa info (country + documents + fees).

---

## 15. Visa Corrections — `/travel-visa`

### `POST /travel-visa/corrections`

Submit a correction suggestion.

**Body**

```json
{
  "passport_country": "IN",
  "destination_country": "JP",
  "field": "visa_status",
  "current_value"?: "visa_required",
  "suggested_value": "visa_free",
  "notes"?: "I traveled last week without a visa"
}
```

### `GET /travel-visa/corrections`

**Admin.** List all corrections (max 100).

### `PATCH /travel-visa/corrections/:id`

**Admin.** Review/update a correction.

**Body**
`{ "status": "approved" | "rejected", "admin_notes"?: string, "reviewed_by"?: string }`

---

## 16. Visa Admin — `/admin/visa/admin`

Requires admin allowlist (`ADMIN_EMAILS` / `ADMIN_USER_IDS`), same as
`/admin/*`.

| Method | Path                                                    | Description                      |
| ------ | ------------------------------------------------------- | -------------------------------- |
| GET    | `/admin/visa/admin/countries`                           | List countries                   |
| PUT    | `/admin/visa/admin/countries/:code`                     | Update country                   |
| GET    | `/admin/visa/admin/requirements`                        | List requirements (`?passport=`) |
| PUT    | `/admin/visa/admin/requirements`                        | Upsert requirement               |
| DELETE | `/admin/visa/admin/requirements/:passport/:destination` | Delete requirement               |
| GET    | `/admin/visa/admin/documents`                           | List documents (`?destination=`) |
| PUT    | `/admin/visa/admin/documents`                           | Create/update document           |
| GET    | `/admin/visa/admin/fees`                                | List fees (`?destination=`)      |
| PUT    | `/admin/visa/admin/fees`                                | Upsert fee                       |

**Frontend:** `/travel-visa/admin` — tabbed UI (requirements, documents, fees,
corrections) using `adminFetch` from `AuthProvider` (JWT + allowlist).

---

## 17. Flights — `/flights`

### `GET /flights/airports?country=`

Search for airports by country name.

---

## 18. Places — `/places`

### `GET /places/geocode?q=`

Geocode an address or location name.

---

## 19. Hotels — `/hotels`

### `GET /hotels?destination=&check_in=&check_out=`

Search for hotel pricing data.

---

## 20. Search — `/search`

### `GET /search/<resource>`

Generic proxy to third-party travel API (hotels, flights, activities).

---

## 21. Saved Trips — `/saved-trips`

### `GET /saved-trips`

List all saved trips for the authenticated user.

### `POST /saved-trips`

Save a trip item. **Body:**
`{ title, type, location, price, image, conversationId }`

### `DELETE /saved-trips/:id`

Delete a saved trip item.

---

## 22. Admin Curated Listings — `/admin/listings`

Requires admin allowlist. CRUD for broker-owned inventory shown first in chat.

| Method | Path                    | Description                                  |
| ------ | ----------------------- | -------------------------------------------- |
| GET    | `/admin/listings/types` | Supported listing types                      |
| GET    | `/admin/listings`       | List (`?type=`, `?destination=`, `?active=`) |
| GET    | `/admin/listings/:id`   | Get one listing                              |
| POST   | `/admin/listings`       | Create listing (cost/sell, payload)          |
| PUT    | `/admin/listings/:id`   | Update listing                               |
| DELETE | `/admin/listings/:id`   | Delete listing                               |

Listings include `cost_price`, `sell_price`, `inventory_option_id` (optional
link to inventory for quotes), and `fulfillment_mode` (`manual` | `inventory`).

**Frontend:** `/admin/listings`

---

## 23. Admin Pricing — `/admin/pricing`

| Method | Path                         | Description                                  |
| ------ | ---------------------------- | -------------------------------------------- |
| GET    | `/admin/pricing/margins`     | List margin rules                            |
| POST   | `/admin/pricing/margins`     | Create rule (provider, segment, destination) |
| PUT    | `/admin/pricing/margins/:id` | Update rule                                  |
| DELETE | `/admin/pricing/margins/:id` | Delete rule                                  |
| POST   | `/admin/pricing/preview`     | Preview margin on a base price               |

**Frontend:** `/admin/pricing`

Quote item snapshots include broker fields when inventory metadata is present:
`supply_source`, `cost_amount`, `sell_amount`, `margin_amount`,
`customer_segment`, `curated_listing_id`.

---

## 24. B2B Partner — `/partner`

Partner routes use the same JWT auth as consumer routes. Access is enforced by
checking active membership in `b2b_partner_members`.

### `GET /partner/access`

Whether the current user has active B2B portal access.

**Response `200`**

```json
{
  "has_access": true,
  "customer_segment": "b2b",
  "partner": {
    "id": "uuid",
    "name": "Acme Travel",
    "company_code": "ACME",
    "status": "active"
  }
}
```

### `GET /partner/profile`

Partner details for authenticated B2B users. Returns **403** if `has_access` is
false.

**Response `200`**

```json
{
  "partner": {
    "id": "uuid",
    "name": "Acme Travel",
    "company_code": "ACME",
    "status": "active"
  },
  "customer_segment": "b2b"
}
```

**Frontend:** `/partner`, `/partner/dashboard`, `/partner/chat`,
`/partner/bookings`

---

## 25. Admin B2B Partners — `/admin/partners`

All routes require admin auth (`requireAdmin`).

| Method | Path                                    | Description                        |
| ------ | --------------------------------------- | ---------------------------------- |
| GET    | `/admin/partners`                       | List all partners with members     |
| GET    | `/admin/partners/:id`                   | Single partner with members        |
| POST   | `/admin/partners`                       | Create partner org                 |
| PUT    | `/admin/partners/:id`                   | Update partner or revoke org       |
| DELETE | `/admin/partners/:id`                   | Delete partner and all memberships |
| POST   | `/admin/partners/:id/members`           | Grant access by email              |
| DELETE | `/admin/partners/:id/members/:memberId` | Revoke member access               |

**Create partner body**

```json
{
  "name": "Acme Travel",
  "company_code": "ACME",
  "contact_email": "ops@acme.com",
  "notes": "Optional"
}
```

Required: `name`, `company_code`.

**Grant member body**

```json
{ "email": "agent@acme.com" }
```

Revoking a member sets membership inactive and resets the user's segment to B2C
on their next login via `syncUserSegment()`.

**Frontend:** `/admin/partners`

---

## Coverage

| Dataset           | Count                                                          |
| ----------------- | -------------------------------------------------------------- |
| Countries         | 40                                                             |
| Passport types    | 9 (IN, US, GB, AE, AU, CA, JP, CN, RU)                         |
| Visa requirements | 331                                                            |
| Document records  | 216 (39 countries)                                             |
| Fee records       | 40 (all 40 countries)                                          |
| DB migrations     | 19                                                             |
| DB tables         | 38 application (+ `pgmigrations`)                              |
| API endpoints     | 75+ (broker, B2B partners, travel supply, visa, booking, chat) |

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details"?: { "field": "Specific validation error" }
  }
}
```

| HTTP Status | Error Code             | Description                          |
| ----------- | ---------------------- | ------------------------------------ |
| 400         | `VALIDATION_ERROR`     | Invalid request body or parameters   |
| 401         | `UNAUTHORIZED`         | Missing or invalid authentication    |
| 403         | `FORBIDDEN`            | Insufficient permissions             |
| 404         | `NOT_FOUND`            | Resource not found                   |
| 409         | `CONFLICT`             | Duplicate operation (idempotency)    |
| 422         | `UNPROCESSABLE_ENTITY` | Business logic violation             |
| 429         | `TOO_MANY_REQUESTS`    | Rate limited                         |
| 500         | `INTERNAL_ERROR`       | Unexpected server error              |
| 503         | `SERVICE_UNAVAILABLE`  | Database or external dependency down |
