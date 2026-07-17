'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { GameState, Truck, Point } from '../lib/types';

interface MapCanvasProps {
  state: GameState;
  onTruckClick?: (truckId: string) => void;
  onStoreClick?: (storeId: string) => void;
  onWarehouseClick?: (whId: string) => void;
  selectedTruckId?: string | null;
  selectedStoreId?: string | null;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export default function MapCanvas({ state, onTruckClick, onStoreClick, onWarehouseClick, selectedTruckId, selectedStoreId }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1000;
    const H = 800;
    canvas.width = W;
    canvas.height = H;

    // Background - dark green map
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#1a3a2a');
    bgGrad.addColorStop(1, '#0d2818');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Draw province borders (simplified)
    ctx.strokeStyle = '#2a5a3a';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(420, 0);
    ctx.lineTo(420, 800);
    ctx.stroke();
    ctx.setLineDash([]);

    // Province labels
    ctx.fillStyle = '#3a6a4a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('ONTARIO', 200, 100);
    ctx.fillText('QUÉBEC', 600, 100);

    // Draw "Highway 401 / Autoroute 20" line connecting cities
    ctx.strokeStyle = '#4a7a5a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const highwayCities = ['toronto','oshawa','kingston','ottawa','gatineau','montreal','laval','troisrivieres','quebec','levis'];
    for (let i = 0; i < highwayCities.length; i++) {
      const c = state.cities.find(ci => ci.id === highwayCities[i]);
      if (!c) continue;
      if (i === 0) ctx.moveTo(c.pos.x, c.pos.y);
      else ctx.lineTo(c.pos.x, c.pos.y);
    }
    ctx.stroke();

    // Draw truck routes
    for (const truck of state.trucks) {
      if (truck.status === 'en_route' && truck.route.length > 0) {
        ctx.strokeStyle = truck.assignedByAI ? '#ffaa00' : '#00aaff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(truck.pos.x, truck.pos.y);
        for (let i = truck.routeIndex; i < truck.route.length; i++) {
          ctx.lineTo(truck.route[i].x, truck.route[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw warehouses
    for (const wh of state.warehouses) {
      const isSelected = false;
      ctx.fillStyle = '#8a7a5a';
      ctx.strokeStyle = isSelected ? '#ffff00' : '#5a4a2a';
      ctx.lineWidth = isSelected ? 3 : 2;

      // Building shape
      const x = wh.pos.x, y = wh.pos.y, s = 18;
      ctx.fillRect(x - s, y - s/2, s * 2, s);
      ctx.strokeRect(x - s, y - s/2, s * 2, s);
      
      // Roof
      ctx.beginPath();
      ctx.moveTo(x - s - 3, y - s/2);
      ctx.lineTo(x, y - s/2 - 12);
      ctx.lineTo(x + s + 3, y - s/2);
      ctx.closePath();
      ctx.fillStyle = '#6a5a3a';
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(wh.cityName, x, y + s + 5);
      ctx.fillStyle = '#aaa';
      ctx.font = '9px sans-serif';
      ctx.fillText(`Entrepôt Lv${wh.level} | Stock: ${Math.floor(wh.stock)}/${wh.capacity}`, x, y + s + 16);
      ctx.textAlign = 'left';
    }

    // Draw stores
    for (const store of state.stores) {
      const isSelected = selectedStoreId === store.id;
      // Color by chain
      const chainColors: Record<string, string> = {
        superc: '#e63946', iga: '#f4a261', maxi: '#2a9d8f', metro: '#e9c46a',
        provigo: '#457b9d', walmart: '#0077b6', costco: '#a8dadc',
      };
      const color = chainColors[store.chainId] || '#888';
      
      // Store dot
      const r = 6 + (store.contractLevel * 2);
      ctx.fillStyle = color;
      ctx.strokeStyle = isSelected ? '#ffff00' : (store.contractLevel > 0 ? '#fff' : '#444');
      ctx.lineWidth = isSelected ? 3 : (store.contractLevel > 0 ? 2 : 1);
      
      ctx.beginPath();
      ctx.arc(store.pos.x, store.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Demand indicator (small bar above store)
      if (store.demand > 20) {
        const barW = 16;
        const barH = 3;
        ctx.fillStyle = '#333';
        ctx.fillRect(store.pos.x - barW/2, store.pos.y - r - 6, barW, barH);
        ctx.fillStyle = store.demand > 70 ? '#ff4444' : store.demand > 40 ? '#ffaa00' : '#44aa44';
        ctx.fillRect(store.pos.x - barW/2, store.pos.y - r - 6, barW * (store.demand / 100), barH);
      }
    }

    // Draw trucks
    for (const truck of state.trucks) {
      const isSelected = selectedTruckId === truck.id;
      const x = truck.pos.x, y = truck.pos.y;
      
      // Truck body
      ctx.save();
      ctx.translate(x, y);
      
      const angle = truck.route.length > 0 && truck.routeIndex < truck.route.length
        ? Math.atan2(truck.route[truck.routeIndex].y - y, truck.route[truck.routeIndex].x - x)
        : 0;
      ctx.rotate(angle);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-10 + 2, -6 + 2, 20, 12);
      
      // Body
      ctx.fillStyle = isSelected ? '#ffff00' : (truck.status === 'idle' ? '#888' : '#4488ff');
      ctx.fillRect(-10, -6, 20, 12);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.strokeRect(-10, -6, 20, 12);
      
      // Cargo indicator
      if (truck.cargo) {
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(-8, -4, 16, 8);
      }

      // AI indicator
      if (truck.assignedByAI) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = '8px sans-serif';
        ctx.fillText('AI', -5, 12);
      }
      
      ctx.restore();

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Legend
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, 200, 120);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('LÉGENDE', 15, 25);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#8a7a5a';
    ctx.fillText('■ Entrepôt', 15, 40);
    ctx.fillStyle = '#4488ff';
    ctx.fillText('■ Camion en route', 15, 55);
    ctx.fillStyle = '#888';
    ctx.fillText('■ Camion idle', 15, 70);
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('--- Route auto (AI)', 15, 85);
    ctx.fillStyle = '#00aaff';
    ctx.fillText('--- Route manuelle', 15, 100);
    ctx.fillStyle = '#ff4444';
    ctx.fillText('■ Demande élevée magasin', 15, 115);
  }, [state, selectedTruckId, selectedStoreId]);

  // Animation loop
  useEffect(() => {
    draw();
  }, [draw]);

  // Click handler
  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check truck click
    for (const truck of state.trucks) {
      if (dist({ x, y }, truck.pos) < 14) {
        onTruckClick?.(truck.id);
        return;
      }
    }

    // Check store click
    for (const store of state.stores) {
      if (dist({ x, y }, store.pos) < 12) {
        onStoreClick?.(store.id);
        return;
      }
    }

    // Check warehouse click
    for (const wh of state.warehouses) {
      if (dist({ x, y }, wh.pos) < 22) {
        onWarehouseClick?.(wh.id);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full h-auto rounded-lg cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}