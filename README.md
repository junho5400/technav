# TechNav

Indoor navigator for Northwestern’s Technological Institute (Tech), on the official McCormick floor plans.

## Setup

```bash
cd ~/Desktop/cs392/technav
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Try

- `Main Entrance` → `AG76` / `NG43` / `MG76` (ground)
- `AG76` → `A136` (cross-floor)

## Data

- Schema: `src/types/graph.ts`
- Graph: `src/data/building-graph.json` (coords in **4000×3910** map pixels)
- Notes: [docs/map-graph.md](./docs/map-graph.md)

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server (navigator) |
| `npm run build` | Typecheck + production build |
| `npm test` | Vitest UI |
