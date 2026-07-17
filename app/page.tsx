'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Truck, Store, Warehouse } from '@/lib/types';
import {
  createInitialState,
  gameTick,
  dispatchTruck,
  negotiateContract,
  buyTruck,
  upgradeWarehouse,
  hireStaff,
  fireStaff,
  serializeState,
  deserializeState,
} from '@/lib/engine';
import { saveGame, loadGame } from '@/lib/supabase';
import MapCanvas from '@/components/MapCanvas';

type Tab = 'overview' | 'trucks' | 'stores' | 'warehouses' | 'staff' | 'contracts';

type Toast = { id: number; message: string; type: 'success' | 'warning' | 'info' };

export default function GamePage() {
  const [state, setState] = useState<GameState>(() => createInitialState('Emerick'));
  const [tab, setTab] = useState<Tab>('overview');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStateRef = useRef<GameState | null>(null);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Load game on mount
  useEffect(() => {
    (async () => {
      const saved = await loadGame();
      if (saved) {
        const deserialized = deserializeState(saved);
        if (deserialized) {
          setState(deserialized);
          setShowIntro(false);
          addToast('Partie chargée', 'info');
        }
      }
      setLoaded(true);
    })();
  }, [addToast]);

  // Game tick loop - every 500ms
  useEffect(() => {
    if (!loaded || showIntro) return;
    tickRef.current = setInterval(() => {
      setState(prev => {
        const next = gameTick(prev);
        prevStateRef.current = prev;
        return next;
      });
    }, 500);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [loaded, showIntro]);

  // Notifications from state changes
  useEffect(() => {
    const prev = prevStateRef.current;
    if (!prev || prev.tick === state.tick) return;

    if (state.totalDeliveries > prev.totalDeliveries) {
      const earned = state.totalEarned - prev.totalEarned;
      addToast(`Livraison terminée +$${Math.round(earned)}`, 'success');
    }
    state.trucks.forEach((t, i) => {
      const pt = prev.trucks[i];
      if (pt && t.fuel < 25 && pt.fuel >= 25) {
        addToast(`${t.name}: carburant faible`, 'warning');
      }
    });
  }, [state, addToast]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!loaded || showIntro) return;
    saveRef.current = setInterval(async () => {
      setSaveStatus('saving');
      const ok = await saveGame(serializeState(state));
      setSaveStatus(ok ? 'saved' : 'error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 30000);
    return () => {
      if (saveRef.current) clearInterval(saveRef.current);
    };
  }, [state, loaded, showIntro]);

  // Manual save
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    const ok = await saveGame(serializeState(state));
    setSaveStatus(ok ? 'saved' : 'error');
    addToast(ok ? 'Sauvegarde réussie' : 'Erreur de sauvegarde', ok ? 'success' : 'warning');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [state, addToast]);

  // Start new game
  const startGame = () => {
    const name = playerName.trim() || 'Emerick';
    const fresh = createInitialState(name);
    setState(fresh);
    prevStateRef.current = fresh;
    setShowIntro(false);
    addToast('Nouvelle partie commencée', 'success');
  };

  // Handlers
  const handleTruckClick = (id: string) => {
    setSelectedTruckId(id);
    setTab('trucks');
  };

  const handleStoreClick = (id: string) => {
    setSelectedStoreId(id);
    setTab('stores');
  };

  const handleWarehouseClick = (id: string) => {
    setSelectedWarehouseId(id);
    setTab('warehouses');
  };

  const handleDispatch = (truckId: string, storeId: string, qty: number) => {
    setState(prev => {
      const next = { ...prev };
      const ok = dispatchTruck(next, truckId, storeId, qty);
      if (ok) addToast('Camion dispatché', 'info');
      else addToast('Impossible de dispatcher', 'warning');
      return next;
    });
  };

  const handleQuickDispatch = () => {
    const idleTruck = state.trucks.find(t => t.status === 'idle');
    if (!idleTruck) return;
    const store = [...state.stores].sort((a, b) => b.demand - a.demand)[0];
    if (!store) return;
    const homeWh = state.warehouses.find(w => w.id === idleTruck.homeWarehouseId);
    const qty = Math.min(idleTruck.capacity, homeWh ? Math.floor(homeWh.stock) : 0, Math.max(1, Math.floor(store.demand / 2)));
    handleDispatch(idleTruck.id, store.id, qty);
  };

  const handleNegotiate = (storeId: string, level: 1 | 2 | 3) => {
    setState(prev => {
      const next = { ...prev };
      const ok = negotiateContract(next, storeId, level);
      addToast(ok ? 'Contrat signé' : 'Fonds insuffisants', ok ? 'success' : 'warning');
      return next;
    });
  };

  const handleBuyTruck = (whId: string) => {
    setState(prev => {
      const next = { ...prev };
      const ok = buyTruck(next, whId);
      addToast(ok ? 'Camion acheté' : 'Fonds insuffisants', ok ? 'success' : 'warning');
      return next;
    });
  };

  const handleUpgradeWh = (whId: string) => {
    setState(prev => {
      const next = { ...prev };
      const ok = upgradeWarehouse(next, whId);
      addToast(ok ? 'Entrepôt amélioré' : 'Amélioration impossible', ok ? 'success' : 'warning');
      return next;
    });
  };

  const handleHire = (whId: string, role: 'secretary' | 'dispatcher' | 'loader' | 'manager') => {
    setState(prev => {
      const next = { ...prev };
      const ok = hireStaff(next, whId, role);
      addToast(ok ? 'Employé engagé' : 'Fonds insuffisants', ok ? 'success' : 'warning');
      return next;
    });
  };

  const handleFire = (whId: string, staffId: string) => {
    setState(prev => {
      const next = { ...prev };
      const ok = fireStaff(next, whId, staffId);
      addToast(ok ? 'Employé licencié' : 'Action impossible', ok ? 'info' : 'warning');
      return next;
    });
  };

  // --- INTRO SCREEN ---
  if (showIntro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-950 via-slate-950 to-cyan-950 text-white p-4">
        <div className="w-full max-w-xs sm:max-w-sm bg-slate-900/70 rounded-3xl p-6 sm:p-8 backdrop-blur-md border border-slate-700/50 shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🚛</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Québec Logistics Tycoon
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Construis ton empire logistique dans le corridor Québec-Ontario.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Ton nom de joueur"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-xl border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition text-sm"
              onKeyDown={e => e.key === 'Enter' && startGame()}
            />
            <button
              onClick={startGame}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-900/40 transition active:scale-95"
            >
              Commencer à jouer
            </button>
          </div>

          {loaded && (
            <p className="text-center text-xs text-slate-500 mt-5">
              {state.tick > 0 ? 'Ancienne partie chargée — clique pour continuer' : 'Aucune sauvegarde trouvée'}
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN GAME UI ---
  const selectedTruck = state.trucks.find(t => t.id === selectedTruckId);
  const selectedStore = state.stores.find(s => s.id === selectedStoreId);
  const selectedWh = state.warehouses.find(w => w.id === selectedWarehouseId);
  const hasIdleTruck = state.trucks.some(t => t.status === 'idle');

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Vue', icon: '📊' },
    { id: 'trucks', label: 'Camions', icon: '🚛' },
    { id: 'stores', label: 'Magasins', icon: '🏪' },
    { id: 'warehouses', label: 'Entrepôts', icon: '🏭' },
    { id: 'staff', label: 'Staff', icon: '👥' },
    { id: 'contracts', label: 'Contrats', icon: '🤝' },
  ];

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {/* Toasts */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90vw] max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded-full text-sm font-medium shadow-lg border backdrop-blur-md animate-in fade-in slide-in-from-top-2 ${
              t.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' :
              t.type === 'warning' ? 'bg-amber-500/20 border-amber-500/40 text-amber-100' :
              'bg-slate-700/70 border-slate-500/40 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Compact top bar */}
      <header className="shrink-0 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🚛</span>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Badge color="green">${state.money.toLocaleString()}</Badge>
            <span className="text-slate-400">J{state.day}</span>
            <span className="text-amber-400">⭐ {state.reputation.toFixed(1)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            {saveStatus === 'saving' ? 'Sauvegarde...' : saveStatus === 'saved' ? 'Sauvegardé' : saveStatus === 'error' ? 'Erreur' : ''}
          </span>
          <button
            onClick={handleSave}
            className="text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2 py-1 rounded-md transition active:scale-95"
          >
            💾
          </button>
        </div>
      </header>

      {/* Main layout: mobile map top 50%, panel bottom; desktop map left 60%, panel right */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Map */}
        <div className="h-[50%] lg:h-auto lg:flex-[1.5] bg-slate-950 p-1.5 min-h-0">
          <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-inner bg-slate-900">
            <MapCanvas
              state={state}
              onTruckClick={handleTruckClick}
              onStoreClick={handleStoreClick}
              onWarehouseClick={handleWarehouseClick}
              selectedTruckId={selectedTruckId}
              selectedStoreId={selectedStoreId}
            />
          </div>
        </div>

        {/* Control panel */}
        <div className="flex-1 lg:flex-[1] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col min-h-0">
          {/* Tabs */}
          <div className="shrink-0 overflow-x-auto border-b border-slate-800 scrollbar-hide">
            <div className="flex px-2 py-2 gap-1 min-w-max">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    tab === t.id
                      ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {tab === 'overview' && <OverviewTab state={state} />}
            {tab === 'trucks' && (
              <TrucksTab
                state={state}
                selectedTruck={selectedTruck}
                selectedStoreId={selectedStoreId}
                selectedStore={selectedStore}
                onDispatch={handleDispatch}
              />
            )}
            {tab === 'stores' && (
              <StoresTab
                state={state}
                selectedStore={selectedStore}
                onNegotiate={handleNegotiate}
              />
            )}
            {tab === 'warehouses' && (
              <WarehousesTab
                state={state}
                selectedWh={selectedWh}
                onBuyTruck={handleBuyTruck}
                onUpgrade={handleUpgradeWh}
              />
            )}
            {tab === 'staff' && (
              <StaffTab
                state={state}
                selectedWh={selectedWh}
                onHire={handleHire}
                onFire={handleFire}
              />
            )}
            {tab === 'contracts' && <ContractsTab state={state} onNegotiate={handleNegotiate} />}
          </div>
        </div>
      </div>

      {/* Quick dispatch FAB */}
      {hasIdleTruck && (
        <button
          onClick={handleQuickDispatch}
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-bold shadow-xl shadow-emerald-900/50 active:scale-95 transition lg:bottom-6"
        >
          ⚡ Livraison rapide
        </button>
      )}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'blue' | 'amber' | 'slate' }) {
  const map = {
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    blue: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    slate: 'bg-slate-700 text-slate-300 border-slate-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${map[color]}`}>
      {children}
    </span>
  );
}

// --- Tab Components ---

function OverviewTab({ state }: { state: GameState }) {
  return (
    <div className="space-y-3">
      <Card title="📊 Statistiques">
        <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
          <Pill label="Argent" value={`$${state.money.toLocaleString()}`} valueColor="text-emerald-400" />
          <Pill label="Jour" value={`J${state.day}`} />
          <Pill label="Camions" value={String(state.trucks.length)} />
          <Pill label="Entrepôts" value={String(state.warehouses.length)} />
          <Pill label="Personnel" value={String(state.staff.length)} />
          <Pill label="Livraisons" value={String(state.totalDeliveries)} />
          <Pill label="Revenu" value={`$${state.totalEarned.toLocaleString()}`} valueColor="text-emerald-400" />
          <Pill label="Dépenses" value={`$${state.totalSpent.toLocaleString()}`} valueColor="text-red-400" />
          <Pill label="Réputation" value={`${state.reputation.toFixed(1)}/100`} valueColor="text-amber-400" />
          <Pill label="Contrats" value={String(state.contracts.filter(c => c.active).length)} />
        </div>
      </Card>

      <Card title="🚛 Camions">
        {state.trucks.length === 0 && <p className="text-slate-500 text-xs">Aucun camion</p>}
        {state.trucks.map(t => (
          <div key={t.id} className="text-xs bg-slate-800/70 rounded-lg p-2 mb-1.5 border border-slate-700">
            <div className="flex justify-between">
              <span className="font-bold text-slate-200">{t.name}</span>
              <StatusBadge status={t.status} />
            </div>
            <div className="text-slate-400 mt-1">Carb. {t.fuel.toFixed(0)}% • État {t.condition.toFixed(0)}% • Liv. {t.totalDeliveries}</div>
            {t.cargo && <div className="text-orange-400 mt-1">📦 {t.cargo.quantity} unités → {t.cargo.type}</div>}
          </div>
        ))}
      </Card>

      <Card title="🏭 Entrepôts">
        {state.warehouses.map(wh => (
          <div key={wh.id} className="text-xs bg-slate-800/70 rounded-lg p-2 mb-1.5 border border-slate-700">
            <div className="flex justify-between">
              <span className="font-bold text-slate-200">{wh.cityName}</span>
              <span className="text-slate-400">Lv{wh.level}</span>
            </div>
            <div className="text-slate-400">Stock {Math.floor(wh.stock)}/{wh.capacity} • Staff {wh.staff.length} • Camions {wh.trucks.length}</div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (wh.stock / wh.capacity) * 100)}%` }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: Truck['status'] }) {
  const map: Record<Truck['status'], { label: string; color: string }> = {
    idle: { label: 'Inactif', color: 'bg-slate-600 text-slate-100' },
    loading: { label: 'Chargement', color: 'bg-yellow-600 text-yellow-100' },
    en_route: { label: 'En route', color: 'bg-cyan-600 text-cyan-100' },
    unloading: { label: 'Déchargement', color: 'bg-orange-600 text-orange-100' },
    returning: { label: 'Retour', color: 'bg-indigo-600 text-indigo-100' },
  };
  const s = map[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${s.color}`}>{s.label}</span>;
}

function TrucksTab({
  state,
  selectedTruck,
  selectedStoreId,
  selectedStore,
  onDispatch,
}: {
  state: GameState;
  selectedTruck: Truck | undefined;
  selectedStoreId: string | null;
  selectedStore: Store | undefined;
  onDispatch: (truckId: string, storeId: string, qty: number) => void;
}) {
  const [qty, setQty] = useState(20);
  return (
    <div className="space-y-3">
      {selectedTruck && (
        <Card title={`🚛 ${selectedTruck.name}`} accent="blue">
          <div className="text-sm space-y-1 text-slate-200">
            <Pill label="Statut" value={selectedTruck.status} />
            <Pill label="Capacité" value={String(selectedTruck.capacity)} />
            <Pill label="Carburant" value={`${selectedTruck.fuel.toFixed(0)}%`} />
            <Pill label="État" value={`${selectedTruck.condition.toFixed(0)}%`} />
            <Pill label="Livraisons" value={String(selectedTruck.totalDeliveries)} />
            <Pill label="Gains" value={`$${selectedTruck.totalEarnings.toFixed(0)}`} valueColor="text-emerald-400" />
            {selectedTruck.cargo && <Pill label="Cargo" value={`${selectedTruck.cargo.quantity} → ${selectedTruck.cargo.type}`} valueColor="text-orange-400" />}
            {selectedTruck.assignedByAI && <Pill label="" value="🤖 Auto-dispatché" valueColor="text-amber-400" />}
          </div>
        </Card>
      )}

      {selectedTruck && selectedTruck.status === 'idle' && selectedStoreId && (
        <Card title="📦 Dispatch" accent="green">
          <div className="space-y-2">
            <div className="text-xs text-slate-400">
              Destination: <span className="text-white font-semibold">{selectedStore?.chainName} — {selectedStore?.cityName}</span>
            </div>
            <label className="text-xs text-slate-400">Quantité: {qty}</label>
            <input
              type="range"
              min="1"
              max={selectedTruck.capacity}
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <button
              onClick={() => onDispatch(selectedTruck.id, selectedStoreId, qty)}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-2.5 rounded-xl transition active:scale-95 text-sm"
            >
              Dispatcher {qty} unités
            </button>
          </div>
        </Card>
      )}

      {!selectedTruck && (
        <Card title="Tous les camions">
          <p className="text-xs text-slate-500 mb-2">Clique sur un camion sur la carte</p>
          {state.trucks.map(t => (
            <button
              key={t.id}
              onClick={() => {}}
              className="w-full text-left text-sm bg-slate-800/70 rounded-lg p-2 mb-1.5 border border-slate-700 hover:border-slate-600 transition"
            >
              <div className="flex justify-between">
                <span className="font-bold text-slate-200">{t.name}</span>
                <StatusBadge status={t.status} />
              </div>
              <div className="text-xs text-slate-400">Carb. {t.fuel.toFixed(0)}% • État {t.condition.toFixed(0)}% • Liv. {t.totalDeliveries}</div>
            </button>
          ))}
        </Card>
      )}

      {selectedTruck && selectedTruck.status === 'idle' && !selectedStoreId && (
        <div className="bg-slate-800/50 rounded-xl p-3 text-sm text-slate-400 border border-slate-700">
          Clique sur un magasin sur la carte pour choisir la destination
        </div>
      )}
    </div>
  );
}

function StoresTab({
  state,
  selectedStore,
  onNegotiate,
}: {
  state: GameState;
  selectedStore: Store | undefined;
  onNegotiate: (storeId: string, level: 1 | 2 | 3) => void;
}) {
  return (
    <div className="space-y-3">
      {selectedStore && (
        <Card title={`${selectedStore.chainName} — ${selectedStore.cityName}`}>
          <div className="text-sm space-y-1">
            <Pill label="Demande" value={`${selectedStore.demand.toFixed(0)}/100`} valueColor={selectedStore.demand > 70 ? 'text-red-400' : selectedStore.demand > 40 ? 'text-amber-400' : 'text-emerald-400'} />
            <Pill label="Contrat" value={selectedStore.contractLevel > 0 ? `Niveau ${selectedStore.contractLevel}` : 'Aucun'} />
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-400">Négocier un contrat :</p>
            <button onClick={() => onNegotiate(selectedStore.id, 1)} className="w-full bg-slate-800 hover:bg-slate-700 text-sm py-2.5 rounded-xl border border-slate-700 transition">
              L1 Base — $500 — 1.3x
            </button>
            <button onClick={() => onNegotiate(selectedStore.id, 2)} className="w-full bg-slate-800 hover:bg-slate-700 text-sm py-2.5 rounded-xl border border-slate-700 transition">
              L2 Préféré — $2,000 — 1.6x
            </button>
            <button onClick={() => onNegotiate(selectedStore.id, 3)} className="w-full bg-slate-800 hover:bg-slate-700 text-sm py-2.5 rounded-xl border border-slate-700 transition">
              L3 Exclusif — $8,000 — 1.9x
            </button>
          </div>
        </Card>
      )}

      {!selectedStore && (
        <Card title="Magasins">
          <p className="text-xs text-slate-500 mb-2">Clique sur un magasin pour négocier</p>
          <div className="space-y-1">
            {state.stores.map(s => (
              <button
                key={s.id}
                onClick={() => onNegotiate(s.id, 1)}
                className="w-full text-left text-sm bg-slate-800/70 rounded-lg p-2 flex justify-between items-center border border-slate-700 hover:border-slate-600 transition"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getChainColor(s.chainId) }} />
                  {s.chainName} — {s.cityName}
                </span>
                <span className="text-xs text-slate-400">
                  {s.contractLevel > 0 ? `L${s.contractLevel}` : '—'} | {s.demand.toFixed(0)}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function WarehousesTab({
  state,
  selectedWh,
  onBuyTruck,
  onUpgrade,
}: {
  state: GameState;
  selectedWh: Warehouse | undefined;
  onBuyTruck: (whId: string) => void;
  onUpgrade: (whId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {selectedWh && (
        <Card title={`🏭 ${selectedWh.cityName}`} accent="green">
          <div className="text-sm space-y-1 text-slate-200">
            <Pill label="Niveau" value={String(selectedWh.level)} />
            <Pill label="Capacité" value={String(selectedWh.capacity)} />
            <Pill label="Stock" value={String(Math.floor(selectedWh.stock))} />
            <Pill label="Camions" value={String(selectedWh.trucks.length)} />
            <Pill label="Personnel" value={String(selectedWh.staff.length)} />
          </div>
          <div className="mt-3 space-y-2">
            <button onClick={() => onBuyTruck(selectedWh.id)} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition active:scale-95">
              🚛 Acheter camion ($8,000)
            </button>
            {selectedWh.level < 5 && (
              <button onClick={() => onUpgrade(selectedWh.id)} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold py-2.5 rounded-xl text-sm transition active:scale-95">
                ⬆️ Améliorer Lv{selectedWh.level + 1} — ${selectedWh.level * 5000}
              </button>
            )}
          </div>
        </Card>
      )}

      {!selectedWh && (
        <Card title="Entrepôts">
          <p className="text-xs text-slate-500 mb-2">Clique sur un entrepôt sur la carte</p>
          {state.warehouses.map(wh => (
            <button
              key={wh.id}
              className="w-full text-left text-sm bg-slate-800/70 rounded-lg p-2 mb-1.5 border border-slate-700 hover:border-slate-600 transition"
            >
              <div className="flex justify-between">
                <span className="font-bold text-slate-200">{wh.cityName}</span>
                <span className="text-slate-400">Lv{wh.level}</span>
              </div>
              <div className="text-xs text-slate-400">Stock {Math.floor(wh.stock)}/{wh.capacity} • Camions {wh.trucks.length} • Staff {wh.staff.length}</div>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

function StaffTab({
  state,
  selectedWh,
  onHire,
  onFire,
}: {
  state: GameState;
  selectedWh: Warehouse | undefined;
  onHire: (whId: string, role: 'secretary' | 'dispatcher' | 'loader' | 'manager') => void;
  onFire: (whId: string, staffId: string) => void;
}) {
  const roles: { role: 'secretary' | 'dispatcher' | 'loader' | 'manager'; label: string; cost: number; salary: number; desc: string }[] = [
    { role: 'loader', label: 'Chargeur', cost: 300, salary: 175, desc: '+10 stock/jour' },
    { role: 'dispatcher', label: 'Dispatcheur', cost: 500, salary: 300, desc: 'Auto-dispatch' },
    { role: 'secretary', label: 'Secrétaire', cost: 350, salary: 200, desc: 'Gère les contrats' },
    { role: 'manager', label: 'Manager', cost: 600, salary: 400, desc: '+efficacité' },
  ];

  return (
    <div className="space-y-3">
      {selectedWh && (
        <Card title={`👥 ${selectedWh.cityName}`} accent="slate">
          <div className="space-y-1 mb-3">
            {selectedWh.staff.length === 0 && <p className="text-xs text-slate-500">Aucun employé</p>}
            {selectedWh.staff.map(s => (
              <div key={s.id} className="text-sm bg-slate-800/70 rounded-lg p-2 flex justify-between items-center border border-slate-700">
                <div className="min-w-0">
                  <div className="font-bold text-slate-200 truncate">{s.name}</div>
                  <div className="text-xs text-slate-400">{roleLabel(s.role)} • Effic. {s.efficiency}/10 • ${s.salary}/j</div>
                </div>
                <button onClick={() => onFire(selectedWh.id, s.id)} className="text-xs bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded-md shrink-0">Licencier</button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Embaucher :</p>
            {roles.map(r => (
              <button
                key={r.role}
                onClick={() => onHire(selectedWh.id, r.role)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-sm py-2.5 rounded-xl border border-slate-700 transition text-left px-3"
              >
                <span className="font-bold text-slate-200">{r.label}</span> — ${r.cost} <span className="text-slate-400 text-xs">(${r.salary}/j)</span>
                <div className="text-xs text-slate-400">{r.desc}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {!selectedWh && (
        <Card title="Personnel">
          <p className="text-xs text-slate-500 mb-2">Clique sur un entrepôt pour gérer son personnel</p>
          {state.warehouses.map(wh => (
            <div key={wh.id} className="text-sm bg-slate-800/70 rounded-lg p-2 mb-1.5 border border-slate-700">
              <div className="font-bold text-slate-200">{wh.cityName}</div>
              <div className="text-xs text-slate-400">{wh.staff.length} employés</div>
              {wh.staff.map(s => (
                <div key={s.id} className="text-xs text-slate-400 pl-2">• {s.name} ({roleLabel(s.role)})</div>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function roleLabel(role: 'secretary' | 'dispatcher' | 'loader' | 'manager') {
  const labels: Record<'secretary' | 'dispatcher' | 'loader' | 'manager', string> = {
    secretary: 'Secrétaire', dispatcher: 'Dispatcheur', loader: 'Chargeur', manager: 'Manager',
  };
  return labels[role];
}

function ContractsTab({
  state,
  onNegotiate,
}: {
  state: GameState;
  onNegotiate: (storeId: string, level: 1 | 2 | 3) => void;
}) {
  const activeContracts = state.contracts.filter(c => c.active);
  return (
    <div className="space-y-3">
      <Card title="🤝 Contrats actifs">
        {activeContracts.length === 0 && <p className="text-xs text-slate-500">Aucun contrat actif.</p>}
        {activeContracts.map(c => (
          <div key={c.id} className="text-sm bg-slate-800/70 rounded-lg p-2 mb-1.5 border border-slate-700">
            <div className="font-bold text-slate-200">{c.storeName}</div>
            <div className="text-xs text-slate-400">L{c.level} • ${c.paymentPerDelivery.toFixed(0)}/livraison • Min {c.minDeliveriesPerWeek}/sem.</div>
          </div>
        ))}
      </Card>

      <Card title="💡 Magasins sans contrat">
        <div className="space-y-1 max-h-60 overflow-auto pr-1">
          {state.stores.filter(s => s.contractLevel === 0).map(s => (
            <div key={s.id} className="text-sm bg-slate-800/70 rounded-lg p-2 flex justify-between items-center border border-slate-700">
              <span className="truncate">{s.chainName} — {s.cityName}</span>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => onNegotiate(s.id, 1)} className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded-md">L1</button>
                <button onClick={() => onNegotiate(s.id, 2)} className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-2 py-1 rounded-md">L2</button>
                <button onClick={() => onNegotiate(s.id, 3)} className="text-xs bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded-md">L3</button>
              </div>
            </div>
          ))}
          {state.stores.filter(s => s.contractLevel === 0).length === 0 && <p className="text-xs text-slate-500">Tous les magasins ont un contrat !</p>}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: 'green' | 'blue' | 'slate' }) {
  const accentClass =
    accent === 'green' ? 'border-l-4 border-l-emerald-500' :
    accent === 'blue' ? 'border-l-4 border-l-cyan-500' :
    accent === 'slate' ? 'border-l-4 border-l-slate-500' : '';
  return (
    <div className={`bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50 shadow-sm backdrop-blur-sm ${accentClass}`}>
      <h3 className="font-bold text-emerald-400 mb-2 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function Pill({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between bg-slate-900/50 rounded-lg px-2 py-1">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className={`text-xs font-bold ${valueColor || 'text-slate-200'}`}>{value}</span>
    </div>
  );
}

function getChainColor(chainId: string): string {
  const colors: Record<string, string> = {
    superc: '#f87171', iga: '#fbbf24', maxi: '#34d399', metro: '#fde047',
    provigo: '#60a5fa', walmart: '#38bdf8', costco: '#a5f3fc',
  };
  return colors[chainId] || '#9ca3af';
}
