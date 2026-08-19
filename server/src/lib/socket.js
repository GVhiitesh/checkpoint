import { Server } from 'socket.io';
import { verifyJwt } from './auth.js';
import { query } from './db.js';
import { config } from './config.js';

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin === '*' ? true : config.clientOrigin.split(','), credentials: false },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthenticated'));
      socket.user = verifyJwt(token);
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('watch', async (eventId, ack) => {
      try {
        if (socket.user.role !== 'organizer') return ack?.({ ok: false, error: 'forbidden' });
        const { rows } = await query('SELECT organizer_id FROM events WHERE id = $1', [eventId]);
        if (rows.length === 0) return ack?.({ ok: false, error: 'event_not_found' });
        if (rows[0].organizer_id !== socket.user.sub) return ack?.({ ok: false, error: 'not_your_event' });
        socket.join(`event:${eventId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('unwatch', (eventId) => socket.leave(`event:${eventId}`));
  });

  return io;
}
