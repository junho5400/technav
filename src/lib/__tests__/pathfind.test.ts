import { describe, expect, it } from 'vitest';
import type { BuildingGraph } from '../../types/graph';
import buildingGraph from '../../data/building-graph.json';
import { findShortestPath, listDestinations } from '../pathfind';

const graph = buildingGraph as BuildingGraph;

function idFor(label: string) {
  const n = graph.nodes.find((x) => x.label === label);
  if (!n) throw new Error(`missing ${label}`);
  return n.id;
}

describe('pathfind', () => {
  it('lists room destinations', () => {
    const dest = listDestinations(graph);
    expect(dest.some((d) => d.label === 'AG76')).toBe(true);
    expect(dest.some((d) => d.label === 'Main Entrance')).toBe(true);
  });

  it(
    'routes Main Entrance → AG76 on ground only',
    () => {
      const path = findShortestPath(graph, idFor('Main Entrance'), idFor('AG76'));
      expect(path).not.toBeNull();
      expect(path!.nodes[0].label).toBe('Main Entrance');
      expect(path!.nodes[path!.nodes.length - 1]!.label).toBe('AG76');
      expect(path!.nodes.every((n) => n.floor === 'ground')).toBe(true);
    },
    20000,
  );

  it(
    'routes across floors when asked',
    () => {
      const path = findShortestPath(graph, idFor('AG76'), idFor('A136'));
      expect(path).not.toBeNull();
      const floors = new Set(path!.nodes.map((n) => n.floor));
      expect(floors.has('ground')).toBe(true);
      expect(floors.has('first')).toBe(true);
      expect(path!.edges.some((e) => e.multiFloor)).toBe(true);
    },
    20000,
  );
});
