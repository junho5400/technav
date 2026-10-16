import { describe, expect, it } from 'vitest';
import type { BuildingGraph, GraphNode } from '../../types/graph';
import buildingGraph from '../../data/building-graph.json';
import { findShortestPath, listDestinations } from '../pathfind';

const graph = buildingGraph as BuildingGraph;

/** Pick two ground rooms that share a walkable component. */
function connectedGroundPair(): [GraphNode, GraphNode] | null {
  const rooms = listDestinations(graph).filter(
    (d) => d.type === 'room' && d.floor === 'ground',
  );
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < Math.min(rooms.length, i + 40); j++) {
      const path = findShortestPath(graph, rooms[i].id, rooms[j].id);
      if (path) return [rooms[i], rooms[j]];
    }
  }
  return null;
}

describe('pathfind', () => {
  it('lists real room destinations (no invented Main Entrance)', () => {
    const dest = listDestinations(graph);
    expect(dest.some((d) => d.type === 'room')).toBe(true);
    expect(dest.some((d) => d.label === 'Main Entrance')).toBe(false);
  });

  it(
    'routes between two connected ground rooms on ground only',
    () => {
      const pair = connectedGroundPair();
      expect(pair).not.toBeNull();
      const [a, b] = pair!;
      const path = findShortestPath(graph, a.id, b.id);
      expect(path).not.toBeNull();
      expect(path!.nodes.every((n) => n.floor === 'ground')).toBe(true);
      expect(path!.edges.every((e) => !e.multiFloor)).toBe(true);
    },
    20000,
  );

  it('does not invent a Main Entrance node', () => {
    expect(graph.nodes.some((n) => n.label === 'Main Entrance')).toBe(false);
  });
});
