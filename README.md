# 🤡 CRINGE METER — Online Browser Multiplayer Prototype

> **"How much cringe can you handle?"**

CRINGE METER is a competitive live social game where two strangers match up to play **Don't Laugh**. One player performs an AI/Custom cringe prompt while the defender holds a 10-second poker face.

This codebase contains the complete **Web-Based Online Multiplayer Prototype** built with Vanilla HTML/CSS/JavaScript, Node.js, Express, Socket.IO, and LiveKit WebRTC Cloud.

---

## 🏗️ Tech Architecture

```text
CRINGE METER WEBSITE (HTML / CSS / JavaScript)
  ├── Existing UI / Themes / Cringe Studio / Audio Synth
  ├── Online Modules (js/online/)
  │     ├── onlineState.js (Persistent cm_xxxxxxxxx user identity)
  │     ├── matchmaking.js (Socket.IO client event handling)
  │     ├── livekitClient.js (LiveKit Cloud WebRTC 2-way video/audio)
  │     ├── onlineBattle.js (Online battle UI, roles, NEXT button)
  │     └── reactionAnalyzer.js (Local face reaction analyzer module stub)
  └── Node.js Authoritative Backend (server/)
        ├── server.js (Express & Socket.IO server on PORT 3000)
        ├── matchmaking.js (In-memory matchmaking queue & anti-duplicate logic)
        ├── gameRooms.js (Server-authoritative 1v1 room state & round sync)
        ├── livekit.js (LiveKit Server SDK token generation)
        └── reports.js (Safety report & block storage endpoints)
```

---

## ⚡ Quick Start & Local Development

### 1. Install & Start Backend Server
```bash
cd server
npm install
node server.js
```
The backend server runs on `http://localhost:3000`.

### 2. Start Frontend App
```bash
# From root project directory (D:\cringe_meter)
npx serve -p 8080
```
The web app is available at `http://localhost:8080`.

---

## 🧪 How to Test 2-Player Online Matchmaking

1. Open **Browser 1**: Go to `http://localhost:8080`
2. Open **Browser 2 (Incognito)**: Go to `http://localhost:8080`
3. Click **FIND STRANGER** on Browser 1.
4. Click **FIND STRANGER** on Browser 2.
5. Both clients will transition: `SEARCHING → MATCH FOUND → BATTLE`.
6. LiveKit WebRTC video and audio streams will connect.
7. Click **NEXT →** on either browser to instantly leave the room and re-enter the queue for a new stranger!

---

## 🔐 Environment Variables (`server/.env`)

```env
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
PORT=3000
```
*Note: Real secrets reside exclusively on the server side in `server/.env`.*

---

## 🛡️ Safety & Moderation Features

- **Anonymous User ID**: Each client maintains a persistent internal ID (`cm_xxxxxxxxx`) in `localStorage`.
- **🚩 Report Stranger**: Players can submit reports for inappropriate content or behavior via the report modal.
- **⛔ Block Stranger**: Blocking a stranger immediately disconnects the match and prevents future pairing.

---

## 📱 Future Mobile App Roadmap

When converting to React Native / Expo in the future:
1. Re-use `server/` Node.js + Socket.IO + LiveKit backend without modification!
2. Replace vanilla JS DOM calls in `js/online/` with `@livekit/react-native` and `socket.io-client`.
