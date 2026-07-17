'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Truck, Store } from '@/lib/types';
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
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load game on mount
  useEffect(() => {
    (async () => {
      const saved = await loadGame();
      if (saved) {
        const deserialized = deserializeState(saved);
        if (deserialized) {
          setState(deserialized);
          setShowIntro(false);
        }
      }
      setLoaded(true);
    })();
  }, []);

  // Game tick loop - every 500ms
  useEffect(() => {
    if (!loaded || showIntro) return;
    tickRef.current = setInterval(() => {
      setState(prev => gameTick(prev));
    }, 500);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [loaded, showIntro]);

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
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [state]);

  // Start new game
  const startGame = () => {
    const name = playerName.trim() || 'Emerick';
    setState(createInitialState(name));
    setShowIntro(false);
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
      dispatchTruck(next, truckId, storeId, qty);
      return next;
    });
  };

  const handleNegotiate = (storeId: string, level: 1 | 2 | 3) => {
    setState(prev => {
      const next = { ...prev };
      negotiateContract(next, storeId, level);
      return next;
    });
  };

  const handleBuyTruck = (whId: string) => {
    setState(prev => {
      const next = { ...prev };
      buyTruck(next, whId);
      return next;
    });
  };

  const handleUpgradeWh = (whId: string) => {
    setState(prev => {
      const next = { ...prev };
      upgradeWarehouse(next, whId);
      return next;
    });
  };

  const handleHire = (whId: string, role: 'secretary' | 'dispatcher' | 'loader' | 'manager') => {
    setState(prev => {
      const next = { ...prev };
      hireStaff(next, whId, role);
      return next;
    });
  };

  const handleFire = (whId: string, staffId: string) => {
    setState(prev => {
      const next = { ...prev };
      fireStaff(next, whId, staffId);
      return next;
    });
  };

  // --- INTRO SCREEN ---
  if (showIntro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-950 to-blue-950 text-white">
        <div className="max-w-md w-full mx-4 bg-black/40 rounded-xl p-8 backdrop-blur">
          <h1 className="text-4xl font-bold text-center mb-2 text-green-400">🚛 Québec Logistics Tycoon</h1>
          <p className="text-center text-gray-400 mb-6">Gère tes entrepôts, livre les magasins du Québec, deviens le roi de la logistique !</p>
          <input
            type="text"
            placeholder="Ton nom de joueur"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg mb-4 border border-gray-700 focus:border-green-500 outline-none"
            onKeyDown={e => e.key === 'Enter' && startGame()}
          />
          <button
            onClick={startGame}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition"
          >
            Commencer à jouer
          </button>
          {loaded && (
            <p className="text-center text-xs text-gray-500 mt-4">
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

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="bg-black/60 backdrop-blur border-b border-gray-800 px-4 py-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-green-400">🚛 Québec Logistics Tycoon</h1>
          <span className="text-sm text-gray-400">Jour {state.day}</span>
          <span className="text-sm font-bold text-green-400">${state.money.toLocaleString()}</span>
          <span className="text-sm text-yellow-400">⭐ {state.reputation.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {saveStatus === 'saving' ? '💾 Sauvegarde...' : saveStatus === 'saved' ? '✅ Sauvegardé' : saveStatus === 'error' ? '❌ Erreur' : ''}
          </span>
          <button onClick={handleSave} className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded">Sauvegarder</button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 p-2 overflow-auto">
          <MapCanvas
            state={state}
            onTruckClick={handleTruckClick}
            onStoreClick={handleStoreClick}
            onWarehouseClick={handleWarehouseClick}
            selectedTruckId={selectedTruckId}
            selectedStoreId={selectedStoreId}
          />
        </div>

        {/* Side panel */}
        <div className="w-full lg:w-96 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-2 border-b border-gray-800">
            {(['overview', 'trucks', 'stores', 'warehouses', 'staff', 'contracts'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2 py-1 text-xs rounded transition ${
                  tab === t ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t === 'overview' ? 'Vue' : t === 'trucks' ? 'Camions' : t === 'stores' ? 'Magasins' : t === 'warehouses' ? 'Entrepôts' : t === 'staff' ? 'Personnel' : 'Contrats'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {tab === 'overview' && <OverviewTab state={state} />}
            {tab === 'trucks' && (
              <TrucksTab
                state={state}
                selectedTruck={selectedTruck}
                selectedStoreId={selectedStoreId}
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
    </div>
  );
}

// --- Tab Components ---

function OverviewTab({ state }: { state: GameState }) {
  return (
    <div className="space-y-3">
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="font-bold text-green-400 mb-2">📊 Statistiques</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>💰 Argent: <span className="text-green-400 font-bold">${state.money.toLocaleString()}</span></div>
          <div>📅 Jour: <span className="text-white">{state.day}</span></div>
          <div>🚛 Camions: <span className="text-white">{state.trucks.length}</span></div>
          <div>🏭 Entrepôts: <span className="text-white">{state.warehouses.length}</span></div>
          <div>👥 Personnel: <span className="text-white">{state.staff.length}</span></div>
          <div>📦 Livraisons: <span className="text-white">{state.totalDeliveries}</span></div>
          <div>📈 Revenu total: <span className="text-green-400">${state.totalEarned.toLocaleString()}</span></div>
          <div>📉 Dépenses: <span className="text-red-400">${state.totalSpent.toLocaleString()}</span></div>
          <div>⭐ Réputation: <span className="text-yellow-400">{state.reputation.toFixed(1)}/100</span></div>
          <div>🤝 Contrats: <span className="text-white">{state.contracts.filter(c => c.active).length}</span></div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="font-bold text-green-400 mb-2">🚛 Camions actifs</h3>
        {state.trucks.length === 0 && <p className="text-gray-500 text-sm">Aucun camion</p>}
        {state.trucks.map(t => (
          <div key={t.id} className="text-xs bg-gray-700 rounded p-2 mb-1">
            <div className="flex justify-between">
              <span className="font-bold">{t.name}</span>
              <span className={
                t.status === 'idle' ? 'text-gray-400' :
                t.status === 'en_route' ? 'text-blue-400' :
                t.status === 'returning' ? 'text-yellow-400' : 'text-gray-400'
              }>{t.status === 'en_route' ? 'En route' : t.status === 'idle' ? 'Idle' : t.status === 'returning' ? 'Retour' : t.status}</span>
            </div>
            <div className="text-gray-400">Carburant: {t.fuel.toFixed(0)}% | État: {t.condition.toFixed(0)}% | Livraisons: {t.totalDeliveries}</div>
            {t.cargo && <div className="text-orange-400">📦 {t.cargo.quantity} unités → {t.cargo.type}</div>}
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="font-bold text-green-400 mb-2">🏭 Entrepôts</h3>
        {state.warehouses.map(wh => (
          <div key={wh.id} className="text-xs bg-gray-700 rounded p-2 mb-1">
            <div className="flex justify-between">
              <span className="font-bold">{wh.cityName}</span>
              <span className="text-gray-400">Niveau {wh.level}</span>
            </div>
            <div className="text-gray-400">Stock: {Math.floor(wh.stock)}/{wh.capacity} | Personnel: {wh.staff.length}</div>
            <div className="w-full bg-gray-900 h-2 rounded mt-1">
              <div className="bg-green-500 h-2 rounded" style={{ width: `${(wh.stock / wh.capacity) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrucksTab({
  state,
  selectedTruck,
  selectedStoreId,
  onDispatch,
}: {
  state: GameState;
  selectedTruck: Truck | undefined;
  selectedStoreId: string | null;
  onDispatch: (truckId: string, storeId: string, qty: number) => void;
}) {
  const [qty, setQty] = useState(20);
  return (
    <div className="space-y-3">
      {selectedTruck && (
        <div className="bg-blue-900/40 rounded-lg p-3 border border-blue-700">
          <h3 className="font-bold text-blue-400 mb-2">🚛 {selectedTruck.name}</h3>
          <div className="text-sm space-y-1">
            <div>Statut: <span className="font-bold">{selectedTruck.status}</span></div>
            <div>Capacité: {selectedTruck.capacity}</div>
            <div>Carburant: {selectedTruck.fuel.toFixed(0)}%</div>
            <div>État: {selectedTruck.condition.toFixed(0)}%</div>
            <div>Livraisons: {selectedTruck.totalDeliveries}</div>
            <div>Gains: ${selectedTruck.totalEarnings.toFixed(0)}</div>
            {selectedTruck.cargo && (
              <div className="text-orange-400">📦 Cargo: {selectedTruck.cargo.quantity} → {selectedTruck.cargo.type}</div>
            )}
            {selectedTruck.assignedByAI && <div className="text-yellow-400">🤖 Auto-dispatché</div>}
          </div>
        </div>
      )}

      {selectedTruck && selectedTruck.status === 'idle' && selectedStoreId && (
        <div className="bg-gray-800 rounded-lg p-3">
          <h4 className="font-bold text-green-400 mb-2">Dispatch vers magasin</h4>
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Quantité: {qty}</label>
            <input type="range" min="1" max={selectedTruck.capacity} value={qty} onChange={e => setQty(Number(e.target.value))} className="w-full" />
            <button
              onClick={() => onDispatch(selectedTruck.id, selectedStoreId, qty)}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded"
            >
              📦 Dispatcher {qty} unités
            </button>
          </div>
        </div>
      )}

      {!selectedTruck && (
        <div>
          <h3 className="font-bold text-green-400 mb-2">Tous les camions</h3>
          <p className="text-xs text-gray-500 mb-2">Clique sur un camion sur la carte pour le sélectionner</p>
          {state.trucks.map(t => (
            <div key={t.id} className="text-sm bg-gray-800 rounded p-2 mb-1">
              <div className="flex justify-between">
                <span className="font-bold">{t.name}</span>
                <span className={
                  t.status === 'idle' ? 'text-gray-400' :
                  t.status === 'en_route' ? 'text-blue-400' :
                  'text-yellow-400'
                }>{t.status}</span>
              </div>
              <div className="text-xs text-gray-400">Fuel: {t.fuel.toFixed(0)}% | État: {t.condition.toFixed(0)}% | Livraisons: {t.totalDeliveries}</div>
            </div>
          ))}
        </div>
      )}

      {selectedTruck && selectedTruck.status === 'idle' && !selectedStoreId && (
        <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-400">
          Clique sur un magasin sur la carte pour sélectionner la destination
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
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="font-bold mb-2" style={{ color: getChainColor(selectedStore.chainId) }}>
            {selectedStore.chainName} — {selectedStore.cityName}
          </h3>
          <div className="text-sm space-y-1">
            <div>Demande: <span className="font-bold">{selectedStore.demand.toFixed(0)}/100</span></div>
            <div>Contrat: Niveau {selectedStore.contractLevel}</div>
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-400">Négocier un contrat:</p>
            <button onClick={() => onNegotiate(selectedStore.id, 1)} className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded">
              Niveau 1 — Base ($1,000) — 1.3x paiement
            </button>
            <button onClick={() => onNegotiate(selectedStore.id, 2)} className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded">
              Niveau 2 — Préféré ($5,000) — 1.6x paiement
            </button>
            <button onClick={() => onNegotiate(selectedStore.id, 3)} className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded">
              Niveau 3 — Exclusif ($15,000) — 1.9x paiement
            </button>
          </div>
        </div>
      )}
      {!selectedStore && (
        <div>
          <h3 className="font-bold text-green-400 mb-2">Magasins</h3>
          <p className="text-xs text-gray-500 mb-2">Clique sur un magasin pour négocier un contrat</p>
          <div className="space-y-1">
            {state.stores.map(s => (
              <div key={s.id} className="text-sm bg-gray-800 rounded p-2 flex justify-between items-center">
                <span>
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getChainColor(s.chainId) }} />
                  {s.chainName} — {s.cityName}
                </span>
                <span className="text-xs">
                  {s.contractLevel > 0 ? `Contrat L${s.contractLevel}` : 'Aucun'} | Demande: {s.demand.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
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
  selectedWh: GameState['warehouses'][0] | undefined;
  onBuyTruck: (whId: string) => void;
  onUpgrade: (whId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {selectedWh && (
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="font-bold text-green-400 mb-2">🏭 Entrepôt — {selectedWh.cityName}</h3>
          <div className="text-sm space-y-1">
            <div>Niveau: {selectedWh.level}</div>
            <div>Capacité: {selectedWh.capacity}</div>
            <div>Stock: {Math.floor(selectedWh.stock)}</div>
            <div>Camions: {selectedWh.trucks.length}</div>
            <div>Personnel: {selectedWh.staff.length}</div>
          </div>
          <div className="mt-3 space-y-2">
            <button onClick={() => onBuyTruck(selectedWh.id)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-sm">
              🚛 Acheter camion ($25,000)
            </button>
            {selectedWh.level < 5 && (
              <button onClick={() => onUpgrade(selectedWh.id)} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 rounded text-sm">
                ⬆️ Améliorer (Niveau {selectedWh.level + 1}) — ${selectedWh.level * 20000}
              </button>
            )}
          </div>
        </div>
      )}
      {!selectedWh && (
        <div>
          <h3 className="font-bold text-green-400 mb-2">Entrepôts</h3>
          <p className="text-xs text-gray-500 mb-2">Clique sur un entrepôt sur la carte</p>
          {state.warehouses.map(wh => (
            <div key={wh.id} className="text-sm bg-gray-800 rounded p-2 mb-1">
              <div className="flex justify-between">
                <span className="font-bold">{wh.cityName}</span>
                <span className="text-gray-400">Lv{wh.level}</span>
              </div>
              <div className="text-xs text-gray-400">Stock: {Math.floor(wh.stock)}/{wh.capacity} | Camions: {wh.trucks.length} | Staff: {wh.staff.length}</div>
            </div>
          ))}
        </div>
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
  selectedWh: GameState['warehouses'][0] | undefined;
  onHire: (whId: string, role: 'secretary' | 'dispatcher' | 'loader' | 'manager') => void;
  onFire: (whId: string, staffId: string) => void;
}) {
  const roles: { role: 'secretary' | 'dispatcher' | 'loader' | 'manager'; label: string; cost: number; desc: string }[] = [
    { role: 'loader', label: 'Chargeur', cost: 700, desc: '+10 stock/ jour par chargeur' },
    { role: 'dispatcher', label: 'Dispatcheur', cost: 1200, desc: 'Auto-dispatche les camions idle' },
    { role: 'secretary', label: 'Secrétaire', cost: 800, desc: 'Gère les contrats automatiquement' },
    { role: 'manager', label: 'Manager', cost: 1600, desc: 'Améliore l\'efficacité globale' },
  ];

  return (
    <div className="space-y-3">
      {selectedWh && (
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="font-bold text-green-400 mb-2">👥 Personnel — {selectedWh.cityName}</h3>
          <div className="space-y-1 mb-3">
            {selectedWh.staff.length === 0 && <p className="text-xs text-gray-500">Aucun employé</p>}
            {selectedWh.staff.map(s => (
              <div key={s.id} className="text-sm bg-gray-700 rounded p-2 flex justify-between items-center">
                <div>
                  <span className="font-bold">{s.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{s.role} | Efficacité: {s.efficiency}/10 | ${s.salary}/j</span>
                </div>
                <button onClick={() => onFire(selectedWh.id, s.id)} className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded">Licencier</button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Embaucher:</p>
            {roles.map(r => (
              <button
                key={r.role}
                onClick={() => onHire(selectedWh.id, r.role)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-sm py-2 rounded text-left px-3"
              >
                <span className="font-bold">{r.label}</span> — ${r.cost} <br />
                <span className="text-xs text-gray-400">{r.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!selectedWh && (
        <div>
          <h3 className="font-bold text-green-400 mb-2">Personnel</h3>
          <p className="text-xs text-gray-500 mb-2">Clique sur un entrepôt pour gérer son personnel</p>
          <div className="space-y-1">
            {state.warehouses.map(wh => (
              <div key={wh.id} className="text-sm bg-gray-800 rounded p-2">
                <div className="font-bold">{wh.cityName}</div>
                <div className="text-xs text-gray-400">{wh.staff.length} employés</div>
                {wh.staff.map(s => (
                  <div key={s.id} className="text-xs text-gray-400 pl-2">• {s.name} ({s.role})</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="font-bold text-green-400 mb-2">🤝 Contrats actifs</h3>
        {activeContracts.length === 0 && <p className="text-xs text-gray-500">Aucun contrat actif. Va dans l'onglet Magasins et clique sur un magasin pour négocier.</p>}
        {activeContracts.map(c => (
          <div key={c.id} className="text-sm bg-gray-700 rounded p-2 mb-1">
            <div className="font-bold">{c.storeName}</div>
            <div className="text-xs text-gray-400">Niveau {c.level} | Paiement: ${c.paymentPerDelivery.toFixed(0)}/livraison | Min: {c.minDeliveriesPerWeek}/semaine</div>
          </div>
        ))}
      </div>
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="font-bold text-green-400 mb-2">💡 Magasins sans contrat</h3>
        <div className="space-y-1 max-h-60 overflow-auto">
          {state.stores.filter(s => s.contractLevel === 0).map(s => (
            <div key={s.id} className="text-sm bg-gray-700 rounded p-2 flex justify-between items-center">
              <span>{s.chainName} — {s.cityName}</span>
              <div className="space-x-1">
                <button onClick={() => onNegotiate(s.id, 1)} className="text-xs bg-green-700 hover:bg-green-600 px-2 py-1 rounded">L1</button>
                <button onClick={() => onNegotiate(s.id, 2)} className="text-xs bg-yellow-700 hover:bg-yellow-600 px-2 py-1 rounded">L2</button>
                <button onClick={() => onNegotiate(s.id, 3)} className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded">L3</button>
              </div>
            </div>
          ))}
          {state.stores.filter(s => s.contractLevel === 0).length === 0 && <p className="text-xs text-gray-500">Tous les magasins ont un contrat!</p>}
        </div>
      </div>
    </div>
  );
}

function getChainColor(chainId: string): string {
  const colors: Record<string, string> = {
    superc: '#e63946', iga: '#f4a261', maxi: '#2a9d8f', metro: '#e9c46a',
    provigo: '#457b9d', walmart: '#0077b6', costco: '#a8dadc',
  };
  return colors[chainId] || '#888';
}