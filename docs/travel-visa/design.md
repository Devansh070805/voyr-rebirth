# Travel Visa Assistant — Design

Technical design for the travel-visa module: PostgreSQL tables, Express service
layer, Next.js pages, and AI chat integration.

**Spec:** [requirements.md](./requirements.md) · **API:** [../api.md](../api.md)
sections 14–16

## Architecture

```
Frontend (Next.js 15) → Backend API (Express) → PostgreSQL
                                    ↕
                              AI Chat (tool calling)
```

## Data Model

### travel_countries

- `iso_code` (PK) — 2-letter country code
- `name` — Country name
- `flag_emoji` — Emoji flag
- `region / subregion` — Geographic grouping
- `is_popular_destination` — Featured destination flag
- `requires_eta` — Whether ETA is needed
- `eta_url` — Official ETA URL
- `official_visa_url` — Government visa info URL
- `currency` — Local currency
- `languages` — Spoken languages

### travel_visa_requirements

- `id` (PK) — Auto-increment
- `passport_country` — Passport ISO code
- `destination_country` — Destination ISO code
- `visa_status` — Enum of visa types
- `visa_type` — Tourist / Business / Transit
- `max_stay_days` — Max permitted stay
- `notes` — Additional info
- `official_source_url` — Source citation
- `last_verified` — When data was verified
- `UNIQUE(passport_country, destination_country)`

### visa_documents

- `id` (PK) — Auto-increment
- `destination_country` — Country ISO code
- `visa_type` — Visa category
- `document_type` — Type of document
- `is_required` — Required vs optional
- `description` — What this document is
- `notes` — Additional info
- `sort_order` — Display ordering

### visa_fees

- `id` (PK) — Auto-increment
- `destination_country` — Country ISO code
- `visa_type` — Visa category
- `fee_amount` — Numeric fee
- `fee_currency` — 3-letter currency code
- `processing_time_days_min / max` — Processing window
- `notes` — Additional info
- `official_url` — Source URL

### visa_corrections (Phase 4)

- User-submitted correction suggestions
- Fields: passport_country, destination_country, field, current_value,
  suggested_value, status (pending/approved/rejected)
- Supports crowdsourced data accuracy

## Service Methods

1. `getCountry(isoCode)` — Single country lookup
2. `getAllCountries()` — List all 40 countries
3. `getPopularDestinations()` — Featured countries
4. `checkVisa({passport_country, destination_country, purpose})` — Visa check
   with documents and fees
5. `checkMultipleVisas({passport_country, destinations})` — Multi-destination
   check with summary
6. `getVisaDocuments(country, visaType?)` — Document requirements
7. `getVisaFees(country, visaType?)` — Fee information

## Frontend Pages

| Page    | Path                         | Description                                                         |
| ------- | ---------------------------- | ------------------------------------------------------------------- |
| Main    | `/travel-visa`               | Passport + destination selectors, result card, popular destinations |
| Detail  | `/travel-visa/[destination]` | Country info, visa status, documents, fees, timeline                |
| Compare | `/travel-visa/compare`       | Side-by-side multi-destination comparison                           |
| Admin   | `/travel-visa/admin`         | Tabbed CRUD (requirements, documents, fees, corrections review)     |
| Ops     | `/admin/ops`                 | Read-only ops queues (active bookings after auto-confirm)           |

## Data Flow

1. User selects passport + destination on main page
2. Frontend calls `POST /travel-visa/check`
3. Backend looks up requirement, returns status + documents + fees
4. Frontend renders result card with appropriate color/icon
5. User can click through to detail page for full info
6. AI chat can call `show_visa_info` tool in parallel with travel planning

## Seed Data Coverage (Current)

| Dataset               | Records                                |
| --------------------- | -------------------------------------- |
| Countries             | 40                                     |
| Passport types        | 9 (IN, US, GB, AE, AU, CA, JP, CN, RU) |
| Visa Requirements     | 331                                    |
| Document Requirements | 216 (39 countries)                     |
| Visa Fees             | 40 (all countries)                     |

## API Endpoints

**Visa Check (7 endpoints):** `GET /travel-visa/countries`,
`GET /travel-visa/countries/popular`, `GET /travel-visa/countries/:code`,
`POST /travel-visa/check`, `POST /travel-visa/check-multiple`,
`GET /travel-visa/destinations/:code/documents`,
`GET /travel-visa/destinations/:code/fees`,
`GET /travel-visa/destinations/:code`

**Corrections (3 endpoints):** `POST /travel-visa/corrections`,
`GET /travel-visa/corrections`, `PATCH /travel-visa/corrections/:id`

**Admin CRUD (9 endpoints):** Countries, requirements, documents, fees — all
with GET/PUT/DELETE

## Test Coverage

12 integration tests covering all service methods, edge cases (null country,
empty results), and multi-destination checks. Requires a running PostgreSQL
instance.

```bash
cd backend
npx vitest run src/modules/travel-visa/
```

## Data refresh

```bash
cd backend
npx tsx src/db/refresh-from-passport-index.ts
```

Fetches the latest visa requirement CSV from the passport-index GitHub
repository and updates requirement records.
