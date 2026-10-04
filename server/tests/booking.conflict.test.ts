import request from 'supertest';
import { createApp } from '../src/app';
import { __resetForTests } from '../src/data/bookingStore';

const app = createApp();

function isoInFuture(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

const ROOM_ID = 'room-1';

beforeEach(() => {
  __resetForTests();
});

describe('POST /bookings - validation', () => {
  it('rejects end time before start time', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({
        roomId: ROOM_ID,
        title: 'Standup',
        createdBy: 'alice',
        startTime: isoInFuture(2),
        endTime: isoInFuture(1),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RANGE');
  });

  it('rejects a booking that starts in the past', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({
        roomId: ROOM_ID,
        title: 'Standup',
        createdBy: 'alice',
        startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        endTime: isoInFuture(1),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IN_THE_PAST');
  });

  it('rejects a booking longer than 4 hours', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({
        roomId: ROOM_ID,
        title: 'Marathon planning',
        createdBy: 'alice',
        startTime: isoInFuture(1),
        endTime: isoInFuture(1 + 4.5),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DURATION_TOO_LONG');
  });

  it('rejects an unknown room', async () => {
    const res = await request(app)
      .post('/bookings')
      .send({
        roomId: 'does-not-exist',
        title: 'Standup',
        createdBy: 'alice',
        startTime: isoInFuture(1),
        endTime: isoInFuture(2),
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });
});

describe('POST /bookings - overlap detection (sequential)', () => {
  it('rejects a booking that overlaps an existing one', async () => {
    await request(app)
      .post('/bookings')
      .send({
        roomId: ROOM_ID,
        title: 'First',
        createdBy: 'alice',
        startTime: isoInFuture(2),
        endTime: isoInFuture(3),
      })
      .expect(201);

    const res = await request(app)
      .post('/bookings')
      .send({
        roomId: ROOM_ID,
        title: 'Second - overlaps',
        createdBy: 'bob',
        startTime: isoInFuture(2.5),
        endTime: isoInFuture(3.5),
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CONFLICT');
  });

  it('allows a booking that starts exactly when another ends (back-to-back, not a conflict)', async () => {
    const start = isoInFuture(2);
    const middle = isoInFuture(3);
    const end = isoInFuture(4);

    await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'First', createdBy: 'alice', startTime: start, endTime: middle })
      .expect(201);

    const res = await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'Second - adjacent', createdBy: 'bob', startTime: middle, endTime: end });

    expect(res.status).toBe(201);
  });

  it('allows bookings in the same room on non-overlapping slots, and in different rooms on the same slot', async () => {
    await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'First', createdBy: 'alice', startTime: isoInFuture(1), endTime: isoInFuture(2) })
      .expect(201);

    await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'Later same room', createdBy: 'bob', startTime: isoInFuture(3), endTime: isoInFuture(4) })
      .expect(201);

    await request(app)
      .post('/bookings')
      .send({ roomId: 'room-2', title: 'Same slot, different room', createdBy: 'carol', startTime: isoInFuture(1), endTime: isoInFuture(2) })
      .expect(201);
  });
});

describe('POST /bookings - concurrent requests (the core requirement)', () => {
  it('allows only ONE of two truly concurrent overlapping requests for the same room to succeed', async () => {
    const payloadA = {
      roomId: ROOM_ID,
      title: 'Request A',
      createdBy: 'alice',
      startTime: isoInFuture(5),
      endTime: isoInFuture(6),
    };
    const payloadB = {
      roomId: ROOM_ID,
      title: 'Request B - overlaps A',
      createdBy: 'bob',
      startTime: isoInFuture(5.5),
      endTime: isoInFuture(6.5),
    };

    // Fire both requests in parallel, simulating two users clicking
    // "book" at (almost) the same instant.
    const [resA, resB] = await Promise.all([
      request(app).post('/bookings').send(payloadA),
      request(app).post('/bookings').send(payloadB),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('allows only ONE winner out of 10 concurrent requests for the exact same slot', async () => {
    const start = isoInFuture(7);
    const end = isoInFuture(8);

    const requests = Array.from({ length: 10 }, (_, i) =>
      request(app)
        .post('/bookings')
        .send({
          roomId: ROOM_ID,
          title: `Contender ${i}`,
          createdBy: `user-${i}`,
          startTime: start,
          endTime: end,
        }),
    );

    const results = await Promise.all(requests);
    const successCount = results.filter((r) => r.status === 201).length;
    const conflictCount = results.filter((r) => r.status === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(9);
  });

  it('does not block concurrent requests for DIFFERENT rooms (no false conflicts, no global lock)', async () => {
    const start = isoInFuture(9);
    const end = isoInFuture(10);

    const [resRoom1, resRoom2, resRoom3] = await Promise.all([
      request(app).post('/bookings').send({ roomId: 'room-1', title: 'A', createdBy: 'alice', startTime: start, endTime: end }),
      request(app).post('/bookings').send({ roomId: 'room-2', title: 'B', createdBy: 'bob', startTime: start, endTime: end }),
      request(app).post('/bookings').send({ roomId: 'room-3', title: 'C', createdBy: 'carol', startTime: start, endTime: end }),
    ]);

    expect(resRoom1.status).toBe(201);
    expect(resRoom2.status).toBe(201);
    expect(resRoom3.status).toBe(201);
  });
});

describe('DELETE /bookings/:id', () => {
  it('deletes an existing booking', async () => {
    const created = await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'To cancel', createdBy: 'alice', startTime: isoInFuture(1), endTime: isoInFuture(2) })
      .expect(201);

    await request(app).delete(`/bookings/${created.body.id}`).expect(204);
  });

  it('returns 404 when deleting a booking that does not exist', async () => {
    await request(app).delete('/bookings/does-not-exist').expect(404);
  });

  it('returns 404 on the second delete of the same booking (double delete)', async () => {
    const created = await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'To cancel twice', createdBy: 'alice', startTime: isoInFuture(1), endTime: isoInFuture(2) })
      .expect(201);

    await request(app).delete(`/bookings/${created.body.id}`).expect(204);
    await request(app).delete(`/bookings/${created.body.id}`).expect(404);
  });

  it('frees up the slot so a new booking can be made after cancellation', async () => {
    const start = isoInFuture(1);
    const end = isoInFuture(2);

    const created = await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'First', createdBy: 'alice', startTime: start, endTime: end })
      .expect(201);

    await request(app).delete(`/bookings/${created.body.id}`).expect(204);

    await request(app)
      .post('/bookings')
      .send({ roomId: ROOM_ID, title: 'Second, same slot', createdBy: 'bob', startTime: start, endTime: end })
      .expect(201);
  });
});
