"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { WikiPage, WikiGraph, WikiGraphNode, WikiGraphEdge } from "@/lib/types";
import { getWikiGraph, getWikiPage } from "@/lib/api";

interface WikiGraphViewProps {
  wikiId: string;
  onSelectPage: (page: WikiPage) => void;
}

const TYPE_COLORS: Record<string, string> = {
  entity: "#f59e0b",
  concept: "#8b5cf6",
  source_summary: "#3b82f6",
  topic_summary: "#10b981",
  comparison: "#f97316",
  analysis: "#ec4899",
  index: "#6b7280",
  overview: "#22d3ee",
};

export function WikiGraphView({ wikiId, onSelectPage }: WikiGraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<WikiGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ nodeId: string } | { pan: true; startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const animFrameRef = useRef<number>(0);

  // Resize observer to track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const g = await getWikiGraph(wikiId);
        setGraph(g);
        // Initialize positions centered on canvas
        const pos = new Map<string, { x: number; y: number }>();
        const count = g.nodes.length;
        const cx = canvasSize.width / 2;
        const cy = canvasSize.height / 2;
        const radius = Math.min(cx, cy) * 0.6 + Math.random() * 30;
        g.nodes.forEach((n, i) => {
          const angle = (2 * Math.PI * i) / count;
          pos.set(n.id, {
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          });
        });
        // Force simulation (50 iterations)
        for (let iter = 0; iter < 50; iter++) {
          for (const a of g.nodes) {
            for (const b of g.nodes) {
              if (a.id === b.id) continue;
              const pa = pos.get(a.id)!;
              const pb = pos.get(b.id)!;
              const dx = pa.x - pb.x;
              const dy = pa.y - pb.y;
              const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
              const force = 5000 / (dist * dist);
              pa.x += (dx / dist) * force;
              pa.y += (dy / dist) * force;
            }
          }
          for (const e of g.edges) {
            const pa = pos.get(e.source);
            const pb = pos.get(e.target);
            if (!pa || !pb) continue;
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = dist * 0.01;
            pa.x += dx * force;
            pa.y += dy * force;
            pb.x -= dx * force;
            pb.y -= dy * force;
          }
        }
        positionsRef.current = pos;
      } catch (e) {
        console.error("Failed to load graph", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [wikiId, canvasSize.width, canvasSize.height]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const positions = positionsRef.current;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    for (const edge of graph.edges) {
      const from = positions.get(edge.source);
      const to = positions.get(edge.target);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const node of graph.nodes) {
      const p = positions.get(node.id);
      if (!p) continue;
      const color = TYPE_COLORS[node.page_type] || "#6b7280";
      const isHovered = hoveredNode === node.id;
      const radius = isHovered ? 10 : 7;

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = "#374151";
      ctx.font = isHovered ? "bold 11px sans-serif" : "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        node.title.length > 20 ? node.title.slice(0, 18) + "…" : node.title,
        p.x,
        p.y + radius + 14
      );
    }

    ctx.restore();
  }, [graph, hoveredNode, zoom, pan, canvasSize]);

  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    const positions = positionsRef.current;

    if (dragging && "nodeId" in dragging) {
      positions.set(dragging.nodeId, { x: mx, y: my });
      positionsRef.current = new Map(positions);
      draw();
      return;
    }

    if (dragging && "pan" in dragging) {
      setPan({
        x: dragging.startPanX + (e.clientX - rect.left - dragging.startX),
        y: dragging.startPanY + (e.clientY - rect.top - dragging.startY),
      });
      return;
    }

    // Hit test
    let found: string | null = null;
    for (const node of graph.nodes) {
      const p = positions.get(node.id);
      if (!p) continue;
      const dx = mx - p.x;
      const dy = my - p.y;
      if (dx * dx + dy * dy < 144) {
        found = node.id;
        break;
      }
    }
    setHoveredNode(found);
    canvas.style.cursor = found ? "pointer" : "grab";
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (hoveredNode) {
      setDragging({ nodeId: hoveredNode });
    } else {
      setDragging({
        pan: true,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
        startPanX: pan.x,
        startPanY: pan.y,
      });
    }
  };

  const handleMouseUp = () => setDragging(null);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(Math.max(z * factor, 0.2), 5));
  };

  const handleClick = async () => {
    if (hoveredNode && !dragging) {
      try {
        const page = await getWikiPage(wikiId, hoveredNode);
        onSelectPage(page);
      } catch { /* ignore */ }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading graph…
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No pages to visualize yet.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h2 className="text-sm font-semibold">Knowledge Graph ({graph.nodes.length} nodes, {graph.edges.length} edges)</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => setZoom((z) => Math.max(z / 1.2, 0.3))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-1.5 border-b text-[10px]">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {type}
          </span>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleClick}
        />
      </div>
    </div>
  );
}
