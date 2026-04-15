/**
 * Production server entry point.
 * Initializes DB and starts the HTTP/Socket.IO server.
 */

import 'dotenv/config';
import { httpServer } from './app.js';
import { initDb } from './db/schema.js';

initDb();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
