// Canada City Builder - Supabase save/load

import { createClient } from '@supabase/supabase-js';
import type { CityState } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_EMERICK_SUPABASE_URL || 'https://hlxbqtayotwdtspkrlol.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_EMERICK_SUPABASE_ANON_KEY || process.env.EMERICK_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const TABLE = 'cb_game_saves';
const PLAYER_ID = 'player-cb-1';

export async function saveGame(state: CityState): Promise<boolean> {
  try {
    const { error } = await supabase.from(TABLE).upsert({
      player_id: PLAYER_ID,
      player_name: state.playerName,
      game_data: JSON.parse(serializeState(state)),
      updated_at: new Date().toISOString(),
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

export async function loadGame(): Promise<CityState | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('game_data')
      .eq('player_id', PLAYER_ID)
      .single();
    if (error || !data || !data.game_data) return null;
    return deserializeState(JSON.stringify(data.game_data));
  } catch (e) {
    console.error('Load exception:', e);
    return null;
  }
}

export async function hasSave(): Promise<boolean> {
  try {
    const { data } = await supabase.from(TABLE).select('player_id').eq('player_id', PLAYER_ID).single();
    return !!data;
  } catch {
    return false;
  }
}

function serializeState(state: CityState): string {
  return JSON.stringify({
    playerId: state.playerId,
    playerName: state.playerName,
    gridSize: state.gridSize,
    tiles: state.tiles,
    stats: state.stats,
    selectedCategory: state.selectedCategory,
    selectedBuilding: state.selectedBuilding,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  });
}

function deserializeState(json: string): CityState | null {
  try {
    const data = JSON.parse(json) as Partial<CityState>;
    if (!data.tiles || !data.stats) return null;
    return {
      playerId: (data.playerId as string) || PLAYER_ID,
      playerName: (data.playerName as string) || 'Joueur',
      gridSize: (data.gridSize as number) || 30,
      tiles: data.tiles as CityState['tiles'],
      stats: data.stats as CityState['stats'],
      selectedCategory: (data.selectedCategory as CityState['selectedCategory']) || 'road',
      selectedBuilding: (data.selectedBuilding as CityState['selectedBuilding']) || 'road',
      toasts: [],
      createdAt: (data.createdAt as string) || new Date().toISOString(),
      updatedAt: (data.updatedAt as string) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
