import { Booking } from '../types';

/**
 * Plain in-memory array acting as our "table". A small artificial delay is
 * inserted in findByRoom() to emulate a real DB round-trip. Without this
 * delay, two "concurrent" requests in a single Node process would rarely
 * actually interleave, making the race condition nearly impossible to
 * reproduce in tests. With the delay, the race is reproducible on demand,
 * which is what lets us actually prove the locking mechanism works.
 */
let bookings: Booking[] = [];

const SIMULATED_IO_DELAY_MS = 15;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function findByRoom(roomId: string): Promise<Booking[]> {
  await delay(SIMULATED_IO_DELAY_MS);
  return bookings.filter((b) => b.roomId === roomId);
}

export async function findByRoomInRange(roomId: string, from?: Date, to?: Date): Promise<Booking[]> {
  await delay(SIMULATED_IO_DELAY_MS);
  return bookings.filter((b) => {
    if (b.roomId !== roomId) return false;
    if (from && new Date(b.endTime).getTime() <= from.getTime()) return false;
    if (to && new Date(b.startTime).getTime() >= to.getTime()) return false;
    return true;
  });
}

export async function insert(booking: Booking): Promise<Booking> {
  await delay(SIMULATED_IO_DELAY_MS);
  bookings.push(booking);
  return booking;
}

export async function findById(id: string): Promise<Booking | undefined> {
  await delay(SIMULATED_IO_DELAY_MS);
  return bookings.find((b) => b.id === id);
}

export async function remove(id: string): Promise<boolean> {
  await delay(SIMULATED_IO_DELAY_MS);
  const before = bookings.length;
  bookings = bookings.filter((b) => b.id !== id);
  return bookings.length < before;
}

/** Test-only helper to reset state between test cases. */
export function __resetForTests(): void {
  bookings = [];
}
