/**
 * KeyedMutex serializes async operations that share the same key.
 *
 * Why this exists:
 * The booking-conflict check has a classic "check-then-act" race:
 *   1. Read existing bookings for room X
 *   2. Check for overlap
 *   3. Write the new booking
 * If two requests for the SAME room interleave between steps 1-3, both can
 * pass the overlap check before either writes, producing a double booking.
 *
 * KeyedMutex forces every "check + write" sequence for a given roomId to run
 * one at a time, in the order requests arrive, while requests for DIFFERENT
 * rooms are completely unaffected (no contention across rooms).
 *
 * This is the in-process equivalent of a Postgres advisory lock scoped to
 * roomId, or of running the check+insert inside a SERIALIZABLE transaction.
 * See README "Concurrency strategy" section for why this approach was chosen
 * over alternatives, and what the production (multi-instance) equivalent is.
 */
export class KeyedMutex {
  private queues: Map<string, Promise<unknown>> = new Map();

  /**
   * Runs `task` exclusively with respect to any other task currently
   * queued/running under the same `key`. Returns the task's result.
   */
  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();

    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Chain: whoever is "current" must wait for "previous" to finish.
    const chained = previous.then(() => current);
    this.queues.set(key, chained);

    // Wait our turn.
    await previous.catch(() => {
      /* ignore errors from earlier tasks; they must not block this one */
    });

    try {
      return await task();
    } finally {
      release!();
      // Cleanup: if nobody queued after us, drop the key so the map
      // doesn't grow unboundedly over the lifetime of the process.
      if (this.queues.get(key) === chained) {
        this.queues.delete(key);
      }
    }
  }
}

export const roomBookingMutex = new KeyedMutex();
