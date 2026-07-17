// Canada City Builder - Game Types

export type TaxLevel = 'low' | 'medium' | 'high';

export type BuildingType =
  | 'empty'
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'police'
  | 'fire'
  | 'hospital'
  | 'park';

export type ToolbarCategory = 'road' | 'residential' | 'commercial' | 'industrial' | 'services' | 'bulldoze';

export type Tile = {
  x: number;
  y: number;
  type: BuildingType;
  level: number; // 1-3
  variant: number; // visual variety
  roads: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  // cache for rendering: distance to nearest road / population / jobs
  roadDistance: number;
  population: number;
  jobs: number;
};

export type BuildingDef = {
  type: BuildingType;
  category: ToolbarCategory;
  label: string;
  description: string;
  cost: number;
  income: number; // per tick
  maintenance: number; // per tick
  population: number;
  jobs: number;
  happiness: number;
  color: string;
  roofColor: string;
  minLevel: number;
  icon: string;
};

export type GameStats = {
  money: number;
  population: number;
  happiness: number; // 0-100
  taxLevel: TaxLevel;
  tick: number;
  totalEarned: number;
  totalSpent: number;
  roadsBuilt: number;
  buildingsBuilt: number;
};

export type CityState = {
  playerId: string;
  playerName: string;
  gridSize: number;
  tiles: Tile[][];
  stats: GameStats;
  selectedCategory: ToolbarCategory;
  selectedBuilding: BuildingType;
  toasts: ToastEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ToastEvent = {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'info';
};

export type IsoView = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type Point = { x: number; y: number };
