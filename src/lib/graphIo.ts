import type { BuildingGraph } from '../types/graph';
import { FLOOR_DEFS, ORIGINAL_MAP_HEIGHT, ORIGINAL_MAP_WIDTH } from '../types/graph';
import buildingGraph from '../data/building-graph.json';

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

export function loadBuildingGraph(): BuildingGraph {
  return structuredClone(buildingGraph) as BuildingGraph;
}
