/**
 * Express application setup — extracted from index.js for testability.
 * Exports app + httpServer + io WITHOUT calling listen().
 * Use index.js for production (which calls listen), or import directly in tests.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import competitionRoutes from './routes/competitions.js';
import registrationRoutes from './routes/registrations.js';
import heatRoutes from './routes/heats.js';
import scoreRoutes from './routes/scores.js';
import divisionRoutes from './routes/divisions.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Make io accessible in routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/competitions', competitionRoutes);
app.use('/api/competitions', divisionRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/heats', heatRoutes);
app.use('/api/scores', scoreRoutes);

// Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:competition', (competitionId) => {
    socket.join(competitionId);
  });

  socket.on('join:judge', (userId) => {
    socket.join(`judge:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export { app, httpServer, io };
