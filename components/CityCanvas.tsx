'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { CityState, Tile, IsoView, Point, BuildingType } from '@/lib/types';
import { BUILDINGS } from '@/lib/gamedata';

const TILE_WIDTH = 48;
const TILE_HEIGHT = 28;

interface CityCanvasProps {
  state: CityState;
  view: IsoView;
  onViewChange: (view: IsoView) => void;
  onTileTap: (x: number, y: number) => void;
  onTileLongPress?: (x: number, y: number) => void;
  selectedBuilding?: BuildingType;
}

export default function CityCanvas({ state, view, onViewChange, onTileTap, selectedBuilding }: CityCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const viewRef = useRef<IsoView>(view);
  const gestureRef = useRef<{
    active: boolean;
    pointers: Map<number, Point>;
    lastCenter: Point | null;
    lastDist: number;
    panStart: Point | null;
    viewStart: IsoView | null;
  }>({ active: false, pointers: new Map(), lastCenter: null, lastDist: 0, panStart: null, viewStart: null });

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const isoToScreen = useCallback((tileX: number, tileY: number, v: IsoView, rect: DOMRect) => {
    const cx = rect.width / 2;
    const cy = rect.height / 2 - 40;
    const sx = (tileX - tileY) * (TILE_WIDTH / 2);
    const sy = (tileX + tileY) * (TILE_HEIGHT / 2);
    return {
      x: cx + (sx + v.offsetX) * v.scale,
      y: cy + (sy + v.offsetY) * v.scale,
    };
  }, []);

  const screenToIso = useCallback((screenX: number, screenY: number, v: IsoView, rect: DOMRect) => {
    const cx = rect.width / 2;
    const cy = rect.height / 2 - 40;
    const sx = (screenX - cx) / v.scale - v.offsetX;
    const sy = (screenY - cy) / v.scale - v.offsetY;
    // iso inverse: x = (sx/(w/2) + sy/(h/2))/2, y = (sy/(h/2) - sx/(w/2))/2
    const tileX = sx / (TILE_WIDTH / 2) / 2 + sy / (TILE_HEIGHT / 2) / 2;
    const tileY = sy / (TILE_HEIGHT / 2) / 2 - sx / (TILE_WIDTH / 2) / 2;
    return { x: tileX, y: tileY };
  }, []);

  const drawTileBase = useCallback((ctx: CanvasRenderingContext2D, tile: Tile, sx: number, sy: number, scale: number, highlighted: boolean) => {
    const w = TILE_WIDTH * scale;
    const h = TILE_HEIGHT * scale;
    const halfW = w / 2;
    const halfH = h / 2;

    ctx.beginPath();
    ctx.moveTo(sx, sy - halfH);
    ctx.lineTo(sx + halfW, sy);
    ctx.lineTo(sx, sy + halfH);
    ctx.lineTo(sx - halfW, sy);
    ctx.closePath();

    // Gradient based on type
    let topColor = BUILDINGS[tile.type].color;
    let leftColor = shade(topColor, -20);
    let rightColor = shade(topColor, -35);

    if (tile.type === 'empty') {
      // Grass with slight color variation
      const base = ['#10b981', '#14b8a6', '#0ea5e9', '#22c55e'][tile.variant % 4];
      topColor = base;
      leftColor = shade(base, -15);
      rightColor = shade(base, -30);
    }

    if (tile.type === 'road') {
      topColor = '#475569';
      leftColor = '#334155';
      rightColor = '#1e293b';
    }

    const grad = ctx.createLinearGradient(sx - halfW, sy - halfH, sx + halfW, sy + halfH);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, leftColor);
    ctx.fillStyle = grad;
    ctx.fill();

    // Highlight selection
    if (highlighted) {
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5 * scale;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.8 * scale;
      ctx.stroke();
    }

    // Tile sides for depth (only if has a building)
    if (tile.type !== 'empty' && tile.type !== 'road') {
      const elev = (tile.level * 6 + 4) * scale;
      // Right side
      ctx.beginPath();
      ctx.moveTo(sx + halfW, sy);
      ctx.lineTo(sx + halfW, sy - elev);
      ctx.lineTo(sx, sy - halfH - elev);
      ctx.lineTo(sx, sy - halfH);
      ctx.closePath();
      ctx.fillStyle = rightColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5 * scale;
      ctx.stroke();

      // Left side
      ctx.beginPath();
      ctx.moveTo(sx - halfW, sy);
      ctx.lineTo(sx - halfW, sy - elev);
      ctx.lineTo(sx, sy - halfH - elev);
      ctx.lineTo(sx, sy - halfH);
      ctx.closePath();
      ctx.fillStyle = leftColor;
      ctx.fill();
      ctx.stroke();
    }

    // Road markings
    if (tile.type === 'road') {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2 * scale;
      ctx.setLineDash([3 * scale, 3 * scale]);
      if (tile.roads.top || tile.roads.bottom) {
        ctx.beginPath();
        ctx.moveTo(sx, sy - halfH * 0.6);
        ctx.lineTo(sx, sy + halfH * 0.6);
        ctx.stroke();
      }
      if (tile.roads.left || tile.roads.right) {
        ctx.beginPath();
        ctx.moveTo(sx - halfW * 0.6, sy);
        ctx.lineTo(sx + halfW * 0.6, sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, []);

  const drawBuilding = useCallback((ctx: CanvasRenderingContext2D, tile: Tile, sx: number, sy: number, scale: number) => {
    if (tile.type === 'empty' || tile.type === 'road') return;
    const def = BUILDINGS[tile.type];
    const w = TILE_WIDTH * scale * 0.85;
    const h = TILE_HEIGHT * scale * 0.85;
    const halfW = w / 2;
    const halfH = h / 2;
    const levelH = (tile.level * 8 + 6) * scale;
    const roofColor = def.roofColor;

    // Building body isometric block
    const topY = sy - halfH - levelH;

    // Roof
    ctx.beginPath();
    ctx.moveTo(sx, topY - halfH);
    ctx.lineTo(sx + halfW, topY);
    ctx.lineTo(sx, topY + halfH);
    ctx.lineTo(sx - halfW, topY);
    ctx.closePath();
    const roofGrad = ctx.createLinearGradient(sx - halfW, topY - halfH, sx + halfW, topY + halfH);
    roofGrad.addColorStop(0, roofColor);
    roofGrad.addColorStop(1, shade(roofColor, -25));
    ctx.fillStyle = roofGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.6 * scale;
    ctx.stroke();

    // Chimney / details for houses
    if (tile.type === 'residential') {
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(sx + halfW * 0.2, topY - halfH * 0.5, 4 * scale, 8 * scale);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(sx + halfW * 0.2 + 2 * scale, topY - halfH * 0.5 - 2 * scale, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smoke / windows for industrial
    if (tile.type === 'industrial') {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(sx - halfW * 0.3, topY - halfH - 10 * scale, 5 * scale, 10 * scale);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(sx - halfW * 0.3 + 2.5 * scale, topY - halfH - 12 * scale, 3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Door for commercial
    if (tile.type === 'commercial') {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(sx - 4 * scale, sy);
      ctx.lineTo(sx - 4 * scale, sy - 10 * scale);
      ctx.lineTo(sx + 4 * scale, sy - 10 * scale);
      ctx.lineTo(sx + 4 * scale, sy);
      ctx.closePath();
      ctx.fill();
    }

    // Service icons / trees
    if (tile.type === 'park') {
      drawTree(ctx, sx, sy - halfH * 0.4 - levelH, scale);
      drawTree(ctx, sx - 6 * scale, sy - halfH * 0.2 - levelH, scale * 0.8);
      drawTree(ctx, sx + 6 * scale, sy - halfH * 0.6 - levelH, scale * 0.8);
    } else if (SERVICE_BUILDINGS.includes(tile.type)) {
      // Icon badge
      ctx.save();
      ctx.font = `${14 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3 * scale;
      ctx.fillText(def.icon, sx, topY);
      ctx.restore();
    }

    // Level dots
    if (tile.level > 1) {
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < tile.level - 1; i++) {
        ctx.beginPath();
        ctx.arc(sx - halfW + 4 * scale + i * 5 * scale, sy - 3 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  const drawTree = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
    // Trunk
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - 1.5 * scale, y - 2 * scale, 3 * scale, 6 * scale);
    // Leaves
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x, y - 6 * scale, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(x - 2 * scale, y - 4 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(x + 2 * scale, y - 5 * scale, 2.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    bg.addColorStop(0, '#0b3d2e');
    bg.addColorStop(1, '#021c15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const v = viewRef.current;

    // Draw tiles back-to-front for correct occlusion
    for (let y = 0; y < state.gridSize; y++) {
      for (let x = 0; x < state.gridSize; x++) {
        const tile = state.tiles[y][x];
        const p = isoToScreen(x, y, v, rect);
        const highlighted = selectedBuilding === tile.type && tile.type !== 'empty' ? false : false;
        drawTileBase(ctx, tile, p.x, p.y, v.scale, highlighted);
        drawBuilding(ctx, tile, p.x, p.y, v.scale);
      }
    }
  }, [state, selectedBuilding, isoToScreen, screenToIso, drawTileBase, drawBuilding, drawTree]);

  // Render loop with rAF
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // Gesture handlers
  const getPointerPos = (e: PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const g = gestureRef.current;
    g.pointers.set(e.pointerId, getPointerPos(e.nativeEvent));
    g.active = true;
    g.viewStart = { ...viewRef.current };

    if (g.pointers.size === 1) {
      const pos = getPointerPos(e.nativeEvent);
      g.panStart = pos;
    } else {
      g.panStart = null;
    }

    const arr = Array.from(g.pointers.values());
    if (arr.length === 2) {
      g.lastCenter = { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
      g.lastDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const g = gestureRef.current;
    if (!g.active || !g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, getPointerPos(e.nativeEvent));

    const arr = Array.from(g.pointers.values());
    if (arr.length === 1 && g.panStart && g.viewStart) {
      const dx = arr[0].x - g.panStart.x;
      const dy = arr[0].y - g.panStart.y;
      if (Math.hypot(dx, dy) > 4) {
        onViewChange({ ...g.viewStart, offsetX: g.viewStart.offsetX + dx / g.viewStart.scale, offsetY: g.viewStart.offsetY + dy / g.viewStart.scale });
      }
    } else if (arr.length === 2 && g.viewStart) {
      const center = { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
      const dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if (g.lastCenter && g.lastDist > 0) {
        const scaleDelta = dist / g.lastDist;
        let newScale = g.viewStart.scale * scaleDelta;
        newScale = Math.max(0.4, Math.min(2.5, newScale));

        // Zoom around center
        const rect = containerRef.current!.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2 - 40;
        const zoomPointX = (center.x - cx) / g.viewStart.scale - g.viewStart.offsetX;
        const zoomPointY = (center.y - cy) / g.viewStart.scale - g.viewStart.offsetY;
        const newOffsetX = center.x - cx - zoomPointX * newScale;
        const newOffsetY = center.y - cy - zoomPointY * newScale;

        onViewChange({ scale: newScale, offsetX: newOffsetX / newScale, offsetY: newOffsetY / newScale });
      }
      g.lastCenter = center;
      g.lastDist = dist;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    g.pointers.delete(e.pointerId);
    if (g.pointers.size === 0) {
      // It was a tap if no significant movement
      if (g.panStart) {
        const pos = getPointerPos(e.nativeEvent);
        const dx = pos.x - g.panStart.x;
        const dy = pos.y - g.panStart.y;
        if (Math.hypot(dx, dy) < 8 && g.viewStart) {
          const rect = containerRef.current!.getBoundingClientRect();
          const iso = screenToIso(pos.x, pos.y, g.viewStart, rect);
          const x = Math.round(iso.x);
          const y = Math.round(iso.y);
          if (x >= 0 && x < state.gridSize && y >= 0 && y < state.gridSize) {
            onTileTap(x, y);
          }
        }
      }
      g.active = false;
      g.panStart = null;
      g.viewStart = null;
      g.lastCenter = null;
      g.lastDist = 0;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden touch-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}

function shade(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

const SERVICE_BUILDINGS: readonly BuildingType[] = ['police', 'fire', 'hospital', 'park'];
