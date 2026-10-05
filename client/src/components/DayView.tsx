import { Booking } from '../types';

interface Props {
  bookings: Booking[];
  isLoading: boolean;
  onDelete: (bookingId: string) => void;
  deletingId: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DayView({ bookings, isLoading, onDelete, deletingId }: Props) {
  if (isLoading) {
    return <p className="muted">Loading bookings…</p>;
  }

  if (bookings.length === 0) {
    return <p className="muted">No bookings for this room today.</p>;
  }

  const sorted = [...bookings].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  return (
    <ul className="booking-list">
      {sorted.map((booking) => (
        <li key={booking.id} className="booking-item">
          <div className="booking-time">
            {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
          </div>
          <div className="booking-info">
            <div className="booking-title">{booking.title}</div>
            <div className="booking-meta">by {booking.createdBy}</div>
          </div>
          <button
            className="delete-btn"
            onClick={() => onDelete(booking.id)}
            disabled={deletingId === booking.id}
          >
            {deletingId === booking.id ? '…' : 'Cancel'}
          </button>
        </li>
      ))}
    </ul>
  );
}
