-- Quebec Logistics Tycoon - Game Save System
-- Project: hlxbqtayotwdtspkrlol (Emerick's Supabase)

CREATE TABLE IF NOT EXISTS ql_game_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id TEXT UNIQUE NOT NULL,
  player_name TEXT,
  game_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ql_game_saves ENABLE ROW LEVEL SECURITY;

-- Allow all for now (game is single-player, no auth needed)
-- Drop existing policy first (IF EXISTS supported on DROP)
DROP POLICY IF EXISTS "ql_all_access" ON ql_game_saves;

CREATE POLICY "ql_all_access" ON ql_game_saves
  FOR ALL USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION ql_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ql_game_saves_updated ON ql_game_saves;
CREATE TRIGGER ql_game_saves_updated
  BEFORE UPDATE ON ql_game_saves
  FOR EACH ROW
  EXECUTE FUNCTION ql_update_updated_at();