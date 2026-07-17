// Supabase client for Quebec Logistics Tycoon
// Uses Emerick's Supabase project

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_EMERICK_SUPABASE_URL || 'https://hlxbqtayotwdtspkrlol.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_EMERICK_SUPABASE_ANON_KEY || process.env.EMERICK_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const TABLE = 'ql_game_saves';
const PLAYER_ID = 'emergick-ql-1'; // single-player default

export async function saveGame(state: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({
        player_id: PLAYER_ID,
        player_name: 'Emerick',
        game_data: JSON.parse(state),
      });
    if (error) {
      console.error('Save error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Save exception:', e);
    return false;
  }
}

export async function loadGame(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('game_data')
      .eq('player_id', PLAYER_ID)
      .single();
    if (error || !data) return null;
    return JSON.stringify(data.game_data);
  } catch (e) {
    console.error('Load exception:', e);
    return null;
  }
}

export async function hasSave(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from(TABLE)
      .select('player_id')
      .eq('player_id', PLAYER_ID)
      .single();
    return !!data;
  } catch {
    return false;
  }
}