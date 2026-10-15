# Vertical Slices — Resource Reservation Management System

Each slice is a thin, end-to-end increment: **schema → validation → service → UI → tests**.
A slice is done only when it runs locally, its tests pass, lint/typecheck are clean, and it is committed.
Slices are ordered by the assessment's priorities (P1 core → P2 UX → P3 polish/submission).

## Workspace findings (2026-10-15)

- Workspace is empty — new Next.js project required.
- Node 20.11.0, npm 10.9.0.
- No local PostgreSQL install or `psql` on PATH; **Docker is available** → run PostgreSQL 16 via `docker compose`.

## Cross-cutting decisions (fixed before Slice 0)

| Topic | Decision |
|---|---|
| Identity | No authentication. Reservations store a `requesterName` + optional `requesterEmail`. Documented as a demo identity — no authorization claims. |
| Statuses | `CONFIRMED`, `CANCELLED` (Postgres enum). No `PENDING` — there is no approval flow. |
| Time | Stored as `timestamptz` (UTC). All input/display in `Asia/Colombo` via one `src/lib/utils/time.ts` module (date-fns-tz). |
| Interval semantics | Half-open `[startsAt, endsAt)`. |
| Cross-midnight | Not supported: a reservation must start and end on the same local day. Validated in Zod and documented. |
| Conflict guarantee | Postgres `EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'CONFIRMED')` with `btree_gist`. App-level pre-check only for friendlier messages. |
| Deletion policy | Resources are never hard-deleted (deactivate instead). Reservations are cancelled, never deleted. FK `onDelete: Restrict`. |
| Mutations | Server Actions returning `ActionResult<T> = { ok: true, data } \| { ok: false, error: { code, message, fieldErrors? } }`. One Route Handler for availability lookups (`GET /api/availability`). |
| Test DB | Separate `reservations_test` database (`DATABASE_URL` from `.env.test`); destructive cleanup refuses to run unless the DB name ends in `_test`. |

---

## Priority 1 — Core

### Slice 0 — Walking skeleton
**Goal:** an empty but fully wired app that every later slice plugs into.
- Next.js (App Router, TS strict, Tailwind, ESLint), shadcn/ui init, Lucide, Sonner.
- `docker-compose.yml` with Postgres 16; init script creating dev + test databases.
- Prisma installed, `src/lib/db.ts` singleton, `.env.example`, `.gitignore`.
- App shell: collapsible sidebar (Dashboard, Reservations, Calendar, Resources), mobile sheet nav, top bar, breadcrumbs, `Toaster`. Pages render a simple heading (filled in by later slices — no dead links remain at the end).
- Vitest + Playwright configured; scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `db:migrate`, `db:seed`, `db:reset:test`.
- `git init`, first commit.

**Done when:** `docker compose up -d && npm run db:migrate && npm run dev` shows the shell; one smoke unit test and one smoke e2e test pass.

### Slice 1 — Create and list resources
- `Resource` model + migration (`type` as enum: MEETING_ROOM, CONFERENCE_ROOM, TRAINING_ROOM, EQUIPMENT, WORKSPACE, OTHER).
- `src/lib/validations/resource.ts` (name ≤ 100, description ≤ 500, location ≤ 100, capacity positive int or empty).
- `src/lib/services/resources.ts`: `createResource`, `listResources`.
- `/resources` table (name, type, location, capacity, status badge with icon + text); `/resources/new` form (RHF + Zod, field errors, disabled while saving, toast, redirect).
- **Tests:** unit — resource schema valid/invalid; integration — create persists; e2e — create resource → appears in list.

### Slice 2 — View, edit, activate/deactivate resource
- Services: `getResource`, `updateResource`, `setResourceActive`.
- `/resources/[id]` (details + its upcoming reservations placeholder list), `/resources/[id]/edit`, `not-found.tsx`.
- Deactivate/reactivate with confirmation dialog; inactive badge explains "not bookable".
- **Tests:** integration — update + toggle; e2e — edit name, deactivate shows inactive badge.

### Slice 3 — Create and view a reservation (happy path)
- `Reservation` model + migration: FK to Resource, `requesterName`, `requesterEmail?`, `purpose`, `startsAt`, `endsAt`, `status` enum, timestamps; `CHECK (ends_at > starts_at)`; indexes on `(resource_id, starts_at)` and `(status, starts_at)`.
- `src/lib/utils/time.ts`: local date + `HH:mm` → UTC `Date` in Asia/Colombo, formatting helpers.
- `src/lib/validations/reservation.ts`: required fields, valid date/time, end > start, same local day.
- Service `createReservation`: resource must exist and be active (read with `FOR SHARE` inside the transaction so a concurrent deactivation cannot slip through).
- `/reservations/new` (active resources only in the selector; supports `?resourceId=&date=` prefill), `/reservations/[id]` detail, minimal `/reservations` list.
- **Tests:** unit — time-range validation, timezone conversion; integration — create, inactive resource rejected, FK rejects unknown resource.

### Slice 4 — Conflict prevention (critical rule)
- SQL migration: `CREATE EXTENSION btree_gist` + partial exclusion constraint (see decisions table).
- Pure `rangesOverlap(a, b)` helper; service pre-check query (`existing.startsAt < req.endsAt AND existing.endsAt > req.startsAt AND status = CONFIRMED AND id <> excludeId`).
- Map Postgres `23P01` (exclusion violation) and `23514` (check violation) to `ConflictError` / `ValidationError` → friendly `ActionResult` error naming the clashing slot. Never surface raw DB errors.
- Form shows the conflict inline and keeps entered values.
- **Tests:**
  - unit — all required cases vs. 10:00–11:00 (09–10 ok, 10–11 reject, 10:30–11:30 reject, 10:45–10:55 reject, 11–12 ok, other resource ok, cancelled ok).
  - integration — DB constraint rejects overlap even when the service pre-check is bypassed; **concurrency**: 10 parallel identical bookings → exactly 1 succeeds, 9 get `ConflictError`.
  - e2e — overlapping booking rejected with message; back-to-back booking succeeds.

### Slice 5 — Cancel reservation
- Service `cancelReservation` (idempotent; already-cancelled → clear error).
- Cancel button + confirmation dialog on detail and list rows; toast; cancelled badge.
- **Tests:** integration — cancelled slot can be rebooked; e2e — cancel → rebook same slot succeeds.

### Slice 6 — Edit reservation
- Service `updateReservation`: rejects cancelled/missing, re-validates, conflict check with `excludeId`, relies on the same constraint.
- `/reservations/[id]/edit` prefilled from the DB in local time.
- **Tests:** unit — self-overlap excluded; integration — shifting within own slot ok, moving onto another booking rejected, editing cancelled rejected; e2e — edit time.

---

## Priority 2 — Usability

### Slice 7 — Live availability feedback in the reservation form
- `GET /api/availability?resourceId&start&end&excludeId` → `{ available, conflicts[] }` using the same service function.
- Debounced check in the form: "Available" / "Conflicts with 10:00–11:00 (Team sync)" / "Resource inactive". Clearly informational; server re-checks on submit.
- Show the resource's bookings for the chosen day beneath the time inputs.
- **Tests:** integration — endpoint responses; e2e — choosing a booked slot shows the warning before submit.

### Slice 8 — Reservation list: search, filters, pagination
- URL-driven filters: text search (purpose/requester/resource), resource, date, status; tabs Upcoming / Past / Cancelled / All; sort by start; page size 20.
- Responsive: table on desktop, card list on mobile; empty state with "Clear filters".
- **Tests:** integration — service filter combinations; e2e — filter by status.

### Slice 9 — Resource list: search, filters, sort, pagination
- Same URL-param pattern: name search, type filter, active filter, clear, sort, pagination, mobile cards.
- **Tests:** e2e — search finds resource; filter inactive.

### Slice 10 — Dashboard
- Server Component with DB-derived stats: total resources, active resources, today's reservations, upcoming, cancelled.
- Upcoming reservations table with actions; resource availability now ("Available", "In use until 11:00", "Next booking 14:00", "Inactive"); recent reservations ordered by `updatedAt` (labelled "Recent activity", no fabricated audit log); quick actions.
- `loading.tsx`, `error.tsx`, empty states; `revalidatePath` from every mutation.
- **Tests:** e2e — creating a reservation increments "Upcoming".

### Slice 11 — Calendar
- `/calendar` day view (resources × hours grid, 07:00–21:00 local) and week view (days × reservation list per resource filter).
- Prev / Today / Next, date picker, resource filter; blocks show resource, time, status; click → detail popover/link; click empty slot → `/reservations/new` prefilled.
- Cancelled shown muted (toggle), empty-period state.
- **Tests:** e2e — reservation appears in the right slot; cancelled one no longer blocks.

### Slice 12 — Hardening, a11y, responsive pass
- Global/segment error boundaries, DB-unreachable messaging, consistent error codes.
- Keyboard nav, focus states, labelled inputs, `aria-live` for availability and form errors, status never color-only.
- Playwright mobile viewport project; double-submit protection (disabled buttons + server constraint).

---

## Priority 3 — Submission

### Slice 13 — Seed data
- Deterministic `prisma/seed.ts` ("[Demo]" labelled): ~8 resources (1 inactive), ~25 non-overlapping reservations spread across past/today/upcoming, some cancelled. Seed relies on the constraint, so overlaps would fail loudly.

### Slice 14 — Documentation & GitHub readiness
- `README.md` (all sections required by the brief, commands matching `package.json`), `docs/er-diagram.md` (Mermaid) + `docs/schema.dbml` (dbdiagram.io) with publishing steps, `docs/demo-script.md` (3–5 min).
- Full check run: install → generate → migrate → seed → unit → integration → e2e → lint → typecheck → build. Report real results.
- **Manual steps left for the candidate:** push to GitHub, publish ER diagram and paste the real link, record the demo video.

---

## Slice dependency map

```
S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7
                 │         └──────────┴→ S8, S10, S11
                 └→ S9
S1…S11 → S12 → S13 → S14
```

Commit at the end of each slice, e.g. `feat(reservations): prevent overlapping bookings with exclusion constraint (S4)`.
