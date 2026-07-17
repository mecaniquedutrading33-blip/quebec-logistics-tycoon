// Quebec Logistics Tycoon - Game Engine
// All game logic: economy, trucks, routes, automation, staff

import type { GameState, Truck, Warehouse, Store, Contract, Staff, Point, Cargo } from './types';
import { CITIES, STORES, generateStaffName } from './gamedata';

// --- Helpers ---
export function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// --- Initial State ---
export function createInitialState(playerName: string = 'Player'): GameState {
  const toronto = CITIES.find(c => c.id === 'toronto')!;
  const ottawa = CITIES.find(c => c.id === 'ottawa')!;
  const montreal = CITIES.find(c => c.id === 'montreal')!;
  const quebec = CITIES.find(c => c.id === 'quebec')!;

  const warehouseCities = [toronto, ottawa, montreal, quebec];

  const warehouses: Warehouse[] = warehouseCities.map((city, i) => ({
    id: `wh-${i}`,
    cityId: city.id,
    cityName: city.name,
    pos: { ...city.pos },
    level: i === 0 ? 2 : 1, // Toronto starts at level 2
    capacity: i === 0 ? 500 : 300,
    stock: i === 0 ? 200 : 100,
    staff: i === 0 ? [{
      id: generateId('staff'),
      name: 'Marie Tremblay',
      role: 'manager',
      salary: 800,
      efficiency: 7,
      hiredAt: 0,
    }] : [],
    trucks: [],
  }));

  // Starting trucks (2 in Toronto)
  const trucks: Truck[] = [];
  for (let i = 0; i < 2; i++) {
    const truck: Truck = {
      id: generateId('truck'),
      name: `Camion ${i + 1}`,
      pos: { ...toronto.pos },
      route: [],
      routeIndex: 0,
      speed: 2.5,
      cargo: null,
      status: 'idle',
      destinationStoreId: null,
      destinationWarehouseId: null,
      homeWarehouseId: 'wh-0',
      capacity: 50,
      condition: 100,
      fuel: 100,
      assignedByAI: false,
      totalDeliveries: 0,
      totalEarnings: 0,
    };
    trucks.push(truck);
    warehouses[0].trucks.push(truck);
  }

  return {
    money: 50000,
    day: 1,
    tick: 0,
    warehouses,
    trucks,
    stores: STORES.map(s => ({ ...s })),
    contracts: [],
    cities: CITIES,
    staff: warehouses[0].staff,
    playerName,
    totalEarned: 0,
    totalSpent: 0,
    totalDeliveries: 0,
    reputation: 10,
    lastSave: 0,
  };
}

// --- Route Generation ---
// Simple path: warehouse -> store (straight line with slight curve)
export function generateRoute(from: Point, to: Point): Point[] {
  const waypoints: Point[] = [{ ...from }];
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    // Add slight curve
    const perpX = -(to.y - from.y) / dist(from, to);
    const perpY = (to.x - from.x) / dist(from, to);
    const curve = Math.sin(t * Math.PI) * 30;
    waypoints.push({ x: x + perpX * curve, y: y + perpY * curve });
  }
  waypoints.push({ ...to });
  return waypoints;
}

// --- Dispatch Truck ---
export function dispatchTruck(
  state: GameState,
  truckId: string,
  storeId: string,
  cargoQty: number,
  cargoType: string = 'Marchandises générales'
): boolean {
  const truck = state.trucks.find(t => t.id === truckId);
  if (!truck || truck.status !== 'idle') return false;

  const store = state.stores.find(s => s.id === storeId);
  if (!store) return false;

  const warehouse = state.warehouses.find(w => w.id === truck.homeWarehouseId);
  if (!warehouse || warehouse.stock < cargoQty) return false;

  warehouse.stock -= cargoQty;
  truck.cargo = {
    id: generateId('cargo'),
    type: cargoType,
    quantity: cargoQty,
    destinationStoreId: storeId,
    sourceWarehouseId: warehouse.id,
  };
  truck.destinationStoreId = storeId;
  truck.status = 'en_route';
  truck.route = generateRoute(truck.pos, store.pos);
  truck.routeIndex = 0;
  truck.fuel = Math.max(0, truck.fuel - 2);

  return true;
}

// --- Tick (game loop) ---
export function gameTick(state: GameState): GameState {
  const newState = { ...state };
  newState.tick++;
  newState.trucks = state.trucks.map(t => ({ ...t }));
  newState.warehouses = state.warehouses.map(w => ({ ...w, trucks: w.trucks.map(t => ({ ...t })) }));

  // Every 60 ticks = 1 day
  if (newState.tick % 60 === 0) {
    newState.day++;
    // Daily costs
    let staffCost = 0;
    for (const wh of newState.warehouses) {
      for (const s of wh.staff) {
        staffCost += s.salary;
      }
    }
    newState.money -= staffCost;
    newState.totalSpent += staffCost;

    // Truck maintenance
    for (const truck of newState.trucks) {
      truck.condition = Math.max(0, truck.condition - 0.5);
      if (truck.condition < 30) {
        // Repair cost
        const repairCost = Math.floor((100 - truck.condition) * 5);
        if (newState.money >= repairCost) {
          newState.money -= repairCost;
          newState.totalSpent += repairCost;
          truck.condition = 100;
        }
      }
      // Refuel
      if (truck.fuel < 50) {
        const fuelCost = Math.floor((100 - truck.fuel) * 0.5);
        if (newState.money >= fuelCost) {
          newState.money -= fuelCost;
          newState.totalSpent += fuelCost;
          truck.fuel = 100;
        }
      }
    }

    // Increase store demand over time
    for (const store of newState.stores) {
      store.demand = Math.min(100, store.demand + 5 + Math.random() * 10);
    }

    // Warehouse restock (passive income from suppliers)
    for (const wh of newState.warehouses) {
      const restockRate = wh.level * 20 + (wh.staff.filter(s => s.role === 'loader').length * 10);
      wh.stock = Math.min(wh.capacity, wh.stock + restockRate);
    }
  }

  // Move trucks
  for (const truck of newState.trucks) {
    if (truck.status === 'en_route' && truck.route.length > 0) {
      if (truck.routeIndex < truck.route.length) {
        const target = truck.route[truck.routeIndex];
        const d = dist(truck.pos, target);
        if (d < truck.speed) {
          truck.pos = { ...target };
          truck.routeIndex++;
        } else {
          const angle = Math.atan2(target.y - truck.pos.y, target.x - truck.pos.x);
          truck.pos.x += Math.cos(angle) * truck.speed;
          truck.pos.y += Math.sin(angle) * truck.speed;
          truck.fuel = Math.max(0, truck.fuel - 0.02);
        }
      } else {
        // Arrived at store
        if (truck.cargo && truck.destinationStoreId) {
          const store = newState.stores.find(s => s.id === truck.destinationStoreId);
          if (store) {
            const deliveryPayment = truck.cargo.quantity * 15 * (1 + store.contractLevel * 0.3);
            newState.money += deliveryPayment;
            newState.totalEarned += deliveryPayment;
            newState.totalDeliveries++;
            truck.totalDeliveries++;
            truck.totalEarnings += deliveryPayment;
            store.demand = Math.max(0, store.demand - truck.cargo.quantity * 2);
            store.lastDelivery = newState.tick;
            newState.reputation = Math.min(100, newState.reputation + 0.1);
          }
          truck.cargo = null;
          truck.destinationStoreId = null;
        }
        // Return to home warehouse
        const homeWh = newState.warehouses.find(w => w.id === truck.homeWarehouseId);
        if (homeWh) {
          const d = dist(truck.pos, homeWh.pos);
          if (d < truck.speed) {
            truck.pos = { ...homeWh.pos };
            truck.status = 'idle';
            truck.route = [];
            truck.routeIndex = 0;
          } else {
            truck.status = 'returning';
            truck.route = generateRoute(truck.pos, homeWh.pos);
            truck.routeIndex = 0;
            // Move toward home
            const angle = Math.atan2(homeWh.pos.y - truck.pos.y, homeWh.pos.x - truck.pos.x);
            truck.pos.x += Math.cos(angle) * truck.speed;
            truck.pos.y += Math.sin(angle) * truck.speed;
            truck.fuel = Math.max(0, truck.fuel - 0.02);
          }
        }
      }
    } else if (truck.status === 'returning') {
      const homeWh = newState.warehouses.find(w => w.id === truck.homeWarehouseId);
      if (homeWh) {
        const d = dist(truck.pos, homeWh.pos);
        if (d < truck.speed) {
          truck.pos = { ...homeWh.pos };
          truck.status = 'idle';
          truck.route = [];
          truck.routeIndex = 0;
        } else {
          const angle = Math.atan2(homeWh.pos.y - truck.pos.y, homeWh.pos.x - truck.pos.x);
          truck.pos.x += Math.cos(angle) * truck.speed;
          truck.pos.y += Math.sin(angle) * truck.speed;
          truck.fuel = Math.max(0, truck.fuel - 0.02);
        }
      }
    }

    // AI dispatch: if truck is idle and player has staff dispatchers
    if (truck.status === 'idle' && !truck.assignedByAI) {
      const homeWh = newState.warehouses.find(w => w.id === truck.homeWarehouseId);
      if (homeWh) {
        const hasDispatcher = homeWh.staff.some(s => s.role === 'dispatcher');
        if (hasDispatcher && homeWh.stock >= 20) {
          // Find a store with high demand and an active contract
          const contract = newState.contracts.find(c => c.active && c.level > 0);
          if (contract) {
            const store = newState.stores.find(s => s.id === contract.storeId);
            if (store && store.demand > 40 && homeWh.stock >= 20) {
              const qty = Math.min(20, homeWh.stock, truck.capacity);
              homeWh.stock -= qty;
              truck.cargo = {
                id: generateId('cargo'),
                type: 'Auto-dispatch',
                quantity: qty,
                destinationStoreId: store.id,
                sourceWarehouseId: homeWh.id,
              };
              truck.destinationStoreId = store.id;
              truck.status = 'en_route';
              truck.route = generateRoute(truck.pos, store.pos);
              truck.routeIndex = 0;
              truck.assignedByAI = true;
            }
          }
        }
      }
    }
  }

  return newState;
}

// --- Contracts ---
export function negotiateContract(state: GameState, storeId: string, level: 1 | 2 | 3): boolean {
  const store = state.stores.find(s => s.id === storeId);
  if (!store) return false;

  const costs = [0, 1000, 5000, 15000];
  const cost = costs[level];
  if (state.money < cost) return false;

  state.money -= cost;
  state.totalSpent += cost;

  // Remove existing contract for this store
  const existing = state.contracts.find(c => c.storeId === storeId);
  if (existing) {
    existing.active = false;
  }

  const contract: Contract = {
    id: generateId('contract'),
    storeId,
    storeName: store.chainName + ' ' + store.cityName,
    chainName: store.chainName,
    level,
    paymentPerDelivery: 15 * (1 + level * 0.3),
    minDeliveriesPerWeek: level * 3,
    active: true,
  };

  state.contracts.push(contract);
  store.contractLevel = level;
  return true;
}

// --- Buy Truck ---
export function buyTruck(state: GameState, warehouseId: string): boolean {
  const cost = 25000;
  if (state.money < cost) return false;

  const wh = state.warehouses.find(w => w.id === warehouseId);
  if (!wh) return false;

  state.money -= cost;
  state.totalSpent += cost;

  const truck: Truck = {
    id: generateId('truck'),
    name: `Camion ${state.trucks.length + 1}`,
    pos: { ...wh.pos },
    route: [],
    routeIndex: 0,
    speed: 2.5,
    cargo: null,
    status: 'idle',
    destinationStoreId: null,
    destinationWarehouseId: null,
    homeWarehouseId: warehouseId,
    capacity: 50,
    condition: 100,
    fuel: 100,
    assignedByAI: false,
    totalDeliveries: 0,
    totalEarnings: 0,
  };

  state.trucks.push(truck);
  wh.trucks.push(truck);
  return true;
}

// --- Upgrade Warehouse ---
export function upgradeWarehouse(state: GameState, warehouseId: string): boolean {
  const wh = state.warehouses.find(w => w.id === warehouseId);
  if (!wh) return false;

  const cost = wh.level * 20000;
  if (state.money < cost) return false;
  if (wh.level >= 5) return false;

  state.money -= cost;
  state.totalSpent += cost;
  wh.level++;
  wh.capacity = wh.level * 300;
  return true;
}

// --- Hire Staff ---
export function hireStaff(state: GameState, warehouseId: string, role: Staff['role']): boolean {
  const wh = state.warehouses.find(w => w.id === warehouseId);
  if (!wh) return false;

  const salaries: Record<Staff['role'], number> = {
    secretary: 400,
    dispatcher: 600,
    loader: 350,
    manager: 800,
  };
  const cost = salaries[role] * 2; // hiring fee
  if (state.money < cost) return false;

  state.money -= cost;
  state.totalSpent += cost;

  const staff: Staff = {
    id: generateId('staff'),
    name: generateStaffName(),
    role,
    salary: salaries[role],
    efficiency: 5 + Math.floor(Math.random() * 5),
    hiredAt: state.tick,
  };

  wh.staff.push(staff);
  state.staff.push(staff);
  return true;
}

// --- Fire Staff ---
export function fireStaff(state: GameState, warehouseId: string, staffId: string): boolean {
  const wh = state.warehouses.find(w => w.id === warehouseId);
  if (!wh) return false;

  const idx = wh.staff.findIndex(s => s.id === staffId);
  if (idx === -1) return false;

  wh.staff.splice(idx, 1);
  state.staff = state.staff.filter(s => s.id !== staffId);
  return true;
}

// --- Serialization ---
export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState | null {
  try {
    const obj = JSON.parse(json);
    return obj as GameState;
  } catch {
    return null;
  }
}