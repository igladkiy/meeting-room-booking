import { ApiError, ApiErrorBody, Booking, Room } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const errBody = body as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      errBody?.error?.code ?? 'UNKNOWN_ERROR',
      errBody?.error?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return body as T;
}

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(`${API_BASE}/rooms`);
  return handleResponse<Room[]>(res);
}

export async function fetchBookingsForRoom(roomId: string, from?: string, to?: string): Promise<Booking[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();

  const res = await fetch(`${API_BASE}/rooms/${roomId}/bookings${query ? `?${query}` : ''}`);
  return handleResponse<Booking[]>(res);
}

export interface CreateBookingPayload {
  roomId: string;
  title: string;
  startTime: string;
  endTime: string;
  createdBy: string;
}

export async function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  const res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Booking>(res);
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bookings/${bookingId}`, { method: 'DELETE' });
  return handleResponse<void>(res);
}
