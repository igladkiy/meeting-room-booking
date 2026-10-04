import { v4 as uuidv4 } from 'uuid';
import { AppError, Booking, CreateBookingInput } from '../types';
import { getRoomOrThrow } from './roomService';
import * as bookingStore from '../data/bookingStore';
import { parseAndValidateRange, rangesOverlap, requireNonEmptyString } from '../utils/validators';

export async function getBookingsForRoom(
  roomId: string,
  from?: string,
  to?: string,
): Promise<Booking[]> {
  getRoomOrThrow(roomId);

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  if (from && fromDate && Number.isNaN(fromDate.getTime())) {
    throw new AppError(400, 'INVALID_INPUT', '`from` must be a valid ISO date string');
  }
  if (to && toDate && Number.isNaN(toDate.getTime())) {
    throw new AppError(400, 'INVALID_INPUT', '`to` must be a valid ISO date string');
  }

  return bookingStore.findByRoomInRange(roomId, fromDate, toDate);
}

/**
 * Creates a booking after validating input and checking for conflicts.
 */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const roomId = requireNonEmptyString(input.roomId, 'roomId');
  const title = requireNonEmptyString(input.title, 'title');
  const createdBy = requireNonEmptyString(input.createdBy, 'createdBy');

  getRoomOrThrow(roomId);
  const { start, end } = parseAndValidateRange(input.startTime, input.endTime);

  const existing = await bookingStore.findByRoom(roomId);

  const conflict = existing.find((b) =>
    rangesOverlap(start, end, new Date(b.startTime), new Date(b.endTime)),
  );

  if (conflict) {
    throw new AppError(
      409,
      'BOOKING_CONFLICT',
      `Room is already booked from ${conflict.startTime} to ${conflict.endTime}`,
    );
  }

  const booking: Booking = {
    id: uuidv4(),
    roomId,
    title,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    createdBy,
    createdAt: new Date().toISOString(),
  };

  return bookingStore.insert(booking);
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const existing = await bookingStore.findById(bookingId);
  if (!existing) {
    throw new AppError(404, 'BOOKING_NOT_FOUND', `Booking ${bookingId} does not exist or was already cancelled`);
  }

  await bookingStore.remove(bookingId);
}
