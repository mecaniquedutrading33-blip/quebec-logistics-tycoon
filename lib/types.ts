// Quebec Logistics Tycoon - Game Types

export type Point = { x: number; y: number };

export type City = {
  id: string;
  name: string;
  province: 'ON' | 'QC';
  pos: Point; // canvas coordinates (normalized 0-1000)
  isWarehouse: boolean;
};

export type StoreChain = {
  id: string;
  name: string;
  color: string;
  cities: string[]; // city ids where they have stores
};

export type Store = {
  id: string;
  chainId: string;
  chainName: string;
  cityId: string;
  cityName: string;
  pos: Point;
  demand: number; // 0-100, how much they need restocking
  contractLevel: 0 | 1 | 2 | 3; // 0=none, 1=basic, 2=preferred, 3=exclusive
  lastDelivery: number; // timestamp
};

export type Cargo = {
  id: string;
  type: string;
  quantity: number;
  destinationStoreId: string;
  sourceWarehouseId: string;
};

export type Truck = {
  id: string;
  name: string;
  pos: Point;
  route: Point[]; // waypoints to destination
  routeIndex: number;
  speed: number; // units per tick
  cargo: Cargo | null;
  status: 'idle' | 'loading' | 'en_route' | 'unloading' | 'returning';
  destinationStoreId: string | null;
  destinationWarehouseId: string | null;
  homeWarehouseId: string;
  capacity: number;
  condition: number; // 0-100
  fuel: number; // 0-100
  assignedByAI: boolean;
  totalDeliveries: number;
  totalEarnings: number;
};

export type Warehouse = {
  id: string;
  cityId: string;
  cityName: string;
  pos: Point;
  level: number;
  capacity: number;
  stock: number;
  staff: Staff[];
  trucks: Truck[];
};

export type Staff = {
  id: string;
  name: string;
  role: 'secretary' | 'dispatcher' | 'loader' | 'manager';
  salary: number;
  efficiency: number; // 1-10
  hiredAt: number;
};

export type Contract = {
  id: string;
  storeId: string;
  storeName: string;
  chainName: string;
  level: 0 | 1 | 2 | 3;
  paymentPerDelivery: number;
  minDeliveriesPerWeek: number;
  active: boolean;
};

export type GameState = {
  money: number;
  day: number;
  tick: number;
  warehouses: Warehouse[];
  trucks: Truck[];
  stores: Store[];
  contracts: Contract[];
  cities: City[];
  staff: Staff[];
  playerName: string;
  totalEarned: number;
  totalSpent: number;
  totalDeliveries: number;
  reputation: number;
  lastSave: number;
};