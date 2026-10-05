import { Room } from '../types';

interface Props {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelect: (roomId: string) => void;
}

export function RoomList({ rooms, selectedRoomId, onSelect }: Props) {
  return (
    <div className="room-list">
      <h2>Rooms</h2>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              className={room.id === selectedRoomId ? 'room-item selected' : 'room-item'}
              onClick={() => onSelect(room.id)}
            >
              <span className="room-name">{room.name}</span>
              <span className="room-capacity">{room.capacity} seats</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
