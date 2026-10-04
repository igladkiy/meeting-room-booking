import { Router } from 'express';
import { listRooms } from '../services/roomService';

export const roomsRouter = Router();

roomsRouter.get('/', (_req, res) => {
  res.json(listRooms());
});
