import type { BuildingGraph } from '../types/graph';
import { FLOOR_DEFS, ORIGINAL_MAP_HEIGHT, ORIGINAL_MAP_WIDTH } from '../types/graph';

export function emptyGraph(): BuildingGraph {
  return {
    version: 1,
    coordinateSpace: {
      width: ORIGINAL_MAP_WIDTH,
      height: ORIGINAL_MAP_HEIGHT,
      unit: 'map-pixels',
      note: 'x/y align to official McCormick Tech PNGs (~4000×3910).',
    },
    floors: FLOOR_DEFS.map((f) => ({ ...f })),
    nodes: [],
    edges: [],
  };
}

/** Load graph from public/data (keeps the JS bundle small). */
export async function fetchBuildingGraph(): Promise<BuildingGraph> {
  const res = await fetch('/data/building-graph.json');
  if (!res.ok) throw new Error(`Failed to load building graph (${res.status})`);
  return (await res.json()) as BuildingGraph;
}
