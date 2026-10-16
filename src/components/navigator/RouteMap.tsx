import { useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import type { FloorId, GraphNode } from '../../types/graph';
import { FLOOR_DEFS, ORIGINAL_MAP_HEIGHT, ORIGINAL_MAP_WIDTH } from '../../types/graph';

interface RouteMapProps {
  floor: FloorId;
  pathNodes: GraphNode[];
  /** Index into pathNodes for “current step” highlight; -1 = show full path. */
  focusIndex: number;
}

export function RouteMap({ floor, pathNodes, focusIndex }: RouteMapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [imgSize, setImgSize] = useState({ w: 2000, h: 1955 });

  const floorMeta = FLOOR_DEFS.find((f) => f.id === floor)!;
  const floorPath = useMemo(
    () => pathNodes.filter((n) => n.floor === floor),
    [pathNodes, floor],
  );

  const mapToDisplay = (x: number, y: number) => ({
    dx: (x / ORIGINAL_MAP_WIDTH) * imgSize.w,
    dy: (y / ORIGINAL_MAP_HEIGHT) * imgSize.h,
  });

  const pathKey = floorPath.map((n) => n.id).join('|');

  // Fit / center on path when floor or path changes
  useEffect(() => {
    if (!floorPath.length || !viewportRef.current) return;
    const pts = floorPath.map((n) => ({
      dx: (n.x / ORIGINAL_MAP_WIDTH) * imgSize.w,
      dy: (n.y / ORIGINAL_MAP_HEIGHT) * imgSize.h,
    }));
    const minX = Math.min(...pts.map((p) => p.dx));
    const maxX = Math.max(...pts.map((p) => p.dx));
    const minY = Math.min(...pts.map((p) => p.dy));
    const maxY = Math.max(...pts.map((p) => p.dy));
    const pad = 80;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const bw = Math.max(maxX - minX, 120) + pad * 2;
    const bh = Math.max(maxY - minY, 120) + pad * 2;
    const nextScale = Math.min(1.2, Math.max(0.2, Math.min(vw / bw, vh / bh)));
    setScale(nextScale);
    setPan({
      x: vw / 2 - ((minX + maxX) / 2) * nextScale,
      y: vh / 2 - ((minY + maxY) / 2) * nextScale,
    });
  }, [floor, pathKey, imgSize.w, imgSize.h, floorPath]);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(3, Math.max(0.15, s * factor)));
  };

  const polyline = floorPath.map((n) => {
    const { dx, dy } = mapToDisplay(n.x, n.y);
    return `${dx},${dy}`;
  });

  const focusNode =
    focusIndex >= 0 && focusIndex < pathNodes.length
      ? pathNodes[focusIndex]
      : null;
  const focusOnFloor = focusNode?.floor === floor ? focusNode : null;

  const start = floorPath[0];
  const end = floorPath[floorPath.length - 1];

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-stone-200"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onWheel={onWheel}
      onPointerDown={(e) => {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        setPan({
          x: dragStart.current.panX + (e.clientX - dragStart.current.x),
          y: dragStart.current.panY + (e.clientY - dragStart.current.y),
        });
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
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
          src={floorMeta.imagePath}
          alt={`${floorMeta.label} floor plan`}
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
          {polyline.length >= 2 && (
            <polyline
              points={polyline.join(' ')}
              fill="none"
              stroke="#b91c1c"
              strokeWidth={7 / scale}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.95}
            />
          )}
          {start && (
            <circle
              cx={mapToDisplay(start.x, start.y).dx}
              cy={mapToDisplay(start.x, start.y).dy}
              r={10 / scale}
              fill="#16a34a"
              stroke="#fff"
              strokeWidth={2 / scale}
            />
          )}
          {end && end !== start && (
            <circle
              cx={mapToDisplay(end.x, end.y).dx}
              cy={mapToDisplay(end.x, end.y).dy}
              r={10 / scale}
              fill="#dc2626"
              stroke="#fff"
              strokeWidth={2 / scale}
            />
          )}
          {focusOnFloor && (
            <circle
              cx={mapToDisplay(focusOnFloor.x, focusOnFloor.y).dx}
              cy={mapToDisplay(focusOnFloor.x, focusOnFloor.y).dy}
              r={14 / scale}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={3 / scale}
            />
          )}
        </svg>
      </div>
      <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium tracking-wide text-white">
        {floorMeta.label} floor
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs text-white/90">
        Scroll to zoom · drag to pan
      </div>
    </div>
  );
}
