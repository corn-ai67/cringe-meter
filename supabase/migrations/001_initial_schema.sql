-- ====================================================================
-- CRINGE METER — Supabase PostgreSQL Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Sets up users, stats, matches, VIP subscriptions,
--              email marketing subscribers, safety reports, and blocks.
-- ====================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Helper function: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================================================================
-- 3. USERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_user_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL DEFAULT 'Anonymous',
    avatar_url TEXT,
    avatar_emoji TEXT DEFAULT '👤',
    rank_title TEXT DEFAULT 'Unranked',
    custom_title TEXT DEFAULT 'GUEST FIGHTER',
    theme TEXT DEFAULT 'magenta',
    victory_taunt TEXT DEFAULT 'YOU BROKE THEM 💀',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ====================================================================
-- 4. PLAYER STATS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS player_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    coins BIGINT NOT NULL DEFAULT 0,
    xp BIGINT NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    total_battles INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    total_score BIGINT NOT NULL DEFAULT 0,
    weekly_wins INTEGER NOT NULL DEFAULT 0,
    weekly_score BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_player_stats_modtime
    BEFORE UPDATE ON player_stats
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ====================================================================
-- 5. MATCHES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    player_a_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_b_id UUID REFERENCES users(id) ON DELETE SET NULL,
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    loser_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mode TEXT NOT NULL DEFAULT 'dont_laugh',
    player_a_score INTEGER DEFAULT 0,
    player_b_score INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'completed'
);

-- ====================================================================
-- 6. SUBSCRIPTIONS TABLE (VIP Entitlements)
-- ====================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'cringe_vip_monthly_599',
    status TEXT NOT NULL DEFAULT 'inactive', -- active, inactive, expired, cancelled, past_due
    provider TEXT DEFAULT 'stripe',
    provider_customer_id TEXT,
    provider_subscription_id TEXT,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_subscriptions_modtime
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ====================================================================
-- 7. EMAIL SUBSCRIBERS TABLE (Marketing & Newsletters)
-- ====================================================================
CREATE TABLE IF NOT EXISTS email_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    subscribed BOOLEAN NOT NULL DEFAULT true,
    verified BOOLEAN NOT NULL DEFAULT false,
    source TEXT NOT NULL DEFAULT 'landing_signup',
    unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_email_subscribers_modtime
    BEFORE UPDATE ON email_subscribers
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ====================================================================
-- 8. SAFETY REPORTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewed, dismissed, banned
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- 9. USER BLOCKS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_blocker_blocked UNIQUE(blocker_id, blocked_user_id)
);

-- ====================================================================
-- 10. INDEXES FOR HIGH-PERFORMANCE QUERYING & LEADERBOARDS
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_users_internal_id ON users(internal_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_player_stats_total_score ON player_stats(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_current_streak ON player_stats(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_weekly_score ON player_stats(weekly_score DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_total_battles ON player_stats(total_battles);

CREATE INDEX IF NOT EXISTS idx_matches_session_id ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_matches_winner_id ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_loser_id ON matches(loser_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_token ON email_subscribers(unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);

-- ====================================================================
-- 11. ATOMIC MATCH RESULT RECORDING FUNCTION (RPC)
-- ====================================================================
CREATE OR REPLACE FUNCTION record_match_outcome_rpc(
    p_session_id TEXT,
    p_winner_internal_id TEXT,
    p_loser_internal_id TEXT,
    p_mode TEXT DEFAULT 'dont_laugh',
    p_winner_earned_score INTEGER DEFAULT 150,
    p_loser_earned_score INTEGER DEFAULT 40
)
RETURNS JSONB AS $$
DECLARE
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_existing_match_id UUID;
    v_winner_stats RECORD;
BEGIN
    -- Check if session already recorded (idempotency check)
    SELECT id INTO v_existing_match_id FROM matches WHERE session_id = p_session_id;
    IF v_existing_match_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'Match already recorded');
    END IF;

    -- Look up Winner UUID
    SELECT id INTO v_winner_user_id FROM users WHERE internal_user_id = p_winner_internal_id;
    -- Look up Loser UUID
    SELECT id INTO v_loser_user_id FROM users WHERE internal_user_id = p_loser_internal_id;

    -- Insert Match Record
    INSERT INTO matches (
        session_id, player_a_id, player_b_id, winner_id, loser_id, mode, status
    ) VALUES (
        p_session_id, v_winner_user_id, v_loser_user_id, v_winner_user_id, v_loser_user_id, p_mode, 'completed'
    );

    -- Update Winner Stats if User exists
    IF v_winner_user_id IS NOT NULL THEN
        INSERT INTO player_stats (user_id, wins, total_battles, current_streak, best_streak, total_score, weekly_wins, weekly_score, xp)
        VALUES (
            v_winner_user_id, 1, 1, 1, 1, p_winner_earned_score, 1, p_winner_earned_score, p_winner_earned_score
        )
        ON CONFLICT (user_id) DO UPDATE SET
            wins = player_stats.wins + 1,
            total_battles = player_stats.total_battles + 1,
            current_streak = player_stats.current_streak + 1,
            best_streak = GREATEST(player_stats.best_streak, player_stats.current_streak + 1),
            total_score = player_stats.total_score + p_winner_earned_score,
            weekly_wins = player_stats.weekly_wins + 1,
            weekly_score = player_stats.weekly_score + p_winner_earned_score,
            xp = player_stats.xp + p_winner_earned_score,
            updated_at = now();
    END IF;

    -- Update Loser Stats if User exists
    IF v_loser_user_id IS NOT NULL THEN
        INSERT INTO player_stats (user_id, losses, total_battles, current_streak, total_score, weekly_score, xp)
        VALUES (
            v_loser_user_id, 1, 1, 0, p_loser_earned_score, p_loser_earned_score, p_loser_earned_score
        )
        ON CONFLICT (user_id) DO UPDATE SET
            losses = player_stats.losses + 1,
            total_battles = player_stats.total_battles + 1,
            current_streak = 0,
            total_score = player_stats.total_score + p_loser_earned_score,
            weekly_score = player_stats.weekly_score + p_loser_earned_score,
            xp = player_stats.xp + p_loser_earned_score,
            updated_at = now();
    END IF;

    RETURN jsonb_build_object('success', true, 'duplicate', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Allow read-only access to public profile & leaderboard views for anonymous/authenticated roles
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Public read player_stats" ON player_stats FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);

-- Allow full management only for service_role (used by our Node.js backend)
CREATE POLICY "Service role full access users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access player_stats" ON player_stats FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access matches" ON matches FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access subscriptions" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access email_subscribers" ON email_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access reports" ON reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access blocks" ON blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
