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

const VIEW_W = 1000;
const VIEW_H = 800;

export default function MapCanvas({ state, onTruckClick, onStoreClick, onWarehouseClick, selectedTruckId, selectedStoreId }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // View transform (pan/zoom)
  const viewRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  const toWorld = useCallback((screenX: number, screenY: number, rect: DOMRect, view: { scale: number; offsetX: number; offsetY: number }) => {
    return {
      x: (screenX - rect.left) / rect.width * VIEW_W,
      y: (screenY - rect.top) / rect.height * VIEW_H,
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Apply pan/zoom
    const view = viewRef.current;
    ctx.save();
    ctx.translate(canvas.width / (2 * dpr), canvas.height / (2 * dpr));
    ctx.scale(view.scale, view.scale);
    ctx.translate(-VIEW_W / 2 + view.offsetX, -VIEW_H / 2 + view.offsetY);

    // Background - dark green map
    const bgGrad = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    bgGrad.addColorStop(0, '#0f2e1e');
    bgGrad.addColorStop(1, '#071912');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-1000, -1000, 3000, 3000);

    // Night overlay cycle
    const dayProgress = (state.tick % 60) / 60;
    const nightAlpha = Math.max(0, Math.sin(dayProgress * Math.PI * 2) * 0.22);

    // Province borders (simplified)
    ctx.strokeStyle = '#1b4d32';
    ctx.lineWidth = 2 / view.scale;
    ctx.setLineDash([6 / view.scale, 6 / view.scale]);
    ctx.beginPath();
    ctx.moveTo(420, 0);
    ctx.lineTo(420, VIEW_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Province labels
    ctx.fillStyle = '#234d35';
    ctx.font = `bold ${24 / view.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ONTARIO', 220, 100);
    ctx.fillText('QUÉBEC', 640, 100);

    // Draw "Highway 401 / Autoroute 20" line connecting cities with gradient
    const highwayCities = ['toronto', 'oshawa', 'kingston', 'ottawa', 'gatineau', 'montreal', 'laval', 'troisrivieres', 'quebec', 'levis'];
    ctx.save();
    const roadGrad = ctx.createLinearGradient(80, 620, 740, 340);
    roadGrad.addColorStop(0, '#4a7a5a');
    roadGrad.addColorStop(1, '#3a6a4a');
    ctx.strokeStyle = roadGrad;
    ctx.lineWidth = 6 / view.scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(100, 200, 130, 0.15)';
    ctx.shadowBlur = 8 / view.scale;
    ctx.beginPath();
    for (let i = 0; i < highwayCities.length; i++) {
      const c = state.cities.find(ci => ci.id === highwayCities[i]);
      if (!c) continue;
      if (i === 0) ctx.moveTo(c.pos.x, c.pos.y);
      else ctx.lineTo(c.pos.x, c.pos.y);
    }
    ctx.stroke();
    ctx.restore();

    // City name labels
    ctx.fillStyle = '#7ca68e';
    ctx.font = `bold ${13 / view.scale}px sans-serif`;
    for (const city of state.cities) {
      ctx.fillText(city.name, city.pos.x, city.pos.y + 34 / view.scale);
    }

    // Draw truck routes
    for (const truck of state.trucks) {
      if ((truck.status === 'en_route' || truck.status === 'returning') && truck.route.length > 0) {
        ctx.save();
        ctx.strokeStyle = truck.assignedByAI ? '#fbbf24' : '#38bdf8';
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([5 / view.scale, 5 / view.scale]);
        ctx.shadowColor = truck.assignedByAI ? 'rgba(251, 191, 36, 0.35)' : 'rgba(56, 189, 248, 0.35)';
        ctx.shadowBlur = 6 / view.scale;
        ctx.beginPath();
        ctx.moveTo(truck.pos.x, truck.pos.y);
        for (let i = truck.routeIndex; i < truck.route.length; i++) {
          ctx.lineTo(truck.route[i].x, truck.route[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw warehouses
    for (const wh of state.warehouses) {
      const isSelected = false;
      const x = wh.pos.x, y = wh.pos.y;
      const s = 20 / view.scale;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - s + 2, y - s / 2 + 2, s * 2, s);

      // Building body
      ctx.fillStyle = '#bfa36f';
      ctx.strokeStyle = isSelected ? '#facc15' : '#5c4a2a';
      ctx.lineWidth = 2 / view.scale;
      ctx.fillRect(x - s, y - s / 2, s * 2, s);
      ctx.strokeRect(x - s, y - s / 2, s * 2, s);

      // Windows
      ctx.fillStyle = '#f0e6c8';
      const winW = (s * 1.2) / 3;
      const winH = s / 2.5;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x - s * 0.8 + i * (winW + 1), y - s / 4, winW, winH);
      }

      // Roof
      ctx.beginPath();
      ctx.moveTo(x - s - 3 / view.scale, y - s / 2);
      ctx.lineTo(x, y - s / 2 - 14 / view.scale);
      ctx.lineTo(x + s + 3 / view.scale, y - s / 2);
      ctx.closePath();
      ctx.fillStyle = '#8a7048';
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${12 / view.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(wh.cityName, x, y + s + 8 / view.scale);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${10 / view.scale}px sans-serif`;
      ctx.fillText(`Entrepôt Lv${wh.level} • Stock ${Math.floor(wh.stock)}/${wh.capacity}`, x, y + s + 20 / view.scale);
    }

    // Store chain icons (simple symbols)
    const chainIcon = (chainId: string) => {
      const icons: Record<string, string> = {
        superc: '🛒', iga: '🍞', maxi: '🥦', metro: '🏪', provigo: '🧴', walmart: 'W', costco: 'C',
      };
      return icons[chainId] || '•';
    };

    // Draw stores
    for (const store of state.stores) {
      const isSelected = selectedStoreId === store.id;
      const chainColors: Record<string, string> = {
        superc: '#f87171', iga: '#fbbf24', maxi: '#34d399', metro: '#fde047', provigo: '#60a5fa', walmart: '#38bdf8', costco: '#a5f3fc',
      };
      const color = chainColors[store.chainId] || '#9ca3af';
      const r = (8 + (store.contractLevel * 2)) / view.scale;

      // Glow for contracted stores
      if (store.contractLevel > 0 || isSelected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(store.pos.x, store.pos.y, r + 6 / view.scale, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? 'rgba(250, 204, 21, 0.25)' : `${color}22`;
        ctx.fill();
        ctx.restore();
      }

      // Store dot
      ctx.fillStyle = color;
      ctx.strokeStyle = isSelected ? '#facc15' : (store.contractLevel > 0 ? '#fff' : '#334155');
      ctx.lineWidth = isSelected ? 3 / view.scale : (store.contractLevel > 0 ? 2 / view.scale : 1 / view.scale);
      ctx.beginPath();
      ctx.arc(store.pos.x, store.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${(r * 1.1)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chainIcon(store.chainId), store.pos.x, store.pos.y);

      // Demand indicator (small bar above store)
      if (store.demand > 20) {
        const barW = 18 / view.scale;
        const barH = 4 / view.scale;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(store.pos.x - barW / 2, store.pos.y - r - 8 / view.scale, barW, barH);
        ctx.fillStyle = store.demand > 70 ? '#ef4444' : store.demand > 40 ? '#f59e0b' : '#22c55e';
        ctx.fillRect(store.pos.x - barW / 2, store.pos.y - r - 8 / view.scale, barW * (store.demand / 100), barH);
      }
    }

    // Draw trucks
    for (const truck of state.trucks) {
      const isSelected = selectedTruckId === truck.id;
      const x = truck.pos.x, y = truck.pos.y;

      const angle =
        truck.route.length > 0 && truck.routeIndex < truck.route.length
          ? Math.atan2(truck.route[truck.routeIndex].y - y, truck.route[truck.routeIndex].x - x)
          : 0;

      // Night headlights
      if (nightAlpha > 0.05) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        const beam = ctx.createLinearGradient(0, 0, 50 / view.scale, 0);
        beam.addColorStop(0, `rgba(255, 250, 200, ${nightAlpha * 0.55})`);
        beam.addColorStop(1, 'rgba(255, 250, 200, 0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(10 / view.scale, -4 / view.scale);
        ctx.lineTo(60 / view.scale, -18 / view.scale);
        ctx.lineTo(60 / view.scale, 18 / view.scale);
        ctx.lineTo(10 / view.scale, 4 / view.scale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-12 / view.scale + 2, -7 / view.scale + 2, 24 / view.scale, 14 / view.scale);

      // Body
      ctx.fillStyle = isSelected ? '#facc15' : (truck.status === 'idle' ? '#64748b' : '#38bdf8');
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1 / view.scale;
      ctx.fillRect(-12 / view.scale, -7 / view.scale, 24 / view.scale, 14 / view.scale);
      ctx.strokeRect(-12 / view.scale, -7 / view.scale, 24 / view.scale, 14 / view.scale);

      // Cab
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-12 / view.scale, -7 / view.scale, 8 / view.scale, 14 / view.scale);

      // Cargo indicator
      if (truck.cargo) {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(-3 / view.scale, -4 / view.scale, 10 / view.scale, 8 / view.scale);
      }

      // AI indicator
      if (truck.assignedByAI) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = `${8 / view.scale}px sans-serif`;
        ctx.fillText('IA', -3 / view.scale, 14 / view.scale);
      }

      ctx.restore();

      // Selection ring
      if (isSelected) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2 / view.scale;
        ctx.setLineDash([4 / view.scale, 4 / view.scale]);
        ctx.beginPath();
        ctx.arc(x, y, 18 / view.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Night overlay
    if (nightAlpha > 0) {
      ctx.fillStyle = `rgba(10, 20, 40, ${nightAlpha})`;
      ctx.fillRect(-1000, -1000, 3000, 3000);
    }

    ctx.restore();

    // --- HUD OVERLAYS (screen space) ---
    const pad = 12;
    const hudScale = Math.max(1, 1 / view.scale * 0.8);

    // Compass
    ctx.save();
    ctx.translate(canvas.width / dpr - pad - 42, pad + 42);
    ctx.strokeStyle = '#e2e8f0';
    ctx.fillStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(0, 24);
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -18);
    ctx.fillText('E', 18, 0);
    ctx.restore();

    // Scale indicator
    ctx.save();
    ctx.translate(pad, canvas.height / dpr - pad - 18);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(60, 0);
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.moveTo(60, -4);
    ctx.lineTo(60, 4);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('≈ 200 km', 30, 14);
    ctx.restore();
  }, [state, selectedTruckId, selectedStoreId, toWorld]);

  // Animation loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // Handle clicks and touch
  function handlePointer(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = toWorld(e.clientX, e.clientY, rect, viewRef.current);

    // Trucks (24px radius)
    for (const truck of state.trucks) {
      if (dist({ x, y }, truck.pos) < 24) {
        onTruckClick?.(truck.id);
        return;
      }
    }
    // Stores (20px radius)
    for (const store of state.stores) {
      if (dist({ x, y }, store.pos) < 20) {
        onStoreClick?.(store.id);
        return;
      }
    }
    // Warehouses (30px radius)
    for (const wh of state.warehouses) {
      if (dist({ x, y }, wh.pos) < 30) {
        onWarehouseClick?.(wh.id);
        return;
      }
    }
  }

  // Pan / pinch zoom handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let pointers = new Map<number, { x: number; y: number }>();
    let initialPinchDist = 0;
    let initialScale = 1;
    let initialOffsetX = 0;
    let initialOffsetY = 0;
    let panStart = { x: 0, y: 0 };

    const getDist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        initialPinchDist = getDist(pts[0], pts[1]);
        initialScale = viewRef.current.scale;
      } else if (pointers.size === 1) {
        initialOffsetX = viewRef.current.offsetX;
        initialOffsetY = viewRef.current.offsetY;
        panStart = { x: e.clientX, y: e.clientY };
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const d = getDist(pts[0], pts[1]);
        if (initialPinchDist > 0) {
          const newScale = Math.min(Math.max(initialScale * (d / initialPinchDist), 0.6), 3.5);
          viewRef.current.scale = newScale;
        }
      } else if (pointers.size === 1) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        viewRef.current.offsetX = initialOffsetX + dx / viewRef.current.scale;
        viewRef.current.offsetY = initialOffsetY + dy / viewRef.current.scale;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        initialPinchDist = 0;
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative touch-none select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointer}
        className="w-full h-full block rounded-lg cursor-pointer touch-none"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
}
