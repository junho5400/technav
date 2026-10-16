# Map graph & navigator

## Coordinate space

Node `x` / `y` are in **original map-pixel space** (~**4000 × 3910**, origin top-left) matching the official McCormick Tech floor-plan PNGs.

Display images in `public/floor-plans/` are half-resolution (~2000×1955). The navigator scales the red path into that frame.

## Data

| File | Role |
| --- | --- |
| `src/types/graph.ts` | TypeScript schema |
| `src/data/building-graph.json` | Walkable graph (copied to `public/data/`) |
| `src/lib/pathfind.ts` | Dijkstra + step text |

**Ground floor:** dense 4-connected hallway spine from a white-corridor mask on the official PNG; rooms attach with short door stubs (no room-to-room chords).

**First floor:** stair-aligned network for cross-floor routes; OCR rooms snapped to stair hubs. Not a full first-floor corridor trace yet.

**Unmapped:** basement, 2nd–4th; some ground OCR misses; first-floor halls are approximate axis paths between stairs.

## User UI

`npm run dev` opens **TechNav**: From / To → official floor PNG + **red path** + steps. No editor, no graph dots.
