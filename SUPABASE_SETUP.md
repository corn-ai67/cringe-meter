# ⚡ CRINGE METER — Supabase PostgreSQL Setup & Deployment Guide

This guide walks you through setting up a **real hosted Supabase PostgreSQL cloud database** for CRINGE METER so that all player accounts, statistics, match results, leaderboards, VIP subscriptions, and marketing emails are stored permanently in the cloud (not on your PC).

---

## 🏗️ Architecture Overview

```text
CRINGE METER Web Client (PC / Mobile / Tablet)
                      │
                      ▼
        Node.js Backend Server (Render.com)
                      │
        ┌─────────────┼──────────────┬──────────────┐
        ▼             ▼              ▼              ▼
     LiveKit     Socket.IO        Resend        Supabase
   WebRTC Video  Matchmaking      Email        PostgreSQL
                                                (Cloud DB)
                                                    │
             ┌─────────────────┬────────────────────┤
             ▼                 ▼                    ▼
          users           player_stats           matches
      subscriptions     email_subscribers    reports & blocks
```

---

## 🚀 Step 1: Create a Free Supabase Project

1. Navigate to **[https://supabase.com](https://supabase.com)** and sign in (or create a free account).
2. Click **"New Project"**.
3. Enter project details:
   * **Name:** `cringe-meter-db`
   * **Database Password:** *(Choose a strong password and save it)*
   * **Region:** Select a region close to your users (e.g. *Singapore* or *US East*).
   * **Pricing Plan:** Free tier.
4. Click **"Create new project"** and wait ~1 minute for deployment.

---

## 🔑 Step 2: Copy API Keys & Credentials

1. In your Supabase Dashboard, click on **Project Settings** (gear icon in the sidebar) ➔ **API**.
2. Copy the following 3 values:
   * **Project URL:** `https://your-project-id.supabase.co`
   * **anon (public) key:** `eyJh...`
   * **service_role (secret) key:** `eyJh...` *(Never expose this to frontend code)*

---

## 📜 Step 3: Run the Database Schema Migration

1. In your Supabase Dashboard sidebar, click on **SQL Editor**.
2. Click **"New Query"**.
3. Open the migration file in this repository:
   * [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
4. Copy the entire SQL content, paste it into the Supabase SQL editor, and click **"Run"** (or `Ctrl + Enter`).
5. You should see `Success. No rows returned`.

### Tables Created:
* `users` — Authentic player profiles, avatars, titles, and themes.
* `player_stats` — Coins, XP, Level, Wins, Losses, Streaks, Total Score, and Weekly Score.
* `matches` — Full audit log of 1v1 battle outcomes and scores.
* `subscriptions` — VIP membership plans, status, and expiry timestamps.
* `email_subscribers` — Marketing subscriber emails and unsubscribe tokens.
* `reports` — Player safety incident reports and moderation status.
* `blocks` — User-to-user blocking relationships.

---

## ⚙️ Step 4: Configure Environment Variables

### In Render.com (Production Deployment):
1. Go to your **Render Dashboard** ➔ Click on your `cringe-meter` Web Service.
2. Go to the **Environment** tab.
3. Add the following environment variables:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-secret-key
SUPABASE_ANON_KEY=your-supabase-anon-public-key

LIVEKIT_URL=wss://cringe-meter-gbi9jmfs.livekit.cloud
LIVEKIT_API_KEY=APIWzNPgyrfrxYr
LIVEKIT_API_SECRET=fvSTUgwsEcOpFicFH6PP6EoJbt5WfInWlKolrdombdt
```

4. Click **"Save Changes"** — Render will automatically redeploy the service with cloud database access!

---

## 🔍 Step 5: Verify the Cloud Database Connection

After deploying, verify the health status:

1. Open your browser or curl:
   ```bash
   https://cringe-meter.onrender.com/api/health
   ```
2. You will receive:
   ```json
   {
     "status": "ONLINE",
     "service": "CRINGE METER Server",
     "database": "CONNECTED",
     "databaseMessage": "Connected to Supabase PostgreSQL cloud database"
   }
   ```

---

## 🛡️ Security & Row-Level Security (RLS)
* **RLS is enabled on all tables.**
* The Node.js server uses the **Service Role** key on the backend to perform verified reads and writes.
* The frontend browser never has direct write access to XP, coins, or match results, preventing cheating.
