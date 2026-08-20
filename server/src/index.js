import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './lib/config.js';
import { attachSocket } from './lib/socket.js';
import { initDatabase } from './lib/db.js';

import { authRouter } from './routes/auth.js';
import { eventsRouter } from './routes/events.js';
import { registrationsRouter } from './routes/registrations.js';
import { checkinsRouter } from './routes/checkins.js';
import { dashboardRouter } from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: config.clientOrigin === '*' ? true : config.clientOrigin.split(','),
    credentials: false,
  }),
);

app.get('/health', (req, res) => res.json({ ok: true, port: config.port }));

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events', dashboardRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/checkins', checkinsRouter);

// Serve static frontend build in production
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.httpStatus || 500).json({ error: err.message || 'internal_error' });
});

const server = http.createServer(app);
const io = attachSocket(server);
app.set('io', io);

server.listen(config.port, async () => {
  console.log(`CheckPoint server listening on :${config.port}`);
  await initDatabase();
});
