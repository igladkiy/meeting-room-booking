# Meeting Room Booking

A small full-stack app for booking meeting rooms, built with a Node.js/Express/TypeScript API and a React/Vite frontend. The focus of this project is correct handling of booking conflicts under concurrent requests, not UI polish.

## Structure

```
booking-app/
  server/   Node.js + Express + TypeScript API
  client/   React + Vite + TypeScript frontend
```

## Quick start

### 1. Backend

```bash
cd server
npm install
npm run dev        # http://localhost:4000
```

Or run the compiled version:

```bash
npm run build
npm start
```

### 2. Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev         # http://localhost:5173
```

The frontend expects the API at `http://localhost:4000` by default. To point it elsewhere, create `client/.env` with:

```
VITE_API_BASE=http://localhost:4000
```

### 3. Run the tests

```bash
cd server
npm test
```

This includes tests that fire multiple truly concurrent (`Promise.all`) requests at the same room/time-slot and assert that exactly one succeeds — this is the core thing being demonstrated. See `server/README.md` for details.

## API

| Method | Path                        | Description                      |
|--------|-----------------------------|-----------------------------------|
| GET    | `/rooms`                    | List all rooms                    |
| GET    | `/rooms/:id/bookings`       | Bookings for a room (`?from=&to=` optional ISO bounds) |
| POST   | `/bookings`                 | Create a booking                  |
| DELETE | `/bookings/:id`              | Cancel a booking                  |

`POST /bookings` body:

```json
{
  "roomId": "room-1",
  "title": "Sprint planning",
  "startTime": "2026-10-01T09:00:00.000Z",
  "endTime": "2026-10-01T10:00:00.000Z",
  "createdBy": "alice"
}
```

Responses:
- `201` — booking created, returns the booking.
- `400` — validation error (`INVALID_INPUT`, `INVALID_RANGE`, `IN_THE_PAST`, `DURATION_TOO_LONG`).
- `404` — room or booking not found (`ROOM_NOT_FOUND`, `BOOKING_NOT_FOUND`).
- `409` — overlaps an existing booking (`BOOKING_CONFLICT`).

See `server/README.md` for the concurrency design in depth.
