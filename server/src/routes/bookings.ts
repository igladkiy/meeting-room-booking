import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { cancelBooking, createBooking } from '../services/bookingService';

export const bookingsRouter = Router();

bookingsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const booking = await createBooking(req.body);
    res.status(201).json(booking);
  }),
);

bookingsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await cancelBooking(req.params.id);
    res.status(204).send();
  }),
);
