import type { BuildingGraph } from '../types/graph';
import { FLOOR_DEFS, ORIGINAL_MAP_HEIGHT, ORIGINAL_MAP_WIDTH } from '../types/graph';
import sampleGraph from '../data/sample-graph.json';

export function emptyGraph(): BuildingGraph {
  return {
    version: 1,
    coordinateSpace: {
      width: ORIGINAL_MAP_WIDTH,
      height: ORIGINAL_MAP_HEIGHT,
      unit: 'map-pixels',
      note: 'x/y align to official McCormick Tech PNGs (~4000×3910). Display images in public/floor-plans/ are half-res (~2000px); editor scales clicks to this frame.',
    },
    floors: FLOOR_DEFS.map((f) => ({ ...f })),
    nodes: [],
    edges: [],
  };
}

export function loadSampleGraph(): BuildingGraph {
  return structuredClone(sampleGraph) as BuildingGraph;
}

export function downloadGraphJson(graph: BuildingGraph, filename = 'technav-graph.json') {
  const blob = new Blob([JSON.stringify(graph, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseGraphJson(text: string): BuildingGraph {
  const data = JSON.parse(text) as BuildingGraph;
  if (data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    throw new Error('Invalid TechNav graph JSON (expected version 1 with nodes/edges).');
  }
  return data;
}

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
