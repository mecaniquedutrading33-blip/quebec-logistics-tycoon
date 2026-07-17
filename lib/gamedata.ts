// Quebec Logistics Tycoon - Map Data
// Cities from Toronto to Quebec with real store chains

import type { City, StoreChain, Store, Point } from './types';

// Canvas coordinate space: 0-1000 in both axes
// Toronto is left, Quebec City is right, roughly following the corridor

export const CITIES: City[] = [
  { id: 'toronto',     name: 'Toronto',      province: 'ON', pos: { x: 80,  y: 620 }, isWarehouse: true },
  { id: 'oshawa',      name: 'Oshawa',       province: 'ON', pos: { x: 140, y: 590 }, isWarehouse: false },
  { id: 'kingston',    name: 'Kingston',     province: 'ON', pos: { x: 290, y: 540 }, isWarehouse: false },
  { id: 'ottawa',      name: 'Ottawa',       province: 'ON', pos: { x: 360, y: 460 }, isWarehouse: true },
  { id: 'gatineau',    name: 'Gatineau',     province: 'QC', pos: { x: 385, y: 445 }, isWarehouse: false },
  { id: 'montreal',    name: 'Montréal',     province: 'QC', pos: { x: 480, y: 380 }, isWarehouse: true },
  { id: 'laval',       name: 'Laval',        province: 'QC', pos: { x: 510, y: 360 }, isWarehouse: false },
  { id: 'sherbrooke',  name: 'Sherbrooke',   province: 'QC', pos: { x: 530, y: 470 }, isWarehouse: false },
  { id: 'troisrivieres', name: 'Trois-Rivières', province: 'QC', pos: { x: 620, y: 360 }, isWarehouse: false },
  { id: 'quebec',      name: 'Québec',       province: 'QC', pos: { x: 720, y: 320 }, isWarehouse: true },
  { id: 'levis',       name: 'Lévis',        province: 'QC', pos: { x: 740, y: 340 }, isWarehouse: false },
  { id: 'saguenay',    name: 'Saguenay',     province: 'QC', pos: { x: 680, y: 180 }, isWarehouse: false },
  { id: 'rimouski',    name: 'Rimouski',     province: 'QC', pos: { x: 820, y: 250 }, isWarehouse: false },
];

export const STORE_CHAINS: StoreChain[] = [
  { id: 'superc',   name: 'Super C',    color: '#e63946', cities: ['montreal','laval','sherbrooke','troisrivieres','quebec','levis','saguenay'] },
  { id: 'iga',      name: 'IGA',        color: '#f4a261', cities: ['montreal','laval','sherbrooke','troisrivieres','quebec','levis','rimouski','saguenay','gatineau'] },
  { id: 'maxi',     name: 'Maxi',       color: '#2a9d8f', cities: ['montreal','laval','troisrivieres','quebec','levis','saguenay'] },
  { id: 'metro',    name: 'Métro',      color: '#e9c46a', cities: ['montreal','laval','sherbrooke','troisrivieres','quebec','levis','rimouski'] },
  { id: 'provigo',  name: 'Provigo',    color: '#457b9d', cities: ['montreal','laval','quebec','levis','saguenay','rimouski'] },
  { id: 'walmart',  name: 'Walmart',    color: '#0077b6', cities: ['montreal','laval','sherbrooke','quebec','levis','saguenay','gatineau','ottawa'] },
  { id: 'costco',   name: 'Costco',     color: '#a8dadc', cities: ['montreal','laval','quebec','levis','ottawa'] },
];

// Generate stores from chains
function generateStores(): Store[] {
  const stores: Store[] = [];
  let idx = 0;
  for (const chain of STORE_CHAINS) {
    for (const cityId of chain.cities) {
      const city = CITIES.find(c => c.id === cityId);
      if (!city) continue;
      // Spread stores slightly around the city center
      const angle = (idx * 137.5) * Math.PI / 180;
      const radius = 25 + (idx % 3) * 15;
      const pos: Point = {
        x: city.pos.x + Math.cos(angle) * radius,
        y: city.pos.y + Math.sin(angle) * radius,
      };
      stores.push({
        id: `store-${idx}`,
        chainId: chain.id,
        chainName: chain.name,
        cityId: city.id,
        cityName: city.name,
        pos,
        demand: 30 + Math.floor(Math.random() * 50),
        contractLevel: 0,
        lastDelivery: 0,
      });
      idx++;
    }
  }
  return stores;
}

export const STORES: Store[] = generateStores();

// Staff names
export const STAFF_NAMES = [
  'Marie Tremblay', 'Jean Gagnon', 'Sophie Martin', 'Pierre Bélanger',
  'Isabelle Côté', 'Michel Roy', 'Nathalie Bouchard', 'Daniel Lavoie',
  'Julie Pelletier', 'Marc Fortin', 'Caroline Gauthier', 'Steve Boucher',
  'Véronique Morin', 'Patrick Dubois', 'Annie Lévesque', 'François Côté',
  'Mélissa Bergeron', 'Maxime Beaulieu', 'Karine Cloutier', 'Sébastien Proulx',
];

export function generateStaffName(): string {
  return STAFF_NAMES[Math.floor(Math.random() * STAFF_NAMES.length)];
}