import { useMemo, useState } from 'react';
import type { FloorId } from '../../types/graph';
import { FLOOR_DEFS } from '../../types/graph';
import { loadBuildingGraph } from '../../lib/graphIo';
import {
  buildRouteSteps,
  findShortestPath,
  listDestinations,
} from '../../lib/pathfind';
import { RouteMap } from './RouteMap';

const graph = loadBuildingGraph();

function floorOfLabel(label: string): FloorId | null {
  const n = graph.nodes.find(
    (x) => x.label?.toLowerCase() === label.toLowerCase(),
  );
  return n?.floor ?? null;
}

export function Navigator() {
  const destinations = useMemo(() => listDestinations(graph), []);
  const [fromQuery, setFromQuery] = useState('Main Entrance');
  const [toQuery, setToQuery] = useState('AG76');
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const resolve = (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return null;
    const exact = destinations.find(
      (d) => d.label?.toLowerCase() === trimmed || d.id === trimmed,
    );
    if (exact) return exact;
    const partial = destinations.filter((d) =>
      (d.label ?? '').toLowerCase().includes(trimmed),
    );
    return partial.length === 1 ? partial[0] : null;
  };

  const path = useMemo(() => {
    if (!fromId || !toId) return null;
    return findShortestPath(graph, fromId, toId);
  }, [fromId, toId]);

  const steps = useMemo(() => (path ? buildRouteSteps(path) : []), [path]);

  const activeFloor: FloorId = useMemo(() => {
    if (steps.length && steps[stepIndex]) return steps[stepIndex].floor;
    if (path?.nodes.length) return path.nodes[0].floor;
    return 'ground';
  }, [steps, stepIndex, path]);

  const floorsOnRoute = useMemo(() => {
    if (!path) return [] as FloorId[];
    const seen: FloorId[] = [];
    for (const n of path.nodes) {
      if (seen.indexOf(n.floor) === -1) seen.push(n.floor);
    }
    return seen;
  }, [path]);

  const [viewFloor, setViewFloor] = useState<FloorId | null>(null);
  const displayFloor = viewFloor ?? activeFloor;

  const go = () => {
    const from = resolve(fromQuery);
    const to = resolve(toQuery);
    if (!from) {
      setError(`Unknown start: “${fromQuery}”. Pick a room id (e.g. AG52) or Main Entrance.`);
      setFromId(null);
      setToId(null);
      return;
    }
    if (!to) {
      setError(`Unknown destination: “${toQuery}”.`);
      setFromId(null);
      setToId(null);
      return;
    }
    if (from.id === to.id) {
      setError('From and To are the same place.');
      setFromId(null);
      setToId(null);
      return;
    }
    const result = findShortestPath(graph, from.id, to.id);
    if (!result) {
      setError('No walkable route between those locations yet.');
      setFromId(null);
      setToId(null);
      return;
    }
    setError(null);
    setFromId(from.id);
    setToId(to.id);
    setStepIndex(0);
    setViewFloor(null);
    setFromQuery(from.label ?? from.id);
    setToQuery(to.label ?? to.id);
  };

  const focusPathIndex = useMemo(() => {
    if (!path || !steps.length) return -1;
    const nodeId = steps[Math.min(stepIndex, steps.length - 1)]?.nodeId;
    return path.nodeIds.indexOf(nodeId);
  }, [path, steps, stepIndex]);

  const roomCount = destinations.filter((d) => d.type === 'room').length;

  return (
    <div className="flex h-dvh flex-col bg-stone-100 text-stone-900">
      <header className="border-b border-stone-300 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight">TechNav</h1>
            <p className="text-sm text-stone-500">
              Northwestern Tech · {roomCount} mapped rooms
            </p>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">From</span>
              <input
                list="technav-destinations"
                className="rounded border border-stone-300 px-3 py-2"
                value={fromQuery}
                onChange={(e) => setFromQuery(e.target.value)}
                placeholder="Main Entrance"
                autoComplete="off"
              />
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">To</span>
              <input
                list="technav-destinations"
                className="rounded border border-stone-300 px-3 py-2"
                value={toQuery}
                onChange={(e) => setToQuery(e.target.value)}
                placeholder="e.g. AG76"
                autoComplete="off"
              />
            </label>
            <datalist id="technav-destinations">
              {destinations.map((d) => (
                <option key={d.id} value={d.label ?? d.id} />
              ))}
            </datalist>
            <button
              type="submit"
              className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Get directions
            </button>
          </form>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-0 md:flex-row">
        <aside className="flex max-h-[40%] w-full shrink-0 flex-col border-b border-stone-300 bg-white md:max-h-none md:w-80 md:border-b-0 md:border-r">
          {!path ? (
            <div className="p-4 text-sm text-stone-600">
              <p className="mb-2 font-medium text-stone-800">Find a room</p>
              <p>
                Enter a start and destination (room ids like{' '}
                <button
                  type="button"
                  className="text-blue-700 underline"
                  onClick={() => {
                    setFromQuery('Main Entrance');
                    setToQuery('AG76');
                  }}
                >
                  AG76
                </button>
                ,{' '}
                <button
                  type="button"
                  className="text-blue-700 underline"
                  onClick={() => {
                    setFromQuery('Main Entrance');
                    setToQuery('NG43');
                  }}
                >
                  NG43
                </button>
                , or cross-floor{' '}
                <button
                  type="button"
                  className="text-blue-700 underline"
                  onClick={() => {
                    setFromQuery('AG76');
                    setToQuery('A136');
                  }}
                >
                  AG76 → A136
                </button>
                ).
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-stone-200 px-4 py-3">
                <div className="text-sm font-medium">
                  {fromQuery} → {toQuery}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {steps.length} steps
                  {floorsOnRoute.length > 1
                    ? ` · floors: ${floorsOnRoute
                        .map(
                          (f) => FLOOR_DEFS.find((x) => x.id === f)?.label ?? f,
                        )
                        .join(' → ')}`
                    : ''}
                </div>
                {floorsOnRoute.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {floorsOnRoute.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`rounded px-2 py-0.5 text-xs ${
                          displayFloor === f
                            ? 'bg-stone-900 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                        onClick={() => setViewFloor(f)}
                      >
                        {FLOOR_DEFS.find((x) => x.id === f)?.label ?? f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ol className="min-h-0 flex-1 list-decimal overflow-y-auto px-4 py-2 pl-8 text-sm">
                {steps.map((s, i) => (
                  <li key={`${s.nodeId}-${i}`}>
                    <button
                      type="button"
                      className={`w-full rounded px-1 py-1.5 text-left ${
                        i === stepIndex
                          ? 'bg-amber-50 font-medium text-stone-900'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                      onClick={() => {
                        setStepIndex(i);
                        setViewFloor(s.floor);
                      }}
                    >
                      {s.text}
                      {floorOfLabel(toQuery) && s.floor !== displayFloor ? (
                        <span className="ml-1 text-xs text-stone-400">
                          ({FLOOR_DEFS.find((x) => x.id === s.floor)?.label})
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2 border-t border-stone-200 p-3">
                <button
                  type="button"
                  className="flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm disabled:opacity-40"
                  disabled={stepIndex <= 0}
                  onClick={() => {
                    const next = Math.max(0, stepIndex - 1);
                    setStepIndex(next);
                    setViewFloor(steps[next]?.floor ?? null);
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="flex-1 rounded border border-stone-300 px-2 py-1.5 text-sm disabled:opacity-40"
                  disabled={stepIndex >= steps.length - 1}
                  onClick={() => {
                    const next = Math.min(steps.length - 1, stepIndex + 1);
                    setStepIndex(next);
                    setViewFloor(steps[next]?.floor ?? null);
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </aside>

        <main className="min-h-0 min-w-0 flex-1">
          <RouteMap
            floor={displayFloor}
            pathNodes={path?.nodes ?? []}
            focusIndex={focusPathIndex}
          />
        </main>
      </div>
    </div>
  );
}
