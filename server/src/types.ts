export interface Room {
  id: string;
  name: string;
  capacity: number;
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  startTime: string; // ISO string, stored as UTC
  endTime: string; // ISO string, stored as UTC
  createdBy: string;
  createdAt: string;
}

export interface CreateBookingInput {
  roomId: string;
  title: string;
  startTime: string;
  endTime: string;
  createdBy: string;
}

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
