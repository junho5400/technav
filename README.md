# TechNav

Indoor navigator for Northwestern’s Technological Institute (Tech), built on the official McCormick floor plans.

Baseline: [criesbeck/react-start](https://github.com/criesbeck/react-start) (React, TypeScript, Vite, Tailwind, Vitest).

## Setup

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). The app opens the **map graph editor**.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server (map editor) |
| `npm run build` | Typecheck and production build |
| `npm test` | Run Vitest (UI) |

## Map graph (step 1)

- **Schema:** `src/types/graph.ts`
- **Sample JSON:** `src/data/sample-graph.json` / `public/data/sample-graph.json`
- **Floor plans (web-sized):** `public/floor-plans/*.png` — half-res copies; node coords use original **4000×3910** map-pixel space
- **Docs:** [docs/map-graph.md](./docs/map-graph.md)

Editor: select floor → pan/zoom → place nodes → connect edges → download/import JSON.
