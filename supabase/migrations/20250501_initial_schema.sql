-- Initial schema for Mythical Beings Card Game
-- This creates the basic table structure before applying RLS policies

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    username TEXT,
    eth_address TEXT UNIQUE,
    avatar_url TEXT,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on eth_address for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_eth_address ON public.profiles(eth_address);

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES public.profiles(id),
    player2_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'waiting',
    winner_id UUID REFERENCES public.profiles(id),
    current_turn_player_id UUID REFERENCES public.profiles(id),
    game_state JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create moves table
CREATE TABLE IF NOT EXISTS public.moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.profiles(id),
    move_type TEXT NOT NULL,
    move_data JSONB,
    turn_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Basic RLS policies for games
CREATE POLICY "Users can view their games" ON public.games
    FOR SELECT USING (
        auth.uid() = player1_id OR 
        auth.uid() = player2_id
    );

CREATE POLICY "Users can create games" ON public.games
    FOR INSERT WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update their games" ON public.games
    FOR UPDATE USING (
        auth.uid() = player1_id OR 
        auth.uid() = player2_id
    );

-- Basic RLS policies for moves
CREATE POLICY "Users can view moves in their games" ON public.moves
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.games
            WHERE games.id = moves.game_id
            AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
        )
    );

CREATE POLICY "Players can insert moves in their games" ON public.moves
    FOR INSERT WITH CHECK (
        auth.uid() = player_id AND
        EXISTS (
            SELECT 1 FROM public.games
            WHERE games.id = moves.game_id
            AND (games.player1_id = auth.uid() OR games.player2_id = auth.uid())
        )
    );
