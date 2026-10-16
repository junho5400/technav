# Map graph schema & editor

## Coordinate space

Node `x` / `y` are in **original map-pixel space** matching the official McCormick Tech floor-plan PNGs:

| Property | Value |
| --- | --- |
| Width | **4000** |
| Height | **~3910** (canonical `3910`; a few source files are 3911–3913) |
| Origin | Top-left of the PNG |
| Unit | Pixels |

Display images in `public/floor-plans/` are **half-resolution (~2000×1955)** for pan/zoom performance. The editor maps clicks from the displayed image back into the 4000×3910 frame before storing nodes.

## Schema

TypeScript types: `src/types/graph.ts`

JSON shape (`BuildingGraph`):

- `floors[]` — id, label, imagePath, mapWidth, mapHeight
- `nodes[]` — id, type (`room` \| `corridor` \| `entrance` \| `stair` \| `elevator` \| `junction`), floor, x, y, optional label / connectorGroup
- `edges[]` — id, from, to, optional weight / multiFloor

Sample seed (a few ground-floor nodes): `src/data/sample-graph.json` (also copied to `public/data/sample-graph.json`).

## Floor plan assets

| Floor | File |
| --- | --- |
| Basement | `/floor-plans/basement.png` |
| Ground | `/floor-plans/ground.png` |
| First | `/floor-plans/first.png` |
| Second | `/floor-plans/second.png` |
| Third | `/floor-plans/third.png` |
| Fourth | `/floor-plans/fourth.png` |

Source: [McCormick Tech Room Finder](https://www.mccormick.northwestern.edu/contact/tech-room-finder.html) large PNGs.

## Running the editor

```bash
cd ~/Desktop/cs392/technav
npm install
npm run dev
```

Open the Vite URL (usually http://localhost:5173).

### Tools

| Mode | Action |
| --- | --- |
| **Place node** | Pick type + optional label, click map |
| **Connect** | Click two nodes to add an edge |
| **Select** | Click a node to edit label / delete |
| **Pan** | Drag (or hold Shift while dragging in any mode) |
| Scroll | Zoom |

**Download JSON** exports the in-memory graph. **Import JSON** loads a file back. To persist into the repo, save the download over `src/data/sample-graph.json` / `public/data/sample-graph.json`.

This PR seeds a tiny sample only — not full-building mapping.
