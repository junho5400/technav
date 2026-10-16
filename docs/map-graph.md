# Map graph & navigator

## Coordinate space

Node `x` / `y` are in **original map-pixel space** (~**4000 × 3910**, origin top-left) matching the official McCormick Tech floor-plan PNGs.

Display images in `public/floor-plans/` are half-resolution (~2000×1955). The navigator scales the red path correctly into that frame.

## Data

| File | Role |
| --- | --- |
| `src/types/graph.ts` | TypeScript schema |
| `src/data/building-graph.json` | Walkable graph (also copied to `public/data/`) |
| `src/lib/pathfind.ts` | Dijkstra + step text |

Node types: `room` \| `corridor` \| `entrance` \| `stair` \| `elevator` \| `junction`.

**Authoring:** graph lives in JSON/code — not in the user UI.

## User UI

`npm run dev` opens **TechNav** navigator: From / To → floor PNG + **red path** + step list. No graph dots or edit handles.

## Coverage (current slice)

See `building-graph.json` node counts. Ground floor has substantial room coverage; first floor has a smaller OCR-derived set with stair/elevator links for cross-floor routes. Basement / 2nd–4th not mapped yet.
