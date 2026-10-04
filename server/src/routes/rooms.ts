import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { listRooms } from '../services/roomService';
import { getBookingsForRoom } from '../services/bookingService';

export const roomsRouter = Router();

roomsRouter.get('/', (_req, res) => {
  res.json(listRooms());
});

roomsRouter.get(
  '/:id/bookings',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { from, to } = req.query;
    const bookings = await getBookingsForRoom(
      id,
      typeof from === 'string' ? from : undefined,
      typeof to === 'string' ? to : undefined,
    );
    res.json(bookings);
  }),
);
