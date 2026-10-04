# Booking API

## Running

```bash
npm install
npm run dev      # ts-node-dev, auto-reload, http://localhost:4000
# or
npm run build && npm start
```

## Testing

```bash
npm test
```

`tests/booking.conflict.test.ts` is the important file. It covers, in order of importance:

1. **Concurrent conflicting requests** — fires 2 and then 10 truly parallel (`Promise.all`) `POST /bookings` requests at the same room/slot and asserts exactly one `201` and the rest `409`.
2. **Concurrent requests for different rooms don't block each other** — proves the locking is scoped per room, not a global lock.
3. Sequential overlap detection, including the back-to-back (non-conflict) case.
4. Validation rules (past bookings, inverted ranges, >4h duration, unknown room).
5. Deletion, including double-delete and "conflict clears after cancel".

## Concurrency strategy

### The problem

Booking creation is a classic **check-then-act** race:

1. Read existing bookings for room X.
2. Check whether the new range overlaps any of them.
3. If not, insert the new booking.

If two requests for the *same room* interleave between steps 1 and 3 — e.g. both read the (still-empty) existing bookings before either has inserted — both can pass the check and both get inserted, producing an actual double-booking. This is not a hypothetical: with a network round trip and a DB read/write, two users clicking "book" a few milliseconds apart is enough to trigger it.

### The solution: a per-room async mutex

`src/utils/keyedMutex.ts` implements `KeyedMutex`, which serializes async work by key. `createBooking()` runs its entire read-check-write sequence inside `roomBookingMutex.runExclusive(roomId, ...)`.

Effect:
- Two requests for **the same room** are forced to run their check-then-act sequence one after another, in arrival order. The second one always sees the first one's write, so the check is reliable.
- Two requests for **different rooms** run fully in parallel — there's no contention between them, since each room has its own queue.

This is functionally equivalent to:
- A Postgres advisory lock taken on `hash(roomId)` around the transaction, or
- Running the check + insert inside a `SERIALIZABLE` (or `REPEATABLE READ` with a retry loop) transaction scoped to that room.

The in-memory data layer (`src/data/bookingStore.ts`) adds a small artificial delay (`await delay(15ms)`) to every read/write, to emulate a real database round trip. Without this, two "concurrent" requests inside a single Node process would rarely actually interleave, and the race would be almost impossible to reproduce — the delay is what makes the concurrency tests meaningful and repeatable rather than flaky/lucky.

### Why not something else?

- **Optimistic locking (version column + retry on write conflict)** — works, but is unnecessary complexity for a single-process demo, and pushes retry logic into the client/caller. Would be the right call if writes were expected to be *rare* and *contention low*, so paying the cost of a retry only when it actually happens is cheaper than always taking a lock.
- **A single global lock (not per-room)** — simplest possible correct solution, but serializes bookings across *all* rooms, which is an unnecessary bottleneck once there are many rooms and would show up immediately under load.
- **Just relying on `Array.push` being "atomic enough" in JS** — this is the trap. `push` itself is atomic, but the *check* that happens before it is not; the race is between the read and the write, not inside either operation individually. This is what the test suite is specifically designed to catch.

### Production (multi-instance) equivalent

The mutex above only guarantees correctness within a **single Node process**. If this API is horizontally scaled (multiple instances behind a load balancer), an in-memory mutex in one process cannot prevent a conflicting write happening in another process at the same time.

For a real deployment, the recommended approach is to move the invariant into the database itself, where it can't be bypassed regardless of how many app instances are running:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id),
  during TSTZRANGE NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT NOT NULL,
  EXCLUDE USING gist (room_id WITH =, during WITH &&)
);
```

The `EXCLUDE` constraint makes overlapping ranges for the same `room_id` impossible to insert, full stop — the database rejects the second concurrent insert with a constraint violation (which the app then maps to a `409`), no application-level locking required. This is the approach I'd use if this went to production with more than one instance; the in-process mutex here is the right-sized solution for the scope of this task.

## What I'd do next with more time

- Swap the in-memory store for Postgres with the `EXCLUDE` constraint above, and map the resulting DB error to `409 BOOKING_CONFLICT`.
- Pagination for `GET /rooms/:id/bookings` on rooms with a lot of history.
- Idempotency key on `POST /bookings` so a client retry after a dropped response can't create a duplicate booking.
- Structured logging / request IDs for debugging conflicts in production.
- Auth + per-user booking limits (out of scope here per the brief).
- WebSocket/SSE push so other open tabs see a new booking without polling (mentioned as a bonus in the brief).
