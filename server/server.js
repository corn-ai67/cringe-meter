/**
 * CRINGE METER — Authoritative Backend Server
 * Architecture: Clean Express REST API + Real-Time Socket.IO Engine
 * Features: 1v1 Matchmaking, Supabase PostgreSQL persistence, LiveKit WebRTC Token Issuance.
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const { PORT } = require('./config/constants');
const apiRoutes = require('./routes');
const { setupBattleSockets } = require('./sockets/battleSocket');

// Initialize Express Application
const app = express();
const server = http.createServer(app);

// Global Middlewares
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store io reference on app for route access (e.g. real-time leaderboard broadcast)
app.set('io', io);

// Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, '..')));

// Mount Modular REST API & Web Routes
app.use(apiRoutes);

// Mount Multiplayer Socket.IO Controllers
setupBattleSockets(io);

// Start HTTP & WebSocket Server (only when run directly)
if (require.main === module) {
  server.listen(PORT, () => {
    console.log("==================================================");
    console.log(`⚡ CRINGE METER Server running on http://localhost:${PORT}`);
    console.log("📁 Backend Modular Architecture: Active");
    console.log("==================================================");
  });
}

module.exports = { app, server, io };
