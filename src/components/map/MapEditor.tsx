import { useRef, useState } from 'react';
import type { BuildingGraph, FloorId, NodeType } from '../../types/graph';
import { FLOOR_DEFS, NODE_TYPES, NODE_TYPE_COLORS } from '../../types/graph';
import {
  downloadGraphJson,
  loadSampleGraph,
  nextId,
  parseGraphJson,
} from '../../lib/graphIo';
import { MapCanvas, type EditorMode } from './MapCanvas';

export function MapEditor() {
  const [graph, setGraph] = useState<BuildingGraph>(() => loadSampleGraph());
  const [floor, setFloor] = useState<FloorId>('ground');
  const [mode, setMode] = useState<EditorMode>('place');
  const [nodeType, setNodeType] = useState<NodeType>('room');
  const [labelDraft, setLabelDraft] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [status, setStatus] = useState('Sample ground-floor graph loaded.');
  const fileRef = useRef<HTMLInputElement>(null);

  const floorMeta = FLOOR_DEFS.find((f) => f.id === floor)!;
  const selected = graph.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const placeNode = (x: number, y: number) => {
    const id = nextId(nodeType.slice(0, 4));
    const label = labelDraft.trim() || undefined;
    setGraph((g) => ({
      ...g,
      nodes: [
        ...g.nodes,
        {
          id,
          type: nodeType,
          floor,
          x: Math.round(x),
          y: Math.round(y),
          ...(label ? { label } : {}),
        },
      ],
    }));
    setSelectedNodeId(id);
    setStatus(`Placed ${nodeType}${label ? ` "${label}"` : ''} at (${Math.round(x)}, ${Math.round(y)}).`);
  };

  const handleConnect = (id: string) => {
    if (!connectFromId) {
      setConnectFromId(id);
      setSelectedNodeId(id);
      setStatus(`Connect: starting from ${id}. Click another node.`);
      return;
    }
    if (connectFromId === id) {
      setConnectFromId(null);
      setStatus('Connect cancelled.');
      return;
    }
    const exists = graph.edges.some(
      (e) =>
        (e.from === connectFromId && e.to === id) ||
        (e.from === id && e.to === connectFromId),
    );
    if (exists) {
      setStatus('Edge already exists.');
      setConnectFromId(null);
      return;
    }
    setGraph((g) => ({
      ...g,
      edges: [...g.edges, { id: nextId('edge'), from: connectFromId, to: id }],
    }));
    setStatus(`Connected ${connectFromId} → ${id}.`);
    setConnectFromId(null);
    setSelectedNodeId(id);
  };

  const deleteSelected = () => {
    if (!selectedNodeId) return;
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.filter((n) => n.id !== selectedNodeId),
      edges: g.edges.filter(
        (e) => e.from !== selectedNodeId && e.to !== selectedNodeId,
      ),
    }));
    setStatus(`Deleted node ${selectedNodeId}.`);
    setSelectedNodeId(null);
    setConnectFromId(null);
  };

  const updateSelectedLabel = (label: string) => {
    if (!selectedNodeId) return;
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === selectedNodeId
          ? { ...n, label: label.trim() || undefined }
          : n,
      ),
    }));
  };

  const onImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseGraphJson(text);
      setGraph(parsed);
      setSelectedNodeId(null);
      setConnectFromId(null);
      setStatus(`Imported ${parsed.nodes.length} nodes, ${parsed.edges.length} edges.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const floorNodeCount = graph.nodes.filter((n) => n.floor === floor).length;

  return (
    <div className="flex h-dvh flex-col bg-stone-100 text-stone-900">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-300 bg-white px-4 py-2">
        <h1 className="text-lg font-semibold tracking-tight">TechNav Map Editor</h1>
        <span className="text-sm text-stone-500">
          coords = original {graph.coordinateSpace.width}×{graph.coordinateSpace.height} px
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-2 py-1 hover:bg-stone-50"
            onClick={() => {
              downloadGraphJson(graph);
              setStatus('Downloaded technav-graph.json');
            }}
          >
            Download JSON
          </button>
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-2 py-1 hover:bg-stone-50"
            onClick={() => fileRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="rounded border border-stone-300 bg-white px-2 py-1 hover:bg-stone-50"
            onClick={() => {
              setGraph(loadSampleGraph());
              setFloor('ground');
              setSelectedNodeId(null);
              setConnectFromId(null);
              setStatus('Reloaded sample graph.');
            }}
          >
            Reset sample
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-stone-300 bg-white p-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Floor</span>
            <select
              className="rounded border border-stone-300 px-2 py-1.5"
              value={floor}
              onChange={(e) => {
                setFloor(e.target.value as FloorId);
                setConnectFromId(null);
              }}
            >
              {FLOOR_DEFS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="font-medium">Tool</legend>
            {(
              [
                ['pan', 'Pan'],
                ['place', 'Place node'],
                ['connect', 'Connect'],
                ['select', 'Select'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === value}
                  onChange={() => {
                    setMode(value);
                    if (value !== 'connect') setConnectFromId(null);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>

          {mode === 'place' && (
            <div className="flex flex-col gap-2 rounded border border-stone-200 bg-stone-50 p-2">
              <label className="flex flex-col gap-1">
                <span className="font-medium">Node type</span>
                <select
                  className="rounded border border-stone-300 px-2 py-1.5"
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value as NodeType)}
                >
                  {NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">Label (optional)</span>
                <input
                  className="rounded border border-stone-300 px-2 py-1.5"
                  placeholder="e.g. L265"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                />
              </label>
              <p className="text-xs text-stone-500">
                Click the map to place a {nodeType} node.
              </p>
            </div>
          )}

          {mode === 'connect' && (
            <p className="text-xs text-stone-500">
              Click two nodes to add an undirected edge.
              {connectFromId ? ` From: ${connectFromId}` : ''}
            </p>
          )}

          {selected && (
            <div className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-2">
              <div className="font-medium">Selected</div>
              <div className="break-all text-xs text-stone-600">{selected.id}</div>
              <div>
                type:{' '}
                <span style={{ color: NODE_TYPE_COLORS[selected.type] }}>
                  {selected.type}
                </span>
              </div>
              <div>
                ({selected.x}, {selected.y}) · {selected.floor}
              </div>
              <label className="flex flex-col gap-1">
                <span>Label</span>
                <input
                  className="rounded border border-stone-300 px-2 py-1"
                  value={selected.label ?? ''}
                  onChange={(e) => updateSelectedLabel(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
                onClick={deleteSelected}
              >
                Delete node
              </button>
            </div>
          )}

          <div className="mt-auto space-y-1 border-t border-stone-200 pt-3 text-xs text-stone-500">
            <div>
              Graph: {graph.nodes.length} nodes · {graph.edges.length} edges
            </div>
            <div>
              This floor: {floorNodeCount} nodes
            </div>
            <div className="pt-1 text-stone-600">{status}</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <MapCanvas
            key={floor}
            imagePath={floorMeta.imagePath}
            floor={floor}
            nodes={graph.nodes}
            edges={graph.edges}
            mode={mode}
            selectedNodeId={selectedNodeId}
            connectFromId={connectFromId}
            onPlaceNode={placeNode}
            onSelectNode={(id) => {
              setSelectedNodeId(id);
              setMode('select');
            }}
            onConnectNode={handleConnect}
          />
        </main>
      </div>
    </div>
  );
}
