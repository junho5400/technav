# TechNav

Indoor navigator for Northwestern’s Technological Institute (Tech), on the official McCormick floor plans.

Stack: React + TypeScript + Vite + Tailwind ([criesbeck/react-start](https://github.com/criesbeck/react-start) baseline).

## Setup

```bash
cd ~/Desktop/cs392/technav
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## What you get

- **From / To** room lookup (e.g. `Main Entrance` → `AG76`, or `AG76` → `A136` across floors)
- Official floor PNG with a **red route**
- Step-by-step directions (advance with Previous / Next)

Graph data: `src/data/building-graph.json` (coords in original **4000×3910** map pixels). Details: [docs/map-graph.md](./docs/map-graph.md).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server (navigator) |
| `npm run build` | Typecheck + production build |
| `npm test` | Vitest UI |
