import { describe, expect, it } from 'vitest';
import { loadBuildingGraph } from '../graphIo';
import { findShortestPath, listDestinations } from '../pathfind';

const graph = loadBuildingGraph();

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

  it('routes Main Entrance → AG76 on ground', () => {
    const path = findShortestPath(graph, idFor('Main Entrance'), idFor('AG76'));
    expect(path).not.toBeNull();
    expect(path!.nodes[0].label).toBe('Main Entrance');
    expect(path!.nodes[path!.nodes.length - 1]!.label).toBe('AG76');
    expect(path!.nodes.every((n) => n.floor === 'ground' || n.type === 'stair' || n.type === 'elevator' || n.type === 'corridor' || n.type === 'junction' || n.type === 'room' || n.type === 'entrance')).toBe(true);
  });

  it('routes across floors when possible', () => {
    const path = findShortestPath(graph, idFor('AG76'), idFor('A136'));
    expect(path).not.toBeNull();
    const floors = new Set(path!.nodes.map((n) => n.floor));
    expect(floors.has('ground')).toBe(true);
    expect(floors.has('first')).toBe(true);
    expect(path!.edges.some((e) => e.multiFloor)).toBe(true);
  });
});
