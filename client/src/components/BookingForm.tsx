import { FormEvent, useState } from 'react';
import { ApiError } from '../types';

interface Props {
  roomId: string;
  onSubmit: (input: { title: string; createdBy: string; startTime: string; endTime: string }) => Promise<void>;
}

const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function BookingForm({ roomId, onSubmit }: Props) {
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000); // +1h, to comfortably avoid "in the past"
  const defaultEnd = new Date(defaultStart.getTime() + 30 * 60 * 1000); // +30m

  const [title, setTitle] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [startTime, setStartTime] = useState(toLocalDatetimeInputValue(defaultStart));
  const [endTime, setEndTime] = useState(toLocalDatetimeInputValue(defaultEnd));
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function validateClientSide(): string | null {
    if (!title.trim()) return 'Title is required.';
    if (!createdBy.trim()) return 'Your name is required.';

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Please provide valid start and end times.';
    }
    if (start.getTime() >= end.getTime()) {
      return 'Start time must be before end time.';
    }
    if (start.getTime() < Date.now()) {
      return 'Start time cannot be in the past.';
    }
    if (end.getTime() - start.getTime() > MAX_DURATION_MS) {
      return 'Booking cannot be longer than 4 hours.';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    const validationError = validateClientSide();
    setClientError(validationError);
    if (validationError) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        createdBy: createdBy.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setSuccessMessage('Booking created.');
      setTitle('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BOOKING_CONFLICT') {
        // The form passed client-side validation, but by the time the
        // request reached the server, someone else had already booked an
        // overlapping slot (classic race condition between two users).
        // We surface this distinctly from a plain validation error, and
        // nudge the user to look at the (now-refreshed) list rather than
        // just showing a generic failure.
        setServerError(
          `This slot was just booked by someone else: ${err.message}. The schedule below has been refreshed — please pick another time.`,
        );
      } else if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <h3>New booking</h3>

      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sprint planning" />
      </label>

      <label>
        Your name
        <input value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="Alice" />
      </label>

      <div className="time-row">
        <label>
          Start
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          End
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>

      {clientError && <p className="error-text">{clientError}</p>}
      {serverError && <p className="error-text conflict">{serverError}</p>}
      {successMessage && <p className="success-text">{successMessage}</p>}

      <button type="submit" disabled={isSubmitting || !roomId}>
        {isSubmitting ? 'Booking…' : 'Book room'}
      </button>
    </form>
  );
}
