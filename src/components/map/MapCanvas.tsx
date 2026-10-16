import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { FloorId, GraphEdge, GraphNode, NodeType } from '../../types/graph';
import { NODE_TYPE_COLORS, ORIGINAL_MAP_HEIGHT, ORIGINAL_MAP_WIDTH } from '../../types/graph';

export type EditorMode = 'pan' | 'place' | 'connect' | 'select';

interface MapCanvasProps {
  imagePath: string;
  floor: FloorId;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mode: EditorMode;
  selectedNodeId: string | null;
  connectFromId: string | null;
  onPlaceNode: (x: number, y: number) => void;
  onSelectNode: (id: string | null) => void;
  onConnectNode: (id: string) => void;
}

const HIT_RADIUS_MAP_PX = 40;

export function MapCanvas({
  imagePath,
  floor,
  nodes,
  edges,
  mode,
  selectedNodeId,
  connectFromId,
  onPlaceNode,
  onSelectNode,
  onConnectNode,
}: MapCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [imgSize, setImgSize] = useState({ w: 2000, h: 1955 });

  const floorNodes = nodes.filter((n) => n.floor === floor);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const floorEdges = edges.filter((e) => {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    return a?.floor === floor && b?.floor === floor;
  });

  const toMapCoords = (clientX: number, clientY: number) => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const rect = vp.getBoundingClientRect();
    const localX = (clientX - rect.left - pan.x) / scale;
    const localY = (clientY - rect.top - pan.y) / scale;
    // local coords are in display-image pixels; map to original frame
    const x = (localX / imgSize.w) * ORIGINAL_MAP_WIDTH;
    const y = (localY / imgSize.h) * ORIGINAL_MAP_HEIGHT;
    return { x, y };
  };

  const findNodeNear = (mapX: number, mapY: number): GraphNode | null => {
    let best: GraphNode | null = null;
    let bestDist = HIT_RADIUS_MAP_PX;
    for (const n of floorNodes) {
      const d = Math.hypot(n.x - mapX, n.y - mapY);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(4, Math.max(0.1, s * factor)));
  };

  const onPointerDown = (e: PointerEvent) => {
    if (mode === 'pan' || e.button === 1 || e.shiftKey) {
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    const coords = toMapCoords(e.clientX, e.clientY);
    if (!coords) return;
    const hit = findNodeNear(coords.x, coords.y);

    if (mode === 'place') {
      if (!hit) onPlaceNode(coords.x, coords.y);
      return;
    }
    if (mode === 'connect') {
      if (hit) onConnectNode(hit.id);
      return;
    }
    // select
    onSelectNode(hit?.id ?? null);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };

  const onPointerUp = () => setDragging(false);

  const mapToDisplay = (x: number, y: number) => ({
    dx: (x / ORIGINAL_MAP_WIDTH) * imgSize.w,
    dy: (y / ORIGINAL_MAP_HEIGHT) * imgSize.h,
  });

  const cursor =
    mode === 'pan' || dragging
      ? dragging
        ? 'grabbing'
        : 'grab'
      : mode === 'place'
        ? 'crosshair'
        : 'default';

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-stone-200"
      style={{ cursor }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="origin-top-left will-change-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          width: imgSize.w,
          height: imgSize.h,
        }}
      >
        <img
          src={imagePath}
          alt={`${floor} floor plan`}
          draggable={false}
          className="pointer-events-none select-none"
          style={{ width: imgSize.w, height: imgSize.h }}
          onLoad={(e) => {
            const img = e.currentTarget;
            setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
        <svg
          className="pointer-events-none absolute inset-0"
          width={imgSize.w}
          height={imgSize.h}
          viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
        >
          {floorEdges.map((edge) => {
            const a = nodeById.get(edge.from);
            const b = nodeById.get(edge.to);
            if (!a || !b) return null;
            const pa = mapToDisplay(a.x, a.y);
            const pb = mapToDisplay(b.x, b.y);
            return (
              <line
                key={edge.id}
                x1={pa.dx}
                y1={pa.dy}
                x2={pb.dx}
                y2={pb.dy}
                stroke="#0f172a"
                strokeWidth={3 / scale}
                strokeOpacity={0.75}
              />
            );
          })}
          {floorNodes.map((node) => {
            const { dx, dy } = mapToDisplay(node.x, node.y);
            const r = 8 / scale;
            const selected = node.id === selectedNodeId || node.id === connectFromId;
            return (
              <g key={node.id}>
                <circle
                  cx={dx}
                  cy={dy}
                  r={r}
                  fill={NODE_TYPE_COLORS[node.type as NodeType]}
                  stroke={selected ? '#fbbf24' : '#fff'}
                  strokeWidth={(selected ? 3 : 1.5) / scale}
                />
                {node.label && (
                  <text
                    x={dx + r + 4 / scale}
                    y={dy + 4 / scale}
                    fill="#0f172a"
                    fontSize={14 / scale}
                    fontFamily="system-ui, sans-serif"
                    stroke="#fff"
                    strokeWidth={3 / scale}
                    paintOrder="stroke"
                  >
                    {node.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        zoom {(scale * 100).toFixed(0)}% · shift-drag or Pan mode to move · scroll to zoom
      </div>
    </div>
  );
}
