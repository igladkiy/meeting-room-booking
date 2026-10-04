import { AppError } from '../types';

export const MAX_BOOKING_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface ParsedRange {
  start: Date;
  end: Date;
}

/**
 * Parses and validates a start/end time pair against all business rules.
 * Throws AppError(400, ...) with a specific code/message on failure.
 */
export function parseAndValidateRange(
  startTimeRaw: unknown,
  endTimeRaw: unknown,
  now: Date = new Date(),
): ParsedRange {
  if (typeof startTimeRaw !== 'string' || typeof endTimeRaw !== 'string') {
    throw new AppError(400, 'INVALID_INPUT', 'startTime and endTime must be ISO date strings');
  }

  const start = new Date(startTimeRaw);
  const end = new Date(endTimeRaw);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError(400, 'INVALID_INPUT', 'startTime/endTime must be valid ISO date strings');
  }

  if (start.getTime() >= end.getTime()) {
    throw new AppError(400, 'INVALID_RANGE', 'startTime must be strictly before endTime');
  }

  if (start.getTime() < now.getTime()) {
    throw new AppError(400, 'IN_THE_PAST', 'Cannot create a booking that starts in the past');
  }

  const durationMs = end.getTime() - start.getTime();
  if (durationMs > MAX_BOOKING_DURATION_MS) {
    throw new AppError(400, 'DURATION_TOO_LONG', 'Booking duration cannot exceed 4 hours');
  }

  return { start, end };
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(400, 'INVALID_INPUT', `${field} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Two ranges [aStart, aEnd) and [bStart, bEnd) overlap iff:
 *   aStart < bEnd AND bStart < aEnd
 * This is intentionally strict (<, not <=) so that back-to-back bookings
 * (one ending exactly when another starts) are NOT treated as a conflict.
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
