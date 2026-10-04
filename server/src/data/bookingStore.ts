import { Booking } from '../types';

/**
 * Plain in-memory array acting as our "table".
 */
let bookings: Booking[] = [];

export async function findByRoom(roomId: string): Promise<Booking[]> {
  return bookings.filter((b) => b.roomId === roomId);
}

export async function findByRoomInRange(roomId: string, from?: Date, to?: Date): Promise<Booking[]> {
  return bookings.filter((b) => {
    if (b.roomId !== roomId) return false;
    if (from && new Date(b.endTime).getTime() <= from.getTime()) return false;
    if (to && new Date(b.startTime).getTime() >= to.getTime()) return false;
    return true;
  });
}

export async function insert(booking: Booking): Promise<Booking> {
  bookings.push(booking);
  return booking;
}

export async function findById(id: string): Promise<Booking | undefined> {
  return bookings.find((b) => b.id === id);
}

export async function remove(id: string): Promise<boolean> {
  const before = bookings.length;
  bookings = bookings.filter((b) => b.id !== id);
  return bookings.length < before;
}

/** Test-only helper to reset state between test cases. */
export function __resetForTests(): void {
  bookings = [];
}
