// Canada City Builder - Game engine

import type { CityState, GameStats, Tile, BuildingType, TaxLevel } from './types';
import { BUILDINGS, CATEGORY_ORDER, GRID_SIZE, SERVICE_BUILDINGS, START_MONEY, TAX_LEVELS, TICK_MS, ZONE_BUILDINGS } from './gamedata';

export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyTile(x: number, y: number): Tile {
  return {
    x,
    y,
    type: 'empty',
    level: 1,
    variant: Math.floor(Math.random() * 4),
    roads: { top: false, right: false, bottom: false, left: false },
    roadDistance: Infinity,
    population: 0,
    jobs: 0,
  };
}

export function createEmptyGrid(size: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      row.push(createEmptyTile(x, y));
    }
    grid.push(row);
  }
  return grid;
}

export function createInitialState(playerName: string = 'Joueur'): CityState {
  const tiles = createEmptyGrid(GRID_SIZE);
  const now = new Date().toISOString();
  return {
    playerId: 'player-cb-1',
    playerName: playerName.trim() || 'Joueur',
    gridSize: GRID_SIZE,
    tiles,
    stats: {
      money: START_MONEY,
      population: 0,
      happiness: 75,
      taxLevel: 'medium',
      tick: 0,
      totalEarned: 0,
      totalSpent: 0,
      roadsBuilt: 0,
      buildingsBuilt: 0,
    },
    selectedCategory: 'road',
    selectedBuilding: 'road',
    toasts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getBuilding(type: BuildingType) {
  return BUILDINGS[type];
}

export function getCategoryBuildings(category: import('./types').ToolbarCategory): BuildingType[] {
  if (category === 'bulldoze') return ['empty'];
  if (category === 'road') return ['road'];
  return (Object.keys(BUILDINGS) as BuildingType[]).filter(t => BUILDINGS[t].category === category);
}

function inBounds(state: CityState, x: number, y: number): boolean {
  return x >= 0 && x < state.gridSize && y >= 0 && y < state.gridSize;
}

function cloneTile(tile: Tile): Tile {
  return { ...tile, roads: { ...tile.roads } };
}

function cloneGrid(tiles: Tile[][]): Tile[][] {
  return tiles.map(row => row.map(cloneTile));
}

function cloneStats(stats: GameStats): GameStats {
  return { ...stats };
}

export function canPlaceBuilding(state: CityState, x: number, y: number, type: BuildingType): { ok: boolean; reason?: string; cost?: number } {
  if (!inBounds(state, x, y)) return { ok: false, reason: 'Hors de la carte' };
  const tile = state.tiles[y][x];
  if (type === 'empty') return { ok: true, cost: 0 };

  // Bulldoze / build over existing
  const def = BUILDINGS[type];
  const cost = def.cost;
  if (state.stats.money < cost) return { ok: false, reason: 'Fonds insuffisants', cost };

  if (type === 'road') {
    if (tile.type === 'road') return { ok: false, reason: 'Route déjà présente' };
    return { ok: true, cost };
  }

  // Zones must be adjacent to a road
  if (ZONE_BUILDINGS.includes(type)) {
    const adjacentRoad = hasAdjacentRoad(state, x, y);
    if (!adjacentRoad) return { ok: false, reason: 'Nécessite une route adjacente', cost };
  }

  // Services also prefer roads but can be built without (with penalty)
  if (SERVICE_BUILDINGS.includes(type) && !hasAdjacentRoad(state, x, y)) {
    // still allowed
  }

  if (tile.type !== 'empty' && tile.type !== 'road') {
    return { ok: false, reason: 'Terrain occupé', cost };
  }

  return { ok: true, cost };
}

function hasAdjacentRoad(state: CityState, x: number, y: number): boolean {
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(state, nx, ny) && state.tiles[ny][nx].type === 'road') return true;
  }
  return false;
}

function updateRoadConnections(tiles: Tile[][]): void {
  const size = tiles.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = tiles[y][x];
      if (tile.type !== 'road') continue;
      tile.roads = {
        top: y > 0 && tiles[y - 1][x].type === 'road',
        right: x < size - 1 && tiles[y][x + 1].type === 'road',
        bottom: y < size - 1 && tiles[y + 1][x].type === 'road',
        left: x > 0 && tiles[y][x - 1].type === 'road',
      };
    }
  }
}

function updateRoadDistances(state: CityState): void {
  const size = state.gridSize;
  // Reset
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      state.tiles[y][x].roadDistance = state.tiles[y][x].type === 'road' ? 0 : Infinity;
    }
  }
  // BFS from all roads
  const queue: [number, number, number][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (state.tiles[y][x].type === 'road') queue.push([x, y, 0]);
    }
  }
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  let head = 0;
  while (head < queue.length) {
    const [x, y, d] = queue[head++];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      if (state.tiles[ny][nx].roadDistance > d + 1) {
        state.tiles[ny][nx].roadDistance = d + 1;
        queue.push([nx, ny, d + 1]);
      }
    }
  }
}

export function placeBuilding(state: CityState, x: number, y: number, type: BuildingType): { state: CityState; placed: boolean; message?: string; cost?: number } {
  const check = canPlaceBuilding(state, x, y, type);
  if (!check.ok) {
    return { state, placed: false, message: check.reason, cost: check.cost };
  }

  const nextState: CityState = {
    ...state,
    tiles: cloneGrid(state.tiles),
    stats: cloneStats(state.stats),
    toasts: [],
    updatedAt: new Date().toISOString(),
  };
  const tile = nextState.tiles[y][x];
  const cost = type === 'empty' ? 0 : BUILDINGS[type].cost;

  // If replacing a building with road or empty, count as spent too? Demolition is free.
  if (cost > 0) {
    nextState.stats.money -= cost;
    nextState.stats.totalSpent += cost;
  }

  if (type === 'empty') {
    tile.type = 'empty';
    tile.level = 1;
    tile.roads = { top: false, right: false, bottom: false, left: false };
  } else if (type === 'road') {
    tile.type = 'road';
    tile.level = 1;
    nextState.stats.roadsBuilt += 1;
  } else {
    tile.type = type;
    tile.level = 1;
    nextState.stats.buildingsBuilt += 1;
  }

  updateRoadConnections(nextState.tiles);
  updateRoadDistances(nextState);

  const message = type === 'road' ? 'Route construite' : `${BUILDINGS[type].label} construit`;
  return { state: nextState, placed: true, message, cost };
}

export function upgradeBuilding(state: CityState, x: number, y: number): { state: CityState; upgraded: boolean; message?: string } {
  if (!inBounds(state, x, y)) return { state, upgraded: false, message: 'Hors de la carte' };
  const tile = state.tiles[y][x];
  if (tile.type === 'empty' || tile.type === 'road') return { state, upgraded: false, message: 'Non améliorable' };
  if (tile.level >= 3) return { state, upgraded: false, message: 'Niveau max atteint' };

  const cost = BUILDINGS[tile.type].cost * 0.6 * tile.level;
  if (state.stats.money < cost) return { state, upgraded: false, message: 'Fonds insuffisants' };

  const nextState: CityState = {
    ...state,
    tiles: cloneGrid(state.tiles),
    stats: cloneStats(state.stats),
    toasts: [],
    updatedAt: new Date().toISOString(),
  };
  const nextTile = nextState.tiles[y][x];
  nextTile.level += 1;
  nextState.stats.money -= cost;
  nextState.stats.totalSpent += cost;

  return { state: nextState, upgraded: true, message: `${BUILDINGS[nextTile.type].label} niveau ${nextTile.level}` };
}

export function setTaxLevel(state: CityState, level: TaxLevel): CityState {
  if (state.stats.taxLevel === level) return state;
  return {
    ...state,
    stats: { ...state.stats, taxLevel: level },
    toasts: [],
    updatedAt: new Date().toISOString(),
  };
}

export function setSelectedCategory(state: CityState, category: import('./types').ToolbarCategory): CityState {
  const buildings = getCategoryBuildings(category);
  const selectedBuilding = buildings[0] ?? 'road';
  return {
    ...state,
    selectedCategory: category,
    selectedBuilding,
    toasts: [],
  };
}

export function setSelectedBuilding(state: CityState, type: BuildingType): CityState {
  return {
    ...state,
    selectedBuilding: type,
    toasts: [],
  };
}

function countNearby(state: CityState, x: number, y: number, radius: number, types: BuildingType[]): number {
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(state, nx, ny)) continue;
      if (types.includes(state.tiles[ny][nx].type)) count++;
    }
  }
  return count;
}

function calculateTileValue(state: CityState, x: number, y: number): { population: number; jobs: number; income: number } {
  const tile = state.tiles[y][x];
  const def = BUILDINGS[tile.type];
  let levelMult = 1 + (tile.level - 1) * 0.5;
  const taxRate = TAX_LEVELS[state.stats.taxLevel].rate;

  if (tile.type === 'residential') {
    // Population depends on road access, nearby parks, nearby commercial jobs, not too close to industry
    const roadBonus = tile.roadDistance <= 1 ? 1 : tile.roadDistance <= 2 ? 0.6 : tile.roadDistance <= 3 ? 0.25 : 0;
    const parkBonus = Math.min(0.5, countNearby(state, x, y, 3, ['park']) * 0.15);
    const jobBonus = Math.min(0.6, countNearby(state, x, y, 5, ['commercial', 'industrial']) * 0.08);
    const industryPenalty = Math.min(0.5, countNearby(state, x, y, 3, ['industrial']) * 0.15);
    const pop = Math.round(def.population * levelMult * (1 + parkBonus + jobBonus - industryPenalty) * roadBonus);
    const income = Math.max(0, Math.round(pop * 15 * taxRate));
    return { population: pop, jobs: 0, income };
  }

  if (tile.type === 'commercial') {
    // Commercial needs nearby population
    const roadBonus = tile.roadDistance <= 1 ? 1 : tile.roadDistance <= 2 ? 0.5 : 0;
    const populationNearby = countNearby(state, x, y, 5, ['residential']);
    const demand = Math.min(1 + populationNearby * 0.15, 3);
    const income = Math.round(def.income * levelMult * demand * roadBonus);
    return { population: 0, jobs: Math.round(def.jobs * levelMult * roadBonus), income };
  }

  if (tile.type === 'industrial') {
    const roadBonus = tile.roadDistance <= 1 ? 1 : tile.roadDistance <= 2 ? 0.6 : 0;
    const income = Math.round(def.income * levelMult * roadBonus);
    return { population: Math.round(def.population * levelMult), jobs: Math.round(def.jobs * levelMult * roadBonus), income };
  }

  if (SERVICE_BUILDINGS.includes(tile.type)) {
    return { population: 0, jobs: Math.round(def.jobs * levelMult), income: def.income };
  }

  return { population: 0, jobs: 0, income: 0 };
}

export function gameTick(state: CityState): CityState {
  const nextState: CityState = {
    ...state,
    tiles: cloneGrid(state.tiles),
    stats: cloneStats(state.stats),
    toasts: [],
    updatedAt: new Date().toISOString(),
  };
  nextState.stats.tick += 1;

  updateRoadDistances(nextState);

  let totalPop = 0;
  let totalJobs = 0;
  let totalIncome = 0;
  let totalMaintenance = 0;
  let happiness = 75;

  // Base values from buildings
  for (let y = 0; y < nextState.gridSize; y++) {
    for (let x = 0; x < nextState.gridSize; x++) {
      const tile = nextState.tiles[y][x];
      const def = BUILDINGS[tile.type];
      if (tile.type === 'empty' || tile.type === 'road') continue;
      const value = calculateTileValue(nextState, x, y);
      tile.population = value.population;
      tile.jobs = value.jobs;
      totalPop += value.population;
      totalJobs += value.jobs;
      totalIncome += value.income;
      totalMaintenance += def.maintenance * tile.level;
      happiness += def.happiness;
    }
  }

  // Happiness modifiers
  const taxDelta = TAX_LEVELS[nextState.stats.taxLevel].happinessDelta;
  happiness += taxDelta;
  // Unemployment / job balance
  if (totalJobs < totalPop * 0.3) happiness -= 8;
  else if (totalJobs > totalPop * 0.8) happiness += 5;
  // Too much industry hurts happiness
  const industrialCount = countType(nextState, 'industrial');
  const residentialCount = countType(nextState, 'residential');
  if (residentialCount > 0 && industrialCount > residentialCount * 0.5) happiness -= 5;
  // Services boost (diminishing returns)
  const serviceCount = SERVICE_BUILDINGS.reduce((acc, t) => acc + countType(nextState, t), 0);
  happiness += Math.min(15, serviceCount * 1.5);

  nextState.stats.population = totalPop;
  nextState.stats.happiness = clamp(happiness, 0, 100);
  const netIncome = totalIncome - totalMaintenance;
  nextState.stats.money += netIncome;
  if (netIncome > 0) nextState.stats.totalEarned += netIncome;
  else nextState.stats.totalSpent += Math.abs(netIncome);

  // Low money warning
  if (nextState.stats.money < 2000 && state.stats.money >= 2000) {
    nextState.toasts.push({ id: generateId(), message: 'Attention : fonds faibles !', type: 'warning' });
  }
  if (nextState.stats.money < 0) {
    nextState.stats.money = 0;
    nextState.toasts.push({ id: generateId(), message: 'Ville en faillite !', type: 'warning' });
  }

  return nextState;
}

function countType(state: CityState, type: BuildingType): number {
  let count = 0;
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      if (state.tiles[y][x].type === type) count++;
    }
  }
  return count;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function addToast(state: CityState, message: string, type: 'success' | 'warning' | 'info'): CityState {
  return {
    ...state,
    toasts: [...state.toasts, { id: generateId(), message, type }],
  };
}

export function clearToasts(state: CityState): CityState {
  return { ...state, toasts: [] };
}

export function serializeState(state: CityState): string {
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

export function deserializeState(json: string): CityState | null {
  try {
    const data = JSON.parse(json) as Partial<CityState>;
    if (!data.tiles || !data.stats) return null;
    return {
      playerId: (data.playerId as string) || 'player-cb-1',
      playerName: (data.playerName as string) || 'Joueur',
      gridSize: (data.gridSize as number) || GRID_SIZE,
      tiles: data.tiles as Tile[][],
      stats: data.stats as GameStats,
      selectedCategory: (data.selectedCategory as import('./types').ToolbarCategory) || 'road',
      selectedBuilding: (data.selectedBuilding as BuildingType) || 'road',
      toasts: [],
      createdAt: (data.createdAt as string) || new Date().toISOString(),
      updatedAt: (data.updatedAt as string) || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export { GRID_SIZE, START_MONEY, TICK_MS, BUILDINGS, CATEGORY_ORDER, TAX_LEVELS };
