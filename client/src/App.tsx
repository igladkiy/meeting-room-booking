import { useCallback, useEffect, useState } from 'react';
import { RoomList } from './components/RoomList';
import { DayView } from './components/DayView';
import { BookingForm } from './components/BookingForm';
import * as api from './api';
import { Booking, Room } from './types';

export default function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .fetchRooms()
      .then((data) => {
        setRooms(data);
        if (data.length > 0) setSelectedRoomId(data[0].id);
      })
      .catch(() => setLoadError('Could not load rooms. Is the API running?'))
      .finally(() => setIsLoadingRooms(false));
  }, []);

  const loadBookings = useCallback(async (roomId: string) => {
    setIsLoadingBookings(true);
    setLoadError(null);
    try {
      const data = await api.fetchBookingsForRoom(roomId);
      setBookings(data);
    } catch {
      setLoadError('Could not load bookings for this room.');
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      loadBookings(selectedRoomId);
    }
  }, [selectedRoomId, loadBookings]);

  async function handleCreateBooking(input: {
    title: string;
    createdBy: string;
    startTime: string;
    endTime: string;
  }) {
    if (!selectedRoomId) return;

    await api.createBooking({ roomId: selectedRoomId, ...input });
    await loadBookings(selectedRoomId);
  }

  async function handleDeleteBooking(bookingId: string) {
    if (!selectedRoomId) return;
    setDeletingId(bookingId);
    try {
      await api.deleteBooking(bookingId);
      await loadBookings(selectedRoomId);
    } catch {
      setLoadError('Could not cancel that booking. It may have already been removed.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Meeting Room Booking</h1>
      </header>

      {loadError && <p className="error-text global-error">{loadError}</p>}

      <div className="layout">
        <aside>
          {isLoadingRooms ? <p className="muted">Loading rooms…</p> : (
            <RoomList rooms={rooms} selectedRoomId={selectedRoomId} onSelect={setSelectedRoomId} />
          )}
        </aside>

        <main>
          {selectedRoomId ? (
            <>
              <section>
                <h2>Today's schedule</h2>
                <DayView
                  bookings={bookings}
                  isLoading={isLoadingBookings}
                  onDelete={handleDeleteBooking}
                  deletingId={deletingId}
                />
              </section>

              <section>
                <BookingForm roomId={selectedRoomId} onSubmit={handleCreateBooking} />
              </section>
            </>
          ) : (
            !isLoadingRooms && <p className="muted">Select a room to see its schedule.</p>
          )}
        </main>
      </div>
    </div>
  );
}
