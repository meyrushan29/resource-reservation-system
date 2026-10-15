-- Authoritative double-booking protection.
--
-- Two CONFIRMED reservations for the same resource may not have overlapping
-- half-open time ranges [starts_at, ends_at). Back-to-back bookings (one ends
-- exactly when the next starts) do not overlap. CANCELLED reservations are
-- excluded by the partial WHERE clause, so cancelling releases the slot.
--
-- btree_gist provides GiST operator classes for scalar types (uuid "=" here),
-- which lets the equality and range-overlap conditions share one GiST index.
-- Because PostgreSQL enforces this inside the index, concurrent transactions
-- cannot both insert overlapping rows: the second waits and then fails with
-- SQLSTATE 23P01 (exclusion_violation), which the app maps to a conflict.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
