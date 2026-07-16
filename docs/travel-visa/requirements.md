# Travel Visa Assistant — Requirements

## Overview

The Travel Visa Assistant lets users check visa requirements for any supported
passport/destination pair. It is built for travel agents and their customers to
quickly determine visa status, required documents, fees, and processing times.

**Related docs:**

- [design.md](./design.md) — data model, routes, seed coverage, refresh script
- [../api.md](../api.md) — sections 14–16 (visa, corrections, admin CRUD)
- [../STATUS.md](../STATUS.md) — auth requirements (visa checker needs login via
  gateway)

The feature is integrated with the main Voyr chat: the AI can call
`show_visa_info` during trip planning and render a `VisaInfoCard`. Admin data
maintenance lives at `/travel-visa/admin` (requires `ADMIN_EMAILS`).

## Supported Passport Countries (9)

| Code | Country        | Requirements    |
| ---- | -------------- | --------------- |
| IN   | India          | 40 destinations |
| US   | United States  | 40 destinations |
| GB   | United Kingdom | 40 destinations |
| AE   | UAE            | 40 destinations |
| AU   | Australia      | 40 destinations |
| CA   | Canada         | 40 destinations |
| JP   | Japan          | 40 destinations |
| CN   | China          | 40 destinations |
| RU   | Russia         | 40 destinations |

## Supported Destinations

40 countries across Asia, Europe, North America, Oceania, Middle East, and
Africa.

## Key Features

### 1. Visa Status Check

- Determine visa status between any supported passport/destination pair
- Status types: `visa_free`, `visa_on_arrival`, `e_visa`, `evisa_available`,
  `visa_required`, `eta_required`
- Max stay duration per visa type
- Official source URLs and last-verified timestamps

### 2. Document Requirements

- Per-country document checklists for visa applications
- 18 document types supported (passport, photo, bank statements, etc.)
- Required vs recommended documents
- Descriptions and notes per requirement

### 3. Visa Fee Information

- Fee amounts with currency
- Processing time ranges (min/max days)
- Fee notes and official URLs

### 4. Multi-Destination Check

- Check visa requirements for multiple destinations at once
- Summary breakdown by visa type
- Action-needed flags for complex statuses

### 5. User Corrections

- Users can submit corrections for inaccurate data
- Admin review workflow (approve/reject)
- Automated data refresh from passport-index CSV

### 6. AI Chat Integration

- AI tool `show_visa_info` can be called during trip planning
- Visa info rendered as `VisaInfoCard` in chat
- Destination auto-preloading from URL params

## Coverage Summary

| Metric                      | Value                 |
| --------------------------- | --------------------- |
| Passport countries          | 9                     |
| Destination countries       | 40                    |
| Visa requirements           | 331                   |
| Document records            | 216 (39 countries)    |
| Fee records                 | 40 (all 40 countries) |
| API endpoints (visa)        | 8                     |
| API endpoints (corrections) | 3                     |
| API endpoints (admin)       | 9                     |
| Backend tests               | 12                    |

## Backend Tests

- 12 integration tests covering all service methods
- Integration tests against live PostgreSQL database
- Covers: countries CRUD, visa checks, multi-destination, documents, fees, edge
  cases
- All passing (requires database connection)
