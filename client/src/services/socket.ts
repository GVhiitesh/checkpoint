import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[WebSocket Connected]', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[WebSocket Error]', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function watchEvent(
  eventId: string,
  onAck?: (res: { ok: boolean; error?: string }) => void
): void {
  if (!socket || !socket.connected) return;
  socket.emit('watch', eventId, onAck);
}

export function unwatchEvent(eventId: string): void {
  if (!socket) return;
  socket.emit('unwatch', eventId);
}
