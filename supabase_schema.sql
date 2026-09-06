-- =======================================================
-- Badminton Tournament Database Schema for Supabase
-- Run this in Supabase -> SQL Editor -> New query -> Run
-- =======================================================

-- 1. Tournaments Table
CREATE TABLE IF NOT EXISTS public.tournaments (
    id TEXT PRIMARY KEY,
    match_name TEXT NOT NULL,
    match_address TEXT,
    court_name TEXT,
    categories JSONB DEFAULT '[]'::jsonb,
    participants JSONB DEFAULT '[]'::jsonb,
    authenticators JSONB DEFAULT '[]'::jsonb,
    start_date DATE,
    end_date DATE,
    total_days INT DEFAULT 1,
    organizer_name TEXT,
    organizer_mobile TEXT,
    image TEXT,
    winner TEXT,
    category_winners JSONB DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tournament Draws & Fixtures Table
CREATE TABLE IF NOT EXISTS public.tournament_draws (
    id TEXT PRIMARY KEY, -- e.g. "1-Men Singles" or tournament_id
    tournament_id TEXT,
    category TEXT,
    draw_data JSONB DEFAULT '{}'::jsonb,
    is_published BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Live Match Scores & Courts Status Table
CREATE TABLE IF NOT EXISTS public.live_matches (
    match_id TEXT PRIMARY KEY,
    tournament_id TEXT,
    category TEXT,
    round_name TEXT,
    court_name TEXT,
    team1_name TEXT,
    team2_name TEXT,
    set1_score TEXT,
    set2_score TEXT,
    set3_score TEXT,
    current_server TEXT,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'ongoing', 'completed'
    winner_team TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Temporary Credentials / Umpire & Admin Logins Table
CREATE TABLE IF NOT EXISTS public.credentials (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    assigned_match_id TEXT,
    assigned_match_name TEXT,
    court_name TEXT,
    scope TEXT DEFAULT 'umpire',
    expiry TEXT,
    role TEXT DEFAULT 'umpire',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS) and allow public read/write for Anon Key
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

-- Create open access policies for anon role (convenient for client app)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anon public access tournaments" ON public.tournaments;
    CREATE POLICY "Anon public access tournaments" ON public.tournaments FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon public access draws" ON public.tournament_draws;
    CREATE POLICY "Anon public access draws" ON public.tournament_draws FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon public access live_matches" ON public.live_matches;
    CREATE POLICY "Anon public access live_matches" ON public.live_matches FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon public access credentials" ON public.credentials;
    CREATE POLICY "Anon public access credentials" ON public.credentials FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Enable Realtime for live score and tournament broadcasting
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_draws;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credentials;
