# Domain docs

Vocabulary and documentation map for contributors and AI agents working on Voyr.

**Layout:** Single-context monorepo — one Postgres database, one backend,
consumer and B2B surfaces on the same frontend.

## Documentation index

| Path                                                               | Purpose                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| [docs/STATUS.md](../STATUS.md)                                     | Implemented / pending / limitations / dependencies              |
| [docs/architecture.md](../architecture.md)                         | System architecture, broker model, B2B segmentation, data flows |
| [docs/api.md](../api.md)                                           | Complete REST API reference                                     |
| [docs/setup.md](../setup.md)                                       | Local dev, Supabase pooler, migrations, B2B setup               |
| [docs/deployment.md](../deployment.md)                             | Production deploy (Railway + Cloudflare)                        |
| [docs/railway-deploy.md](../railway-deploy.md)                     | Railway backend deploy and troubleshooting                      |
| [docs/tier-c-deploy.md](../tier-c-deploy.md)                       | Tier C checklist (mock payments)                                |
| [docs/travel-visa/requirements.md](../travel-visa/requirements.md) | Visa feature specification                                      |
| [docs/travel-visa/design.md](../travel-visa/design.md)             | Visa module data model and routes                               |

---

## Core domain

| Term                | Meaning                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Broker**          | Voyr buys supply (curated admin / future Riya) and sells to customer with margin            |
| **Curated listing** | Admin-owned inventory in `curated_listings`; shown first in chat as Voyr Pick               |
| **plan_data**       | JSON on `conversations` — selections, live supply cache, customer segment                   |
| **Supply source**   | Origin of a line: `curated`, `makcorps`, `geoapify`, `aviation_stack`, `riya_connect`, …    |
| **Margin rule**     | Admin config in `provider_margin_rules` — B2C/B2B markup by provider/destination            |
| **Fulfillment**     | Post-payment ledger row in `booking_fulfillments` — what Voyr owes supplier                 |
| **Quote snapshot**  | Immutable `quote_items.service_snapshot` with sell/cost/margin when broker metadata present |

## B2B domain

| Term                  | Meaning                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| **Partner org**       | Row in `b2b_partners` — a travel agency or wholesale buyer (`company_code` unique)    |
| **Partner member**    | Row in `b2b_partner_members` — email grant linking a user to a partner org            |
| **customer_segment**  | `'b2c'` or `'b2b'` on `user_travel_profiles`; drives margin rule selection            |
| **has_b2b_access**    | Boolean from `GET /auth/me` or `GET /partner/access` — active membership exists       |
| **syncUserSegment**   | Auth hook on login — sets segment from membership; revokes → B2C                      |
| **Partner portal**    | Frontend routes under `/partner/*`; gated by `PartnerGate`                            |
| **Wholesale pricing** | Same pricing engine as B2C but `customer_segment = 'b2b'` margin rules (lower markup) |

B2B access is **admin-controlled only**. There is no public partner signup.

## Chat flow vocabulary

| Term                   | Meaning                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **BrokerContext**      | Server-built LLM context: profile, plan summary, recent turns, rolling summary       |
| **Broker flow router** | Deterministic path: follow-up cards or full plan cards before LLM                    |
| **Display tool**       | SSE `tool_call` that renders a card (`show_hotel_options`, `show_ticket_options`, …) |
| **Selection**          | User tap → `POST /conversations/:id/plan/select` → updates `plan_data`               |

## Booking pipeline states

Conversation `status` progresses: `planning` → `package_created` → `quote_ready`
→ `checkout_ready` (set by AI booking tools).

Booking state machine (separate): `PAYMENT_PAID` → `BOOKING_CONFIRMED` →
document states → `CUSTOMER_NOTIFIED`.

---

## Contributor rules

1. **docs/STATUS.md** — read first for what is shipped vs pending and known
   issues.
2. **docs/architecture.md** — read before editing unfamiliar modules.
3. **docs/api.md** — update when adding or modifying API endpoints.
4. New domain concepts → update this file and `docs/architecture.md`.
5. Never commit secrets — use `.env` files (gitignored) and env examples with
   placeholders only.
