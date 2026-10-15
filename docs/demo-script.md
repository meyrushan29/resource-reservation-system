# Demo Video Script (≈ 4½ minutes)

**Before recording**
- `npm run db:up && npm run db:deploy && npm run db:seed`, then `npm run dev` (or `npm run build && npm start`).
- Use a desktop browser at about 1440 px wide. Keep `docs/er-diagram.md` and
  `prisma/migrations/*_reservation_overlap_exclusion/migration.sql` open in the editor.
- In the steps below, **D** is a date about a week ahead.

| Time | Show | Say |
|---|---|---|
| 0:00–0:30 | Dashboard | "Teams book shared rooms and equipment through messages and spreadsheets, which leads to double-bookings and nobody knowing what's free. ResourceDesk keeps every resource and reservation in one PostgreSQL database and rejects conflicting bookings." |
| 0:30–1:10 | Dashboard stat cards → Resource availability → Recent activity → **Resources** list (search "room", filter Type, Status = Inactive) | "All figures come from the database. Availability is calculated for right now and shows the next booking, so a room free now but booked at 2 PM isn't shown as free all day. Inactive resources stay in the list with their history." |
| 1:10–2:00 | **Add resource**: submit an empty form to show the validation messages, then create "Demo Room X" (capacity 6) → detail page → **Edit** the location → open Projector 02 (retired) to show the inactive banner | "Validation runs in the browser for quick feedback and again on the server. Deactivating a resource blocks new bookings but keeps its records." |
| 2:00–3:10 | **Book** Demo Room X on D, 10:00–11:00 → toast and detail page. **New reservation**, same room, 10:30–11:30 → the availability panel warns about the conflict → submit anyway → the server rejects it with "Time slot unavailable" and keeps the entered values. Change to 11:00–12:00 → available → confirm. Book a *different* room at 10:00–11:00 → succeeds | "The rule uses half-open intervals: 11:00 to 12:00 doesn't overlap a booking that ends at 11:00, and other resources aren't affected." |
| 3:10–3:45 | Open the 10:00 reservation → **Edit**, move it to 09:30–10:30 (it doesn't conflict with itself) → **Cancel reservation** → confirm → book 09:30–10:30 again → **Calendar** for D: day view, then tick *Show cancelled*, then the week view | "Cancelling keeps the record and frees the slot immediately. In the calendar, clicking an empty slot starts a booking for it." |
| 3:45–4:30 | Editor: the exclusion-constraint migration → `src/lib/services/reservations.ts` (`createReservation`) → `docs/er-diagram.md` → terminal: `npm run test:integration`, pointing at the concurrency test | "The application checks for conflicts first so it can show a friendly message, but PostgreSQL is the final authority: an exclusion constraint on the resource and its time range, which only applies to confirmed bookings. If two requests race, the database rejects the second, and the app turns that into the same conflict message. The integration test fires ten simultaneous bookings for one slot: exactly one succeeds." |
| 4:30–5:00 | Dashboard (counts updated) | "In summary: resource and reservation management, server-side validation, conflict prevention enforced by the database, a dashboard and calendar, and unit, integration and end-to-end tests, built with Next.js, TypeScript, Prisma and PostgreSQL." |

**Don't claim** that there is authentication: the "Demo mode" badge in the header is accurate.
