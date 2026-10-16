import { useEffect, useMemo, useState } from 'react';
import type { BuildingGraph, FloorId } from '../../types/graph';
import { FLOOR_DEFS } from '../../types/graph';
import { fetchBuildingGraph } from '../../lib/graphIo';
import {
  buildRouteSteps,
  findShortestPath,
  listDestinations,
} from '../../lib/pathfind';
import { RouteMap } from './RouteMap';

export function Navigator() {
  const [graph, setGraph] = useState<BuildingGraph | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fromQuery, setFromQuery] = useState('Computer Lab');
  const [toQuery, setToQuery] = useState('MG76');
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewFloor, setViewFloor] = useState<FloorId | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBuildingGraph()
      .then((g) => {
        if (!cancelled) setGraph(g);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load map data');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const destinations = useMemo(
    () => (graph ? listDestinations(graph) : []),
    [graph],
  );

  const runRoute = (g: BuildingGraph, fromLabel: string, toLabel: string) => {
    const dest = listDestinations(g);
    const find = (q: string) => {
      const t = q.trim().toLowerCase();
      return (
        dest.find((d) => d.label?.toLowerCase() === t || d.id === t) ??
        (dest.filter((d) => (d.label ?? '').toLowerCase().includes(t)).length === 1
          ? dest.find((d) => (d.label ?? '').toLowerCase().includes(t))!
          : null)
      );
    };
    const from = find(fromLabel);
    const to = find(toLabel);
    if (!from) {
      setError(`Unknown start: “${fromLabel}”. Try a room id like AG52.`);
      setFromId(null);
      setToId(null);
      return;
    }
    if (!to) {
      setError(`Unknown destination: “${toLabel}”.`);
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
    const result = findShortestPath(g, from.id, to.id);
    if (!result) {
      setError('No walkable route between those locations yet.');
      setFromId(null);
      setToId(null);
      return;
    }
    setError(null);
    setFromId(from.id);
    setToId(to.id);
    setFromQuery(from.label ?? from.id);
    setToQuery(to.label ?? to.id);
    setStepIndex(0);
    setViewFloor(null);
  };

  useEffect(() => {
    if (!graph) return;
    const dest = listDestinations(graph);
    const pick = (...labels: string[]) =>
      labels.find((l) => dest.some((d) => d.label === l));
    // Prefer same-corridor-component demos that stay on wide halls.
    const from = pick('Computer Lab', 'BG10', 'LG71', 'AG10') ?? dest[0]?.label;
    const to =
      pick('MG76', 'MG11', 'LG71') ??
      dest.find((d) => d.label !== from)?.label;
    if (from && to) runRoute(graph, from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once graph loads
  }, [graph]);

  const path = useMemo(() => {
    if (!graph || !fromId || !toId) return null;
    return findShortestPath(graph, fromId, toId);
  }, [graph, fromId, toId]);

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

  const displayFloor = viewFloor ?? activeFloor;

  useEffect(() => {
    setViewFloor(null);
  }, [fromId, toId]);

  const focusPathIndex = useMemo(() => {
    if (!path || !steps.length) return -1;
    const nodeId = steps[Math.min(stepIndex, steps.length - 1)]?.nodeId;
    return path.nodeIds.indexOf(nodeId);
  }, [path, steps, stepIndex]);

  const roomCount = destinations.filter((d) => d.type === 'room').length;
  const groundRooms = destinations.filter(
    (d) => d.type === 'room' && d.floor === 'ground',
  ).length;
  const firstRooms = destinations.filter(
    (d) => d.type === 'room' && d.floor === 'first',
  ).length;

  const examples = useMemo(() => {
    const labels = new Set(
      destinations.filter((d) => d.type === 'room').map((d) => d.label ?? ''),
    );
    const candidates: [string, string][] = [
      ['Computer Lab', 'MG76'],
      ['BG10', 'MG11'],
      ['LG71', 'MG76'],
      ['AG10', 'BG10'],
      ['Loading Dock', 'HG09'],
    ];
    const found = candidates.filter(([a, b]) => labels.has(a) && labels.has(b));
    if (found.length) return found;
    const rooms = destinations.filter((d) => d.type === 'room').slice(0, 4);
    if (rooms.length >= 2) {
      return [[rooms[0].label!, rooms[1].label!]] as [string, string][];
    }
    return [] as [string, string][];
  }, [destinations]);

  if (loadError) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#f3efe6] p-6 text-stone-800">
        <p>Couldn’t load map data: {loadError}</p>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#f3efe6] text-stone-700">
        <p className="text-sm tracking-wide">Loading Tech floor plans…</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[#f3efe6] text-stone-900">
      <header className="border-b border-stone-300/80 bg-[#faf7f1]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-stone-500 uppercase">
                Northwestern Tech
              </p>
              <h1 className="font-serif text-3xl leading-none tracking-tight text-stone-900">
                TechNav
              </h1>
            </div>
            <p className="max-w-sm text-right text-sm text-stone-600">
              {groundRooms} ground · {firstRooms} first-floor rooms
              <span className="block text-xs text-stone-400">
                {roomCount} destinations · official floor plans
              </span>
            </p>
          </div>

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              runRoute(graph, fromQuery, toQuery);
            }}
          >
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">From</span>
              <input
                list="technav-destinations"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 shadow-sm outline-none focus:border-stone-500"
                value={fromQuery}
                onChange={(e) => setFromQuery(e.target.value)}
                placeholder="e.g. AG76"
                autoComplete="off"
              />
            </label>
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">To</span>
              <input
                list="technav-destinations"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 shadow-sm outline-none focus:border-stone-500"
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
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-800"
            >
              Get directions
            </button>
          </form>

          <div className="flex flex-wrap gap-2 text-xs">
            {examples.map(([a, b]) => (
              <button
                key={`${a}-${b}`}
                type="button"
                className="rounded-full border border-stone-300 bg-white/70 px-2.5 py-1 text-stone-700 hover:border-stone-500"
                onClick={() => {
                  setFromQuery(a);
                  setToQuery(b);
                  runRoute(graph, a, b);
                }}
              >
                {a} → {b}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[42%] w-full shrink-0 flex-col border-b border-stone-300 bg-white/80 md:max-h-none md:w-[22rem] md:border-r md:border-b-0">
          {!path ? (
            <div className="p-4 text-sm text-stone-600">
              Enter a room id and get a red path on the official Tech floor plan.
            </div>
          ) : (
            <>
              <div className="border-b border-stone-200 px-4 py-3">
                <div className="text-base font-medium tracking-tight">
                  {fromQuery}
                  <span className="mx-1.5 text-stone-400">→</span>
                  {toQuery}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {steps.length} steps
                  {floorsOnRoute.length > 1
                    ? ` · ${floorsOnRoute
                        .map(
                          (f) => FLOOR_DEFS.find((x) => x.id === f)?.label ?? f,
                        )
                        .join(' → ')}`
                    : ` · ${FLOOR_DEFS.find((x) => x.id === displayFloor)?.label}`}
                </div>
                {floorsOnRoute.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {floorsOnRoute.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`rounded-md px-2 py-0.5 text-xs ${
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
                      className={`w-full rounded-md px-1.5 py-1.5 text-left transition-colors ${
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
                    </button>
                  </li>
                ))}
              </ol>

              <div className="flex gap-2 border-t border-stone-200 p-3">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm disabled:opacity-40"
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
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm disabled:opacity-40"
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

        <main className="relative min-h-0 min-w-0 flex-1">
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
