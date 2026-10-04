import cors from 'cors';
import express, { Express } from 'express';
import { errorHandler } from './middleware/errorHandler';
import { roomsRouter } from './routes/rooms';
import { bookingsRouter } from './routes/bookings';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/rooms', roomsRouter);
  app.use('/bookings', bookingsRouter);

  app.use(errorHandler);

  return app;
}
