/**
 * TechNav indoor navigation graph.
 *
 * Coordinates (x, y) are in **original map-pixel space** aligned to the
 * official McCormick Tech floor-plan PNGs (~4000 × 3910). Display images
 * in `public/floor-plans/` may be downscaled; the editor maps clicks back
 * to this coordinate space.
 */

export const ORIGINAL_MAP_WIDTH = 4000;
export const ORIGINAL_MAP_HEIGHT = 3910;

export type FloorId =
  | 'basement'
  | 'ground'
  | 'first'
  | 'second'
  | 'third'
  | 'fourth';

export type NodeType =
  | 'room'
  | 'corridor'
  | 'entrance'
  | 'stair'
  | 'elevator'
  | 'junction';

export interface FloorMeta {
  id: FloorId;
  label: string;
  /** Path under public/, e.g. `/floor-plans/ground.png` */
  imagePath: string;
  /** Original PNG pixel size (coordinate space). */
  mapWidth: number;
  mapHeight: number;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  floor: FloorId;
  /** X in original map-pixel space (0 … mapWidth). */
  x: number;
  /** Y in original map-pixel space (0 … mapHeight). */
  y: number;
  /** Human label — room id (e.g. "L265") or short name. */
  label?: string;
  /**
   * For stair/elevator: shared vertical shaft id so multi-floor edges
   * can connect matching connectors later.
   */
  connectorGroup?: string;
}

export interface GraphEdge {
  id: string;
  /** Source node id. */
  from: string;
  /** Target node id. */
  to: string;
  /**
   * Optional weight override (default = Euclidean distance in map pixels).
   * Use for stairs/elevators spanning floors.
   */
  weight?: number;
  /** True when the edge crosses floors (stair/elevator). */
  multiFloor?: boolean;
}

export interface BuildingGraph {
  version: 1;
  /** Canonical coordinate frame for all node x/y. */
  coordinateSpace: {
    width: number;
    height: number;
    unit: 'map-pixels';
    note: string;
  };
  floors: FloorMeta[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const FLOOR_DEFS: FloorMeta[] = [
  {
    id: 'basement',
    label: 'Basement',
    imagePath: '/floor-plans/basement.png',
    mapWidth: ORIGINAL_MAP_WIDTH,
    mapHeight: ORIGINAL_MAP_HEIGHT,
  },
  {
    id: 'ground',
    label: 'Ground',
    imagePath: '/floor-plans/ground.png',
    mapWidth: ORIGINAL_MAP_WIDTH,
    mapHeight: ORIGINAL_MAP_HEIGHT,
  },
  {
    id: 'first',
    label: 'First',
    imagePath: '/floor-plans/first.png',
    mapWidth: ORIGINAL_MAP_WIDTH,
    mapHeight: ORIGINAL_MAP_HEIGHT,
  },
  {
    id: 'second',
    label: 'Second',
    imagePath: '/floor-plans/second.png',
    mapWidth: ORIGINAL_MAP_WIDTH,
    mapHeight: ORIGINAL_MAP_HEIGHT,
  },
  {
    id: 'third',
    label: 'Third',
    imagePath: '/floor-plans/third.png',
    mapWidth: ORIGINAL_MAP_WIDTH,
    mapHeight: ORIGINAL_MAP_HEIGHT,
  },
  {
    id: 'fourth',
    label: 'Fourth',
    imagePath: '/floor-plans/fourth.png',
    mapWidth: ORIGINAL_MAP_WIDTH,
    mapHeight: ORIGINAL_MAP_HEIGHT,
  },
];

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  room: '#2563eb',
  corridor: '#64748b',
  entrance: '#16a34a',
  stair: '#ea580c',
  elevator: '#9333ea',
  junction: '#ca8a04',
};

export const NODE_TYPES: NodeType[] = [
  'room',
  'corridor',
  'entrance',
  'stair',
  'elevator',
  'junction',
];
