'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CityState, BuildingType } from '@/lib/types';
import {
  createInitialState,
  gameTick,
  placeBuilding,
  upgradeBuilding,
  setSelectedCategory,
  setSelectedBuilding,
  setTaxLevel,
  serializeState,
  deserializeState,
  addToast,
  clearToasts,
  getCategoryBuildings,
} from '@/lib/engine';
import { saveGame, loadGame } from '@/lib/supabase';
import { BUILDINGS, CATEGORY_ORDER, TAX_LEVELS } from '@/lib/gamedata';
import CityCanvas from '@/components/CityCanvas';

const TAX_ORDER: Array<keyof typeof TAX_LEVELS> = ['low', 'medium', 'high'];

export default function HomePage() {
  const [state, setState] = useState<CityState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showStats, setShowStats] = useState(false);
  const [view, setView] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const lastToastIdsRef = useRef<Set<string>>(new Set());
  const tickRafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);

  // Load on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await loadGame();
      if (!mounted) return;
      if (saved) {
        setState(saved);
        setShowIntro(false);
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Economy tick loop (uses rAF, not setInterval)
  useEffect(() => {
    if (!state || showIntro) return;
    let running = true;
    const loop = (time: number) => {
      if (!running) return;
      if (time - lastTickRef.current >= 2000) {
        lastTickRef.current = time;
        setState(prev => {
          if (!prev) return prev;
          const next = gameTick(prev);
          return next;
        });
      }
      tickRafRef.current = requestAnimationFrame(loop);
    };
    tickRafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(tickRafRef.current);
    };
  }, [state, showIntro]);

  // Auto-save every 30s
  useEffect(() => {
    if (!state || showIntro) return;
    const id = window.setInterval(() => {
      handleSave();
    }, 30000);
    return () => clearInterval(id);
  }, [state, showIntro]);

  // Handle new toasts
  useEffect(() => {
    if (!state) return;
    for (const toast of state.toasts) {
      if (!lastToastIdsRef.current.has(toast.id)) {
        lastToastIdsRef.current.add(toast.id);
        // Browser toast API fallback if available, otherwise ignore
      }
    }
  }, [state]);

  const handleSave = useCallback(async () => {
    if (!state) return;
    setSaveStatus('saving');
    const ok = await saveGame(state);
    setSaveStatus(ok ? 'saved' : 'error');
    if (!ok) {
      setState(prev => (prev ? addToast(prev, 'Erreur de sauvegarde', 'warning') : prev));
    }
    window.setTimeout(() => setSaveStatus('idle'), 1500);
  }, [state]);

  const startGame = () => {
    const name = playerName.trim() || 'Joueur';
    const fresh = createInitialState(name);
    setState(fresh);
    setShowIntro(false);
  };

  const handleTileTap = (x: number, y: number) => {
    setState(prev => {
      if (!prev) return prev;
      const building = prev.selectedBuilding;
      if (prev.tiles[y][x].type === building) {
        // Upgrade if same building tapped
        const upgraded = upgradeBuilding(prev, x, y);
        if (upgraded.upgraded) {
          return addToast(clearToasts(upgraded.state), upgraded.message!, 'success');
        }
        return clearToasts(upgraded.state);
      }
      const result = placeBuilding(prev, x, y, building);
      if (result.placed) {
        return addToast(clearToasts(result.state), result.message!, 'success');
      }
      return addToast(clearToasts(result.state), result.message || 'Action impossible', 'warning');
    });
  };

  const handleCategorySelect = (category: CityState['selectedCategory']) => {
    setState(prev => (prev ? setSelectedCategory(prev, category) : prev));
  };

  const handleBuildingSelect = (type: BuildingType) => {
    setState(prev => (prev ? setSelectedBuilding(prev, type) : prev));
  };

  const handleTaxChange = () => {
    setState(prev => {
      if (!prev) return prev;
      const idx = TAX_ORDER.indexOf(prev.stats.taxLevel);
      const nextLevel = TAX_ORDER[(idx + 1) % TAX_ORDER.length];
      return setTaxLevel(prev, nextLevel);
    });
  };

  const resetView = () => {
    setView({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const formatMoney = (m: number) => `$${Math.round(m).toLocaleString('fr-CA')}`;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-black flex items-center justify-center">
        <div className="text-emerald-400 text-lg font-semibold animate-pulse">Chargement de Canada City Builder...</div>
      </div>
    );
  }

  if (showIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm w-full space-y-8 animate-fadeIn">
          <div className="space-y-2">
            <div className="text-5xl mb-2">🍁</div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Canada City Builder</h1>
            <p className="text-emerald-200 text-sm">Construis ta ville, gère l'économie et fais prospérer tes citoyens.</p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4">
            <label className="block text-left text-sm text-slate-300">
              Nom du maire
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Entre ton nom"
                maxLength={20}
                className="mt-2 w-full rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <button
              onClick={startGame}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-6 py-4 font-bold text-white shadow-lg shadow-emerald-900/40 active:scale-95 transition-transform"
            >
              Commencer à construire
            </button>
          </div>

          <p className="text-xs text-slate-500">Optimisé pour mobile • 375px+</p>
        </div>
      </div>
    );
  }

  if (!state) return null;

  const currentBuildings = getCategoryBuildings(state.selectedCategory);

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex-none z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🍁</span>
            <span className="font-bold text-sm text-white truncate max-w-[90px]">Canada City</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col items-end">
              <span className="text-emerald-400 font-bold">{formatMoney(state.stats.money)}</span>
              <span className="text-slate-400">Argent</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-blue-400 font-bold">{state.stats.population}</span>
              <span className="text-slate-400">Hab.</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-amber-400 font-bold">{state.stats.happiness}%</span>
              <span className="text-slate-400">Bonheur</span>
            </div>
          </div>
        </div>
      </header>

      {/* Canvas area */}
      <main className="flex-1 relative min-h-0">
        <CityCanvas
          state={state}
          view={view}
          onViewChange={setView}
          onTileTap={handleTileTap}
          selectedBuilding={state.selectedBuilding}
        />

        {/* Floating controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            onClick={() => setShowStats(true)}
            className="w-10 h-10 rounded-full bg-slate-800/80 backdrop-blur text-white border border-slate-700 flex items-center justify-center text-lg shadow-lg active:scale-90 transition-transform"
            aria-label="Statistiques"
          >
            📊
          </button>
          <button
            onClick={resetView}
            className="w-10 h-10 rounded-full bg-slate-800/80 backdrop-blur text-white border border-slate-700 flex items-center justify-center text-lg shadow-lg active:scale-90 transition-transform"
            aria-label="Recentrer"
          >
            🎯
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="w-10 h-10 rounded-full bg-emerald-700/80 backdrop-blur text-white border border-emerald-600 flex items-center justify-center text-lg shadow-lg active:scale-90 transition-transform disabled:opacity-60"
            aria-label="Sauvegarder"
          >
            💾
          </button>
        </div>

        {/* Tax badge */}
        <button
          onClick={handleTaxChange}
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-slate-800/80 backdrop-blur border border-slate-700 text-xs font-semibold text-white active:scale-95 transition-transform"
        >
          Taxe: {TAX_LEVELS[state.stats.taxLevel].label}
        </button>

        {/* Save status toast */}
        {saveStatus !== 'idle' && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg animate-fadeIn bg-slate-800 text-white border border-slate-700">
            {saveStatus === 'saving' ? 'Sauvegarde...' : saveStatus === 'saved' ? 'Sauvegardé !' : 'Erreur de sauvegarde'}
          </div>
        )}
      </main>

      {/* Bottom toolbar */}
      <footer className="flex-none z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800">
        {/* Category strip */}
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto scrollbar-hide">
          {CATEGORY_ORDER.map(cat => {
            const active = state.selectedCategory === cat.category;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.category)}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:bg-slate-800/50'
                }`}
                style={{ borderColor: active ? cat.accent : undefined }}
              >
                <span className="text-lg">{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Building cards */}
        {state.selectedCategory !== 'bulldoze' && (
          <div className="flex items-center gap-2 px-3 pb-3 overflow-x-auto">
            {currentBuildings.map(type => {
              const def = BUILDINGS[type];
              const active = state.selectedBuilding === type;
              const affordable = state.stats.money >= def.cost;
              return (
                <button
                  key={type}
                  onClick={() => handleBuildingSelect(type)}
                  disabled={!affordable && type !== 'road'}
                  className={`flex-shrink-0 w-24 rounded-xl p-2.5 text-left border transition-all ${
                    active
                      ? 'bg-slate-800 border-emerald-500 shadow-lg shadow-emerald-900/30'
                      : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800'
                  } ${!affordable && type !== 'road' ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-lg">{def.icon}</span>
                    <span className="text-[10px] font-bold text-emerald-400">{def.cost === 0 ? 'Gratuit' : `$${def.cost.toLocaleString('fr-CA')}`}</span>
                  </div>
                  <div className="text-xs font-semibold text-white leading-tight">{def.label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">{def.description}</div>
                </button>
              );
            })}
          </div>
        )}

        {state.selectedCategory === 'bulldoze' && (
          <div className="px-3 pb-3 text-xs text-slate-400 text-center">Tape un bâtiment pour le détruire (remboursement partiel).</div>
        )}
      </footer>

      {/* Stats modal */}
      {showStats && (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow-2xl p-5 space-y-4 animate-slideUp">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Statistiques de la ville</h2>
              <button onClick={() => setShowStats(false)} className="text-slate-400 text-xl">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat label="Argent" value={formatMoney(state.stats.money)} color="text-emerald-400" />
              <Stat label="Population" value={state.stats.population.toLocaleString('fr-CA')} color="text-blue-400" />
              <Stat label="Bonheur" value={`${state.stats.happiness}%`} color="text-amber-400" />
              <Stat label="Taxe" value={TAX_LEVELS[state.stats.taxLevel].label} color="text-purple-400" />
              <Stat label="Routes" value={`${state.stats.roadsBuilt}`} color="text-slate-300" />
              <Stat label="Bâtiments" value={`${state.stats.buildingsBuilt}`} color="text-slate-300" />
              <Stat label="Revenus totaux" value={formatMoney(state.stats.totalEarned)} color="text-emerald-400" />
              <Stat label="Dépenses totales" value={formatMoney(state.stats.totalSpent)} color="text-rose-400" />
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800">
              Maire: {state.playerName} • Tick #{state.stats.tick}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-800">
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}
