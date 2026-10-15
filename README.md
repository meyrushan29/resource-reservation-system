# ResourceDesk: Resource Reservation Management System

A full-stack web application for booking shared rooms, workspaces and equipment, which
**prevents double-bookings at the database level**.

Built for the PrimeWave Lab (Pvt) Ltd Software Engineering Internship technical assessment.

---

## Business problem

Shared facilities are booked through informal messages and manual records. This leads to
overlapping reservations, uncertainty about what is free, inconsistent records, and no clear view
of upcoming bookings as the organization grows.

## Solution overview

ResourceDesk keeps every resource and reservation in one PostgreSQL database:

- **Resources** (rooms, workspaces, equipment) can be created, edited, searched, filtered and deactivated.
- **Reservations** can be created, edited and cancelled, with live availability feedback in the form.
- **Conflicts are impossible.** Two confirmed reservations for the same resource can never overlap.
  This is enforced by a PostgreSQL exclusion constraint, so it also holds under concurrent requests.
- A **dashboard** and a **calendar** (day and week views) show what is booked and what is free.

## Features

| Area | What you can do |
|---|---|
| Dashboard | Live counts (total and active resources, today's, upcoming and cancelled reservations), upcoming reservations, availability of each resource right now (*available*, *in use until…*, *inactive*, and the next booking today), recent reservation changes, quick actions |
| Resources | List with name search, type and status filters, sorting and pagination; create and edit with field-level validation; detail page with upcoming bookings; deactivate or reactivate with confirmation (history is kept, no hard delete) |
| Reservations | Upcoming, Past, Cancelled and All views; search (purpose, requester, resource, `RSV-…` reference); filters by resource, date and status; pagination; create and edit forms with live availability and the day's existing bookings; cancellation with confirmation (status change, not a delete) |
| Calendar | Day view with one column per resource (click an empty hour to book it) and a week view; previous, today and next navigation; date picker; resource filter; optional display of cancelled bookings |
| UX | Collapsible sidebar, mobile navigation drawer, breadcrumbs, toasts, loading skeletons, empty states, error boundary, status badges that combine an icon with text, keyboard-accessible controls with visible focus, responsive tables that become cards on mobile |

## Technology stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Language | TypeScript (strict) |
| Database | PostgreSQL 16 (Docker Compose) |
| ORM | Prisma 6 |
| UI | Tailwind CSS v4, shadcn/ui (Radix), Lucide icons, Sonner toasts |
| Forms and validation | React Hook Form, Zod 4 (one set of schemas shared by client and server) |
| Dates | date-fns and @date-fns/tz (organization timezone: `Asia/Colombo`) |
| Tests | Vitest (unit and integration tests on real PostgreSQL), Playwright (end-to-end, desktop and mobile) |

## Architecture

```
src/
  app/                      Routes (Server Components fetch data on the server)
    page.tsx                Dashboard
    resources/              List, new, [id], [id]/edit
    reservations/           List, new, [id], [id]/edit
    calendar/               Day and week schedule
    api/availability/       GET route handler used by the reservation form
  components/
    layout/                 App shell, sidebar, navigation
    resources/ reservations/ calendar/ shared/   Feature and shared UI
    ui/                     shadcn/ui primitives
  lib/
    db.ts                   Shared Prisma client (singleton, server-only)
    validations/            Zod schemas (resource, reservation, list queries)
    services/               Business logic: resources.ts, reservations.ts, dashboard.ts
    actions/                Server Actions: thin wrappers returning ActionResult<T>
    errors.ts               AppError, error codes, safe error mapping
    utils/                  Timezone helpers, interval logic, formatting, calendar layout
prisma/                     schema.prisma, migrations/, seed.ts
tests/                      unit/, integration/, e2e/, support/
```

Key decisions:

- **All business rules live in `src/lib/services`.** Pages, Server Actions and the API route call
  the same functions, so validation and conflict logic are never duplicated.
- **Server Actions return a typed `ActionResult<T>`** (`{ ok: true, data }` or
  `{ ok: false, error: { code, message, fieldErrors? } }`). Raw database errors and stack traces
  are logged on the server and never sent to the browser.
- **`server-only` guards `db.ts` and the services**, so Prisma can't be bundled into client code.
- **Every mutation calls `revalidatePath`**, so the dashboard, lists and calendar update afterwards.
- **No authentication.** The header shows a "Demo mode" badge. The requester's name and email are
  stored as entered and are not verified. No authorization guarantees are claimed.

## Database design

Two tables, `resources` and `reservations`, in a one-to-many relationship. See
[`docs/er-diagram.md`](docs/er-diagram.md) for the Mermaid ER diagram and the full list of
constraints, and [`docs/schema.dbml`](docs/schema.dbml) for a dbdiagram.io version.

```mermaid
erDiagram
    RESOURCES ||--o{ RESERVATIONS : "has"
    RESOURCES {
        uuid id PK
        varchar name UK
        ResourceType type
        varchar location
        int capacity
        boolean is_active
    }
    RESERVATIONS {
        uuid id PK
        int number UK
        uuid resource_id FK
        varchar requester_name
        varchar purpose
        timestamptz starts_at
        timestamptz ends_at
        ReservationStatus status
        timestamptz cancelled_at
    }
```

**ER diagram link:** _add your mermaid.live or dbdiagram.io link here (see [docs/er-diagram.md](docs/er-diagram.md#publishing-a-shareable-link))._

Highlights:

- UUID primary keys. Each reservation also gets a sequential `number`, displayed as `RSV-000042`.
- `reservations.resource_id` is a foreign key with **ON DELETE RESTRICT**: resources are deactivated, never deleted.
- CHECK constraints: `capacity > 0` and `ends_at > starts_at`.
- All timestamps are `timestamptz`, stored in UTC.
- Indexes support the common queries (by resource and start time, by status and start time, recent updates).

## Conflict prevention

**Rule:** reservations are half-open intervals `[startsAt, endsAt)`. Two reservations overlap when
`existing.startsAt < requested.endsAt AND existing.endsAt > requested.startsAt`. Only
**CONFIRMED** reservations on the **same resource** block each other.

Example, with an existing booking from 10:00 to 11:00:

| Request | Result |
|---|---|
| 09:00–10:00 | allowed (back-to-back) |
| 10:00–11:00 | rejected |
| 10:30–11:30 | rejected |
| 10:45–10:55 | rejected |
| 11:00–12:00 | allowed (back-to-back) |
| Same time, different resource | allowed |
| Same time after the 10:00 booking is cancelled | allowed |

**How it's enforced, from innermost to outermost:**

1. **Database (authoritative).** Migration
   `prisma/migrations/20261015144700_reservation_overlap_exclusion` enables `btree_gist` and adds:
   ```sql
   ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
     EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
     WHERE (status = 'CONFIRMED');
   ```
   PostgreSQL checks this inside the index. If two transactions race to insert overlapping rows,
   the second one waits and then fails with SQLSTATE `23P01`. A plain "check then insert"
   transaction can't do this: both requests would pass the check before either one inserts.
   Because of the partial `WHERE`, cancelled rows never block a slot.
2. **Service layer.** `createReservation` and `updateReservation` run in a transaction that:
   - locks the resource row `FOR SHARE`, so a concurrent deactivation can't slip in between the
     check and the insert;
   - rejects inactive or missing resources;
   - looks up conflicting bookings first, so the error message can name the clashing time slot;
   - excludes the reservation being edited from that lookup (`id <> excludeId`).

   If the constraint still fires (a true race), the `23P01` error is turned into the same friendly
   `CONFLICT` response.
3. **UI (informational).** The form calls `GET /api/availability` as you type and lists the
   resource's bookings for that day. The server always checks again on submit.

The integration suite tests this against real PostgreSQL. In particular, **10 simultaneous
bookings for the same slot result in exactly 1 success and 9 conflicts**
(`tests/integration/reservations.test.ts`).

Other rules: the end must be later than the start; dates must be real calendar dates; reservations
can't start in the past; cancelled or finished reservations can't be edited; cancelling twice is
rejected; **cross-midnight bookings are not supported**. A reservation is a single date with a
start and end time (latest end 23:59), and this is enforced in the Zod schema.

**Timezone:** every date and time that is entered or displayed is interpreted in
`NEXT_PUBLIC_APP_TIMEZONE` (default `Asia/Colombo`, UTC+05:30) and converted to a UTC instant
before it is compared or stored. Local time strings are never compared across days.

---

## Getting started

### Prerequisites

- **Node.js 20.9 or later** (developed on 20.11) and npm 10
- **Docker Desktop**, or your own PostgreSQL 13+ server where the `btree_gist` extension can be installed
  (it ships with PostgreSQL's standard contrib modules)

### 1. Install

```bash
git clone <your-repo-url> resource-reservation-system
cd resource-reservation-system
cp .env.example .env              # Windows PowerShell: Copy-Item .env.example .env
cp .env.test.example .env.test    # Windows PowerShell: Copy-Item .env.test.example .env.test
npm install                       # also runs `prisma generate`
```

### 2. Start PostgreSQL

```bash
npm run db:up        # docker compose up -d: PostgreSQL 16 on localhost:5433
```

On its first start, the container creates two databases: `reservations` (development) and
`reservations_test` (tests). Port **5433** is used so it doesn't clash with a local PostgreSQL on 5432.

*Using your own PostgreSQL instead?* Create both databases yourself, make sure the user can run
`CREATE EXTENSION btree_gist` (or install the extension beforehand), and update the `DATABASE_URL`
values in `.env` and `.env.test`.

### 3. Environment variables

| Variable | File | Purpose |
|---|---|---|
| `DATABASE_URL` | `.env` | Development database, e.g. `postgresql://rrs:rrs_dev_password@localhost:5433/reservations?schema=public` |
| `DATABASE_URL` | `.env.test` | Test database. **The name must end in `_test`**: test cleanup refuses to run otherwise. |
| `NEXT_PUBLIC_APP_TIMEZONE` | both | Organization timezone (default `Asia/Colombo`) |

`.env` and `.env.test` are git-ignored. Only the `*.example` files are committed, and they contain
the local Docker credentials only.

### 4. Migrate and seed

```bash
npm run db:deploy    # apply migrations (prisma migrate deploy)
npm run db:seed      # load demo data (prisma db seed)
```

During development, `npm run db:migrate` (`prisma migrate dev`) creates and applies new migrations.

The seed is **deterministic demonstration data**: 8 resources (1 inactive) and 25 reservations
(3 cancelled), placed relative to today so the dashboard always has current data. Demo resource
descriptions start with `[Demo]`, and requester emails use `@demo.example`. Re-running the seed
replaces only the demo records.

### 5. Run

```bash
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint (`eslint-config-next`, core-web-vitals and TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Unit tests (Vitest, no database needed) |
| `npm run test:integration` | Reset the **test** database, then run the integration tests against PostgreSQL |
| `npm run test:e2e` | Reset the **test** database, build the app, start it on port 3100 against the test database, then run Playwright (desktop and mobile) |
| `npm run test:all` | Unit, then integration, then end-to-end tests |
| `npm run check` | Lint, typecheck, unit tests and build |
| `npm run db:up` / `db:down` | Start or stop the PostgreSQL container |
| `npm run db:migrate` / `db:deploy` | `prisma migrate dev` / `prisma migrate deploy` |
| `npm run db:seed` | Load demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:test:reset` | Migrate and empty the test database (refuses to run unless the database name ends in `_test`) |

Before the first end-to-end run, install the browser: `npx playwright install chromium`.

## Testing

| Suite | Location | Covers |
|---|---|---|
| Unit (45 tests) | `tests/unit` | Interval validity; overlap rules (all the required cases); back-to-back bookings; different resources; cancelled bookings ignored; edits that don't conflict with themselves; resource and reservation Zod validation; timezone conversion; calendar lane layout |
| Integration (32 tests) | `tests/integration` | Resource create, update, duplicate names, deactivation, filters and pagination; reservation create; inactive resource rejection; unknown resource; past start times; the exclusion constraint when the service is bypassed; CHECK constraints; the foreign key; **10-way concurrent booking race**; deactivation racing a booking; cancellation releasing the slot; double cancellation; update conflicts; editing cancelled reservations; availability; list filters |
| End-to-end (13 tests) | `tests/e2e` | Dashboard; create a resource and find it; client-side validation; create a reservation; overlap rejected (entered values kept); different resource allowed; back-to-back allowed; edit without self-conflict; cancel and rebook; calendar and list reflect the changes; dashboard updates; deactivated resource can't be booked; mobile navigation without horizontal overflow |

Integration and end-to-end tests use **only** the `_test` database. Each reset runs
`prisma migrate deploy` followed by `TRUNCATE`; the development database is never touched.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Can't reach database server at localhost:5433` | Run `npm run db:up`, then check the container with `docker ps` (`rrs-postgres` should be *healthy*). |
| Port 5433 already in use | Change the host port in `docker-compose.yml` and in both `.env` files. |
| `database "reservations_test" does not exist` | The init script only runs on a fresh volume. Either run `docker exec rrs-postgres createdb -U rrs reservations_test`, or `docker compose down -v` (this deletes all data) and then `npm run db:up`. |
| `type "gist_uuid_ops" does not exist` / `btree_gist` errors | Your PostgreSQL user needs permission to `CREATE EXTENSION btree_gist`, or a superuser must install it once. |
| `Refusing to reset database …` | `.env.test` points at a database whose name doesn't end in `_test`. |
| Playwright: `Executable doesn't exist` | Run `npx playwright install chromium`. |
| Prisma client out of date after pulling | Run `npm run db:generate` and restart `npm run dev`. |
| A page shows "We couldn't load this page" | The database is unreachable. Start it and click *Try again*. |

## Known limitations

- **No authentication or authorization.** Anyone using the app can edit or cancel any reservation,
  and requester details are not verified. This is an intentional scope decision, not a security feature.
- **No cross-midnight or multi-day reservations**, and no recurring reservations.
- **Deactivating a resource doesn't cancel its existing future reservations.** The confirmation
  dialog shows how many there are, so they can be cancelled individually.
- **"Recent activity" is derived from timestamps** (`created_at`, `updated_at`, `cancelled_at`).
  It is not a full audit log, so earlier edits to the same reservation aren't kept.
- **Single organization timezone.** Users in other timezones see times in `Asia/Colombo`.
- When the database constraint catches a true race, Prisma logs the underlying `23P01` error on
  the server. This is expected; users only see the friendly conflict message.
- `npm audit` reports high-severity advisories in `braces`, a dependency of the ESLint tooling
  (`eslint-config-next`). It is development-only and npm currently offers no compatible fix.
  The runtime dependencies (Next.js 16.4.1 and others) are on patched versions.

## Project documents

- [`docs/er-diagram.md`](docs/er-diagram.md): ER diagram (Mermaid), constraints, publishing steps
- [`docs/schema.dbml`](docs/schema.dbml): dbdiagram.io definition
- [`docs/demo-script.md`](docs/demo-script.md): 3–5 minute demo video script
- [`docs/vertical-slices.md`](docs/vertical-slices.md): delivery plan (vertical slices)
