import type { BuildingGraph, FloorId, GraphEdge, GraphNode } from '../types/graph';

export interface PathResult {
  nodeIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Total weight (map-pixel distance + vertical penalties). */
  distance: number;
}

function edgeWeight(
  edge: GraphEdge,
  from: GraphNode,
  to: GraphNode,
): number {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  // Explicit edge.weight is an additive override (e.g. vertical cost), not a replacement,
  // so co-located stair landings cannot become zero-cost teleports.
  let w =
    typeof edge.weight === 'number' && edge.multiFloor
      ? edge.weight
      : Math.hypot(dx, dy);

  if (from.floor !== to.floor || edge.multiFloor) {
    // Strong penalty so same-floor routes never detour via another floor.
    const verticalPenalty =
      from.type === 'elevator' || to.type === 'elevator' ? 2500 : 3200;
    w += verticalPenalty;
  }
  return w;
}

/** Binary-heap min-priority queue for Dijkstra. */
class MinHeap {
  private data: { id: string; d: number }[] = [];

  push(id: string, d: number) {
    const a = this.data;
    a.push({ id, d });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].d <= a[i].d) break;
      const t = a[p];
      a[p] = a[i];
      a[i] = t;
      i = p;
    }
  }

  pop(): { id: string; d: number } | undefined {
    const a = this.data;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length === 0) return top;
    a[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < a.length && a[l].d < a[m].d) m = l;
      if (r < a.length && a[r].d < a[m].d) m = r;
      if (m === i) break;
      const t = a[m];
      a[m] = a[i];
      a[i] = t;
      i = m;
    }
    return top;
  }
}

/** Undirected Dijkstra over the building graph (binary heap). */
export function findShortestPath(
  graph: BuildingGraph,
  fromId: string,
  toId: string,
): PathResult | null {
  if (fromId === toId) {
    const n = graph.nodes.find((x) => x.id === fromId);
    if (!n) return null;
    return { nodeIds: [fromId], nodes: [n], edges: [], distance: 0 };
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!nodeById.has(fromId) || !nodeById.has(toId)) return null;

  const adj = new Map<string, { edge: GraphEdge; other: string }[]>();
  for (const e of graph.edges) {
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ edge: e, other: e.to });
    adj.get(e.to)!.push({ edge: e, other: e.from });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, { nodeId: string; edge: GraphEdge }>();
  const visited = new Set<string>();
  const heap = new MinHeap();

  dist.set(fromId, 0);
  heap.push(fromId, 0);

  while (true) {
    const next = heap.pop();
    if (!next) break;
    const { id: u, d: best } = next;
    if (visited.has(u)) continue;
    if (best !== (dist.get(u) ?? Infinity)) continue;
    visited.add(u);
    if (u === toId) break;

    const fromNode = nodeById.get(u)!;
    for (const { edge, other } of adj.get(u) ?? []) {
      if (visited.has(other)) continue;
      const toNode = nodeById.get(other)!;
      const alt = best + edgeWeight(edge, fromNode, toNode);
      if (alt < (dist.get(other) ?? Infinity)) {
        dist.set(other, alt);
        prev.set(other, { nodeId: u, edge });
        heap.push(other, alt);
      }
    }
  }

  if (!prev.has(toId) && fromId !== toId) {
    if ((dist.get(toId) ?? Infinity) === Infinity) return null;
  }

  const nodeIds: string[] = [];
  const edges: GraphEdge[] = [];
  let cur: string | undefined = toId;
  while (cur && cur !== fromId) {
    nodeIds.push(cur);
    const p = prev.get(cur);
    if (!p) return null;
    edges.push(p.edge);
    cur = p.nodeId;
  }
  nodeIds.push(fromId);
  nodeIds.reverse();
  edges.reverse();

  return {
    nodeIds,
    nodes: nodeIds.map((id) => nodeById.get(id)!),
    edges,
    distance: dist.get(toId) ?? 0,
  };
}

export interface RouteStep {
  text: string;
  floor: FloorId;
  nodeId: string;
}

function floorLabel(floor: FloorId): string {
  const map: Record<FloorId, string> = {
    basement: 'basement',
    ground: 'ground floor',
    first: 'first floor',
    second: 'second floor',
    third: 'third floor',
    fourth: 'fourth floor',
  };
  return map[floor];
}

function nodeName(n: GraphNode): string {
  if (n.label) return n.label;
  if (n.type === 'entrance') return 'entrance';
  if (n.type === 'stair') return 'stairs';
  if (n.type === 'elevator') return 'elevator';
  if (n.type === 'corridor' || n.type === 'junction') return 'hallway';
  return n.id;
}

function turnPhrase(prev: GraphNode, cur: GraphNode, next: GraphNode): string {
  const ax = cur.x - prev.x;
  const ay = cur.y - prev.y;
  const bx = next.x - cur.x;
  const by = next.y - cur.y;
  const cross = ax * by - ay * bx;
  const dot = ax * bx + ay * by;
  const mag = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (mag < 1e-6) return 'Continue';
  const cos = dot / mag;
  if (cos > 0.85) return 'Continue straight';
  if (cross > 0) return 'Turn left';
  if (cross < 0) return 'Turn right';
  return 'Continue';
}

/** Convert a path into human-readable steps (no graph jargon). */
export function buildRouteSteps(path: PathResult): RouteStep[] {
  const { nodes } = path;
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [
      {
        text: `You are at ${nodeName(nodes[0])}.`,
        floor: nodes[0].floor,
        nodeId: nodes[0].id,
      },
    ];
  }

  const steps: RouteStep[] = [];
  steps.push({
    text: `Start at ${nodeName(nodes[0])} (${floorLabel(nodes[0].floor)}).`,
    floor: nodes[0].floor,
    nodeId: nodes[0].id,
  });

  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1];
    const cur = nodes[i];
    const next = nodes[i + 1];

    if (prev.floor !== cur.floor) {
      const via =
        cur.type === 'elevator' || prev.type === 'elevator'
          ? 'elevator'
          : 'stairs';
      steps.push({
        text: `Take the ${via} to the ${floorLabel(cur.floor)}.`,
        floor: cur.floor,
        nodeId: cur.id,
      });
      continue;
    }

    if (i === nodes.length - 1) {
      steps.push({
        text: `Arrive at ${nodeName(cur)}.`,
        floor: cur.floor,
        nodeId: cur.id,
      });
      continue;
    }

    // Skip pure corridor waypoints unless they are a turn
    if (
      (cur.type === 'corridor' || cur.type === 'junction') &&
      next &&
      prev.floor === next.floor
    ) {
      const phrase = turnPhrase(prev, cur, next);
      if (phrase === 'Continue' || phrase === 'Continue straight') {
        continue;
      }
      steps.push({
        text: `${phrase} in the hallway.`,
        floor: cur.floor,
        nodeId: cur.id,
      });
      continue;
    }

    if (cur.type === 'room' || cur.type === 'entrance') {
      steps.push({
        text: `Pass ${nodeName(cur)}.`,
        floor: cur.floor,
        nodeId: cur.id,
      });
    } else if (cur.type === 'stair' || cur.type === 'elevator') {
      // Vertical transition handled when floor changes; otherwise note landmark
      if (next && next.floor === cur.floor) {
        steps.push({
          text: `Continue past the ${cur.type === 'elevator' ? 'elevator' : 'stairs'}.`,
          floor: cur.floor,
          nodeId: cur.id,
        });
      }
    }
  }

  return steps;
}

/** Destinations users can pick: rooms + named entrances. */
export function listDestinations(graph: BuildingGraph): GraphNode[] {
  return graph.nodes
    .filter(
      (n) =>
        n.type === 'room' ||
        n.type === 'entrance' ||
        ((n.type === 'stair' || n.type === 'elevator') && n.label),
    )
    .filter((n) => Boolean(n.label))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '', undefined, { numeric: true }));
}
