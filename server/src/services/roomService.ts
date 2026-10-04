import { rooms } from '../data/rooms';
import { AppError, Room } from '../types';

export function listRooms(): Room[] {
  return rooms;
}

export function getRoomOrThrow(roomId: string): Room {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) {
    throw new AppError(404, 'ROOM_NOT_FOUND', `Room ${roomId} does not exist`);
  }
  return room;
}
