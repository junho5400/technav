#!/usr/bin/env python3
"""TechNav ground spine: unite wide halls (fix blue-label breaks), short stubs, real labels."""
from __future__ import annotations

import heapq
import json
import math
import os
import re
import shutil
from collections import defaultdict, deque

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

MEDIA = (
    "/Users/junhohong/Library/Application Support/Cursor/AgentStores/"
    "cursor_agent_stores/bc-28ffd126-9298-41e6-bae6-e611a6613358/files/media/floor-plans"
)
REPO = os.path.expanduser("~/Desktop/cs392/technav")
OUT = "/tmp/technav-v2"
OCR = "/tmp/technav-floors/ocr-ground.json"
YELLOW = "/tmp/technav-floors/yellow-ground.json"
ORIG_W, ORIG_H = 4000, 3910
WING = r"[A-N]"


def classify(arr):
    r, g, b = [arr[:, :, i].astype(int) for i in range(3)]
    lum = (r + g + b) / 3.0
    chroma = (r + b) / 2.0 - g
    # Blue corridor-label ink sits on white halls and must not break connectivity
    blue_label = (b > 200) & (b > r + 20) & (g > 150) & (lum > 160) & (lum < 240)
    hall = ((lum > 235) & (chroma < 10) & (r > 225) & (g > 225) & (b > 225)) | blue_label
    hall = ndi.binary_closing(hall, iterations=2)
    room = (chroma > 12) & (lum > 150) & (lum < 235) & (r > 160) & (b > 160) & ~blue_label
    yellow = (r > 200) & (g > 150) & (b < 110)
    exterior = (lum < 100) & (b > 80) & ~blue_label
    return hall, room, yellow, exterior


def extract_strict(hall, room, yellow, exterior):
    struct = ndi.generate_binary_structure(2, 1)
    dil_room = ndi.binary_dilation(room, structure=struct, iterations=10)
    dil_ext = ndi.binary_dilation(exterior, iterations=6)
    raw = hall & ~dil_room & ~dil_ext
    clear = ndi.distance_transform_edt(raw)
    dist_room = ndi.distance_transform_edt(~room)
    corridor = raw & (clear >= 5) & (clear <= 32) & (dist_room <= 110)
    yel = ndi.binary_dilation(yellow, iterations=4)
    corridor |= yel & hall & ~dil_ext
    corridor = ndi.binary_closing(corridor, structure=struct, iterations=2)
    corridor &= (hall | yellow) & ~dil_ext
    lab, n = ndi.label(corridor)
    sizes = ndi.sum(corridor, lab, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, dtype=bool)
    for i, s in enumerate(sizes, start=1):
        if s >= 1000:
            keep[i] = True
    return keep[lab]


def bridge_wide_halls(corridor, hall, exterior, min_clear=5, max_gap=200):
    """Merge corridor CCs that share a real wide-hall path (raw hall EDT)."""
    dil_ext = ndi.binary_dilation(exterior, iterations=6)
    clear_h = ndi.distance_transform_edt(hall & ~dil_ext)
    H, W = corridor.shape
    bridges = 0

    for _round in range(80):
        lab, n = ndi.label(corridor)
        if n <= 1:
            break
        sizes = ndi.sum(corridor, lab, index=np.arange(1, n + 1))
        order = np.argsort(-sizes)
        # Allow walking on any existing corridor + wide raw hall
        walkable = corridor | ((hall & ~dil_ext) & (clear_h >= min_clear))
        improved = False

        # Try attach each smaller sizable CC to some larger CC
        for oi in order[1:]:
            cid = int(oi) + 1
            if sizes[oi] < 900:
                continue
            src = lab == cid
            # BFS to any other corridor pixel of a different (larger) component
            q = deque()
            parent = {}
            ys, xs = np.where(src)
            stride = max(1, len(xs) // 600)
            for x, y in zip(xs[::stride].tolist(), ys[::stride].tolist()):
                q.append((x, y))
                parent[(x, y)] = None
            found = None
            steps = 0
            while q and steps < 500_000:
                x, y = q.popleft()
                steps += 1
                if corridor[y, x] and lab[y, x] != cid and lab[y, x] != 0:
                    # prefer larger target
                    if sizes[lab[y, x] - 1] >= sizes[oi]:
                        found = (x, y)
                        break
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in parent:
                        continue
                    if not (0 <= nx < W and 0 <= ny < H):
                        continue
                    if not walkable[ny, nx]:
                        continue
                    parent[(nx, ny)] = (x, y)
                    q.append((nx, ny))
            if not found:
                continue
            path = []
            cur = found
            while cur is not None:
                path.append(cur)
                cur = parent[cur]
            gap = [(x, y) for x, y in path if not corridor[y, x]]
            if len(gap) > max_gap:
                continue
            if gap and min(float(clear_h[y, x]) for x, y in gap) < min_clear - 0.1:
                continue
            for x, y in gap:
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < W and 0 <= yy < H and hall[yy, xx] and not dil_ext[yy, xx]:
                            corridor[yy, xx] = True
            bridges += 1
            improved = True
            tgt = int(lab[found[1], found[0]])
            print(
                f"  bridge sz={int(sizes[oi])} -> sz={int(sizes[tgt - 1])} "
                f"gap={len(gap)} path={len(path)}"
            )
            break
        if not improved:
            break
    return corridor, bridges


def build_spine(corridor, step=16):
    H, W = corridor.shape
    radius = ndi.distance_transform_edt(corridor)
    nodes = []
    at = {}
    for y in range(0, H, step):
        for x in range(0, W, step):
            best = None
            for dy in range(step):
                for dx in range(step):
                    yy, xx = y + dy, x + dx
                    if yy >= H or xx >= W:
                        continue
                    if corridor[yy, xx] and radius[yy, xx] >= 3.5:
                        d = dx * dx + dy * dy
                        if best is None or d < best[0]:
                            best = (d, xx, yy, float(radius[yy, xx]))
            if not best:
                continue
            _, xx, yy, rad = best
            nid = len(nodes)
            nodes.append(
                {
                    "id": f"sp-g-{nid}",
                    "x": xx,
                    "y": yy,
                    "r": rad,
                    "gx": xx // step,
                    "gy": yy // step,
                }
            )
            at[(xx // step, yy // step)] = nid

    lab, ncomp = ndi.label(corridor)
    covered = {int(lab[n["y"], n["x"]]) for n in nodes}
    for cid in range(1, ncomp + 1):
        if cid in covered:
            continue
        ys, xs = np.where(lab == cid)
        if len(xs) == 0:
            continue
        best = None
        for x, y in zip(xs[::2], ys[::2]):
            rad = float(radius[y, x])
            if best is None or rad > best[0]:
                best = (rad, int(x), int(y))
        if not best:
            continue
        _, xx, yy = best
        nid = len(nodes)
        nodes.append(
            {
                "id": f"sp-g-{nid}",
                "x": xx,
                "y": yy,
                "r": best[0],
                "gx": xx // step,
                "gy": yy // step,
            }
        )
        at[(xx // step, yy // step)] = nid
    return nodes, at, radius


def corridor_line_ok(x0, y0, x1, y1, corridor, rad=3):
    H, W = corridor.shape
    samples = max(6, int(math.hypot(x1 - x0, y1 - y0) // 2))
    for i in range(samples + 1):
        t = i / samples
        x = int(round(x0 + (x1 - x0) * t))
        y = int(round(y0 + (y1 - y0) * t))
        ok = any(
            0 <= x + dx < W and 0 <= y + dy < H and corridor[y + dy, x + dx]
            for dx in range(-rad, rad + 1)
            for dy in range(-rad, rad + 1)
        )
        if not ok:
            return False
    return True


def connect_spine(nodes, at, corridor, step=16):
    edges = []
    seen = set()
    deltas = [
        (1, 0),
        (0, 1),
        (1, 1),
        (1, -1),
        (2, 0),
        (0, 2),
        (2, 1),
        (1, 2),
        (2, -1),
        (-1, 2),
        (2, 2),
        (2, -2),
    ]
    for (gx, gy), i in at.items():
        for dgx, dgy in deltas:
            j = at.get((gx + dgx, gy + dgy))
            if j is None:
                continue
            key = (min(i, j), max(i, j))
            if key in seen:
                continue
            if not corridor_line_ok(
                nodes[i]["x"], nodes[i]["y"], nodes[j]["x"], nodes[j]["y"], corridor, rad=3
            ):
                continue
            seen.add(key)
            w = math.hypot(nodes[i]["x"] - nodes[j]["x"], nodes[i]["y"] - nodes[j]["y"])
            edges.append(
                {
                    "id": f"e-{nodes[i]['id']}-{nodes[j]['id']}",
                    "from": nodes[i]["id"],
                    "to": nodes[j]["id"],
                    "weight": round(w, 1),
                }
            )
    return edges


def spine_components(nodes, edges):
    parent = {n["id"]: n["id"] for n in nodes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for e in edges:
        a, b = find(e["from"]), find(e["to"])
        if a != b:
            parent[b] = a
    comps = defaultdict(list)
    for n in nodes:
        comps[find(n["id"])].append(n)
    return sorted(comps.values(), key=len, reverse=True)


def bridge_spine_ccs(nodes, edges, corridor, max_bridge=100):
    """Link spine CCs that sit on the same corridor mask CC and are close."""
    corr_lab, _ = ndi.label(corridor)
    H, W = corridor.shape
    added = 0
    for _ in range(20):
        comps = spine_components(nodes, edges)
        if len(comps) <= 1:
            break
        cell = 48
        buckets = defaultdict(list)
        for n in comps[0]:
            buckets[(n["x"] // cell, n["y"] // cell)].append(n)
        best = None
        for other in comps[1:]:
            if len(other) < 5:
                continue
            for n in other:
                gx, gy = n["x"] // cell, n["y"] // cell
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        for m in buckets.get((gx + dx, gy + dy), []):
                            d = math.hypot(n["x"] - m["x"], n["y"] - m["y"])
                            if d > max_bridge:
                                continue
                            ca = int(corr_lab[n["y"], n["x"]])
                            cb = int(corr_lab[m["y"], m["x"]])
                            if ca == 0 or ca != cb:
                                continue
                            if best is None or d < best[0]:
                                best = (d, m["id"], n["id"], m["x"], m["y"], n["x"], n["y"])
        if not best:
            break
        d, aid, bid, ax, ay, bx, by = best
        if not corridor_line_ok(ax, ay, bx, by, corridor, rad=4):
            # path along corridor
            if not _corridor_reachable(ax, ay, bx, by, corridor, limit=int(max_bridge * 2.5)):
                # remove this pair from consideration by slightly moving — skip
                # try next by temporarily not using this; just break denser fails
                # Mark: add edge anyway if manhattan corridor BFS works with step 1
                if not _corridor_reachable(ax, ay, bx, by, corridor, limit=int(max_bridge * 3)):
                    break
        edges.append({"id": f"e-{aid}-{bid}", "from": aid, "to": bid, "weight": round(d, 1)})
        added += 1
    return added


def _corridor_reachable(x0, y0, x1, y1, corridor, limit=200):
    H, W = corridor.shape
    q = deque([(x0, y0, 0)])
    seen = {(x0, y0)}
    while q:
        x, y, d = q.popleft()
        if d > limit:
            continue
        if abs(x - x1) + abs(y - y1) <= 3:
            return True
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen:
                continue
            if not (0 <= nx < W and 0 <= ny < H):
                continue
            if not corridor[ny, nx]:
                continue
            seen.add((nx, ny))
            q.append((nx, ny, d + 2))
    return False


def corridor_projectors(corridor):
    return ndi.distance_transform_edt(~corridor, return_distances=True, return_indices=True)


def nearest_spine(x, y, nodes_by_id, corridor, dist, inds, limit=180):
    H, W = corridor.shape
    if not (0 <= x < W and 0 <= y < H):
        return None
    if corridor[y, x]:
        px, py, seed = x, y, 0.0
    else:
        d = float(dist[y, x])
        if d > limit:
            return None
        py, px = int(inds[0, y, x]), int(inds[1, y, x])
        seed = d
    spine_pos = {(n["x"], n["y"]): n["id"] for n in nodes_by_id.values()}
    q = deque([(px, py, 0)])
    seen = {(px, py)}
    while q:
        cx, cy, d = q.popleft()
        if d > limit:
            continue
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                sid = spine_pos.get((cx + dx, cy + dy))
                if sid:
                    return sid, cx, cy, seed + d
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if (nx, ny) in seen:
                continue
            if not (0 <= nx < W and 0 <= ny < H):
                continue
            if not corridor[ny, nx]:
                continue
            seen.add((nx, ny))
            q.append((nx, ny, d + 1))
    return None


def clean_token(t: str) -> str:
    t = t.strip().upper().replace(" ", "").replace("|", "")
    trans = str.maketrans(
        {"€": "E", "£": "E", "К": "K", "М": "M", "Е": "E", "В": "B", "О": "O"}
    )
    t = t.translate(trans)
    for a, b in [
        ("NGO1", "NG01"),
        ("KGO1", "KG01"),
        ("AGO1", "AG01"),
        ("LGO1", "LG01"),
        ("MGO1", "MG01"),
        ("DGO1", "DG01"),
        ("FGO1", "FG01"),
        ("EGO1", "EG01"),
        ("BGO1", "BG01"),
        ("CGO1", "CG01"),
        ("HGO1", "HG01"),
        ("JGO1", "JG01"),
    ]:
        t = t.replace(a, b)
    return t


def parse_ground_room(text: str):
    t = clean_token(text)
    if re.match(rf"^{WING}G(0\d|70)[A-Z]$", t):
        return None
    m = re.match(rf"^({WING})G(\d{{2}})([A-Z])?$", t)
    if not m:
        return None
    n = int(m.group(2))
    if not (2 <= n <= 99):
        return None
    return f"{m.group(1)}G{m.group(2)}{m.group(3) or ''}"


def load_named_places(ocr_hits, sx, sy):
    places = {}
    wanted = {
        "LOADINGDOCK": "Loading Dock",
        "MAILROOM": "Mail Room",
        "COMPUTERLAB": "Computer Lab",
        "VWR": "VWR",
    }
    for h in ocr_hits:
        if h.get("conf", 0) < 0.7:
            continue
        key = re.sub(r"[^A-Z]", "", h["text"].upper())
        if key in wanted:
            places[wanted[key]] = {
                "label": wanted[key],
                "x": int(round(h["x"] * sx)),
                "y": int(round(h["y"] * sy)),
                "conf": h["conf"],
            }
    comps = [h for h in ocr_hits if h.get("conf", 0) >= 0.8 and "COMPUTER" in h["text"].upper()]
    labs = [h for h in ocr_hits if h.get("conf", 0) >= 0.8 and re.fullmatch(r"Lab", h["text"], re.I)]
    for c in comps:
        for lab in labs:
            if abs(c["x"] - lab["x"]) < 120 and abs(c["y"] - lab["y"]) < 80:
                places["Computer Lab"] = {
                    "label": "Computer Lab",
                    "x": int(round(((c["x"] + lab["x"]) / 2) * sx)),
                    "y": int(round(((c["y"] + lab["y"]) / 2) * sy)),
                    "conf": min(c["conf"], lab["conf"]),
                }
    for h in ocr_hits:
        if h.get("conf", 0) >= 0.8 and "MAIL" in h["text"].upper():
            places.setdefault(
                "Mail Room",
                {
                    "label": "Mail Room",
                    "x": int(round(h["x"] * sx)),
                    "y": int(round(h["y"] * sy)),
                    "conf": h["conf"],
                },
            )
    return places


def main():
    im = Image.open(f"{MEDIA}/ground.png").convert("RGB")
    arr = np.asarray(im)
    H, W = arr.shape[:2]
    print(f"image {W}x{H}")
    hall, room, yellow, exterior = classify(arr)
    print(
        f"hall={hall.mean():.1%} room={room.mean():.1%} "
        f"yellow={yellow.mean():.1%} exterior={exterior.mean():.1%}"
    )

    corridor = extract_strict(hall, room, yellow, exterior)
    lab, n = ndi.label(corridor)
    sizes = ndi.sum(corridor, lab, index=np.arange(1, n + 1))
    print(f"strict corridor pix={int(corridor.sum())} comps={n} top={sorted(sizes, reverse=True)[:5]}")

    corridor, nb = bridge_wide_halls(corridor, hall, exterior, min_clear=5, max_gap=220)
    print(f"wide bridges={nb}")
    lab, n = ndi.label(corridor)
    sizes = ndi.sum(corridor, lab, index=np.arange(1, n + 1))
    order = np.argsort(-sizes)
    print(f"united comps={n} top={[int(sizes[i]) for i in order[:8]]} pix={int(corridor.sum())}")
    np.save(f"{OUT}/corridor-united.npy", corridor)

    dist_c, inds_c = corridor_projectors(corridor)
    for name, x, y in [
        ("AG76", 570, 3322),
        ("NG43", 1924, 348),
        ("FG11", 2794, 2680),
        ("MG76", 2314, 1288),
        ("AG10", 1204, 2654),
        ("LG71", 1666, 2296),
        ("Computer", 1828, 1986),
        ("VWR", 3348, 136),
        ("LDock", 3680, 2012),
        ("BG10", 950, 2729),
    ]:
        yy, xx = int(inds_c[0, y, x]), int(inds_c[1, y, x])
        cid = int(lab[yy, xx])
        sz = int(sizes[cid - 1]) if cid else 0
        print(f"  {name}: d={dist_c[y, x]:.0f} lab={cid} sz={sz}")

    step = 16
    nodes, at, radius = build_spine(corridor, step=step)
    edges = connect_spine(nodes, at, corridor, step=step)
    comps = spine_components(nodes, edges)
    print(f"spine before: nodes={len(nodes)} edges={len(edges)} comps={[len(c) for c in comps[:10]]}")
    n_br = bridge_spine_ccs(nodes, edges, corridor, max_bridge=110)
    comps = spine_components(nodes, edges)
    print(
        f"spine after (+{n_br}): nodes={len(nodes)} edges={len(edges)} comps={[len(c) for c in comps[:10]]}"
    )

    # Keep spine on giant mask CC + large isolated halls (LDock etc.)
    corr_lab, _ = ndi.label(corridor)
    sizes_c = ndi.sum(corridor, corr_lab, index=np.arange(1, corr_lab.max() + 1))
    giant_cid = int(np.argmax(sizes_c)) + 1
    keep_cids = {giant_cid}
    for i, s in enumerate(sizes_c, start=1):
        if s >= 50000:
            keep_cids.add(i)

    keep_ids = set()
    for c in comps:
        cids = [int(corr_lab[n["y"], n["x"]]) for n in c if corr_lab[n["y"], n["x"]]]
        if not cids:
            continue
        maj = max(set(cids), key=cids.count)
        if maj not in keep_cids:
            continue
        if maj == giant_cid and len(c) < 40 and c is not comps[0]:
            continue
        keep_ids.update(n["id"] for n in c)
    if comps:
        keep_ids.update(n["id"] for n in comps[0])

    nodes = [n for n in nodes if n["id"] in keep_ids]
    edges = [e for e in edges if e["from"] in keep_ids and e["to"] in keep_ids]
    by_id = {n["id"]: n for n in nodes}
    comps = spine_components(nodes, edges)
    print(f"spine kept: nodes={len(nodes)} edges={len(edges)} comps={[len(c) for c in comps[:8]]}")

    corr_dist, corr_inds = corridor_projectors(corridor)
    sx, sy = W / 2000.0, H / 1956.0
    ocr = json.load(open(OCR))
    rooms = {}
    for h in ocr:
        if h.get("conf", 0) < 0.55:
            continue
        lab = parse_ground_room(h["text"])
        if not lab:
            continue
        x = int(round(h["x"] * sx))
        y = int(round(h["y"] * sy))
        if lab not in rooms or h["conf"] > rooms[lab]["conf"]:
            rooms[lab] = {"label": lab, "x": x, "y": y, "conf": h["conf"]}
    named = load_named_places(ocr, sx, sy)
    print(f"ocr rooms={len(rooms)} named={list(named)}")

    final_nodes, final_edges = [], []
    id_set, edge_seen = set(), set()

    def emit_node(n):
        if n["id"] in id_set:
            return
        final_nodes.append({k: v for k, v in n.items() if k not in ("gx", "gy", "r", "conf")})
        id_set.add(n["id"])

    def emit_edge(a, b, **meta):
        if a == b or a not in id_set or b not in id_set:
            return
        key = tuple(sorted([a, b]))
        if key in edge_seen:
            return
        edge_seen.add(key)
        e = {"id": f"e-{key[0]}-{key[1]}", "from": a, "to": b}
        e.update(meta)
        final_edges.append(e)

    for n in nodes:
        emit_node({"id": n["id"], "type": "corridor", "floor": "ground", "x": n["x"], "y": n["y"]})
    for e in edges:
        emit_edge(e["from"], e["to"], weight=e["weight"])

    STUB = 180
    kept, dropped = 0, []
    for label, r in sorted(rooms.items()):
        hit = nearest_spine(r["x"], r["y"], by_id, corridor, corr_dist, corr_inds, limit=STUB)
        if not hit or hit[3] > STUB:
            dropped.append(label)
            continue
        sid, dx, dy, dist = hit
        rid, did = f"r-{label.lower()}", f"door-{label.lower()}"
        emit_node({"id": rid, "type": "room", "floor": "ground", "x": r["x"], "y": r["y"], "label": label})
        emit_node({"id": did, "type": "corridor", "floor": "ground", "x": dx, "y": dy})
        emit_edge(rid, did, weight=round(math.hypot(r["x"] - dx, r["y"] - dy), 1))
        emit_edge(did, sid, weight=round(math.hypot(dx - by_id[sid]["x"], dy - by_id[sid]["y"]), 1))
        kept += 1
    print(f"rooms kept={kept} dropped={len(dropped)} {dropped[:15]}")

    for label, r in named.items():
        hit = nearest_spine(r["x"], r["y"], by_id, corridor, corr_dist, corr_inds, limit=STUB)
        if not hit:
            print("named drop", label)
            continue
        sid, dx, dy, dist = hit
        nid = f"place-{re.sub(r'[^a-z0-9]+', '-', label.lower()).strip('-')}"
        did = f"door-{nid}"
        emit_node({"id": nid, "type": "room", "floor": "ground", "x": r["x"], "y": r["y"], "label": label})
        emit_node({"id": did, "type": "corridor", "floor": "ground", "x": dx, "y": dy})
        emit_edge(nid, did, weight=round(math.hypot(r["x"] - dx, r["y"] - dy), 1))
        emit_edge(did, sid, weight=round(math.hypot(dx - by_id[sid]["x"], dy - by_id[sid]["y"]), 1))
        print(f"named keep {label} door=({dx},{dy}) dist={dist:.0f}")

    yel = json.load(open(YELLOW))
    stairs = 0
    for i, c in enumerate(yel):
        if c["n"] < 160:
            continue
        x, y = int(round(c["x"] * sx)), int(round(c["y"] * sy))
        hit = nearest_spine(x, y, by_id, corridor, corr_dist, corr_inds, limit=100)
        if not hit:
            continue
        sid, dx, dy, dist = hit
        stid = f"st-g-{i}"
        emit_node(
            {
                "id": stid,
                "type": "stair",
                "floor": "ground",
                "x": dx,
                "y": dy,
                "label": "Stairs",
                "connectorGroup": f"shaft-{dx // 80}-{dy // 80}",
            }
        )
        emit_edge(stid, sid)
        stairs += 1
    print(f"stairs={stairs}")

    graph = {
        "version": 3,
        "coordinateSpace": {
            "width": ORIG_W,
            "height": ORIG_H,
            "unit": "map-pixels",
            "note": "Ground: united wide-hall spine (blue-label-safe) + short door stubs. Real labels only.",
        },
        "floors": [
            {
                "id": f,
                "label": f.capitalize(),
                "imagePath": f"/floor-plans/{f}.png",
                "mapWidth": ORIG_W,
                "mapHeight": ORIG_H,
            }
            for f in ["basement", "ground", "first", "second", "third", "fourth"]
        ],
        "nodes": final_nodes,
        "edges": final_edges,
    }
    if W != ORIG_W or H != ORIG_H:
        for n in graph["nodes"]:
            n["x"] = int(round(n["x"] * ORIG_W / W))
            n["y"] = int(round(n["y"] * ORIG_H / H))

    os.makedirs(f"{REPO}/public/data", exist_ok=True)
    out_src = f"{REPO}/src/data/building-graph.json"
    with open(out_src, "w") as f:
        json.dump(graph, f, separators=(",", ":"))
    shutil.copy(out_src, f"{REPO}/public/data/building-graph.json")
    print(f"wrote {out_src} ({os.path.getsize(out_src)} bytes)")
    print(
        f"nodes={len(final_nodes)} edges={len(final_edges)} "
        f"rooms={sum(1 for n in final_nodes if n['type']=='room')}"
    )

    # Validate demos
    adj = defaultdict(list)
    for e in final_edges:
        adj[e["from"]].append(e["to"])
        adj[e["to"]].append(e["from"])
    nb = {n["id"]: n for n in final_nodes}

    def find_label(lab):
        for n in final_nodes:
            if n.get("label") == lab and n["type"] == "room":
                return n["id"]
        return None

    def dij(s, t):
        dist = {s: 0.0}
        prev = {}
        pq = [(0.0, s)]
        seen = set()
        while pq:
            d, u = heapq.heappop(pq)
            if u in seen:
                continue
            seen.add(u)
            if u == t:
                break
            ux, uy = nb[u]["x"], nb[u]["y"]
            for v in adj[u]:
                vx, vy = nb[v]["x"], nb[v]["y"]
                nd = d + math.hypot(ux - vx, uy - vy)
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = u
                    heapq.heappush(pq, (nd, v))
        if t not in prev and s != t:
            return None
        path = [t]
        while path[-1] != s:
            path.append(prev[path[-1]])
        path.reverse()
        return path

    def to_img(n):
        return int(round(n["x"] * W / ORIG_W)), int(round(n["y"] * H / ORIG_H))

    # Graph CC sizes
    seen = set()
    gcc = []
    for nid in nb:
        if nid in seen:
            continue
        q = deque([nid])
        seen.add(nid)
        c = []
        while q:
            u = q.popleft()
            c.append(u)
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    q.append(v)
        gcc.append(c)
    gcc.sort(key=len, reverse=True)
    print(f"graph CCs={len(gcc)} sizes={[len(c) for c in gcc[:10]]}")

    overlay = im.copy().convert("RGBA")
    layer = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    ys, xs = np.where(corridor)
    for y, x in zip(ys[::5], xs[::5]):
        draw.point((int(x), int(y)), fill=(0, 200, 180, 100))
    for n in nodes:
        draw.ellipse([n["x"] - 2, n["y"] - 2, n["x"] + 2, n["y"] + 2], fill=(20, 20, 20, 160))
    for e in edges:
        a, b = by_id[e["from"]], by_id[e["to"]]
        draw.line([a["x"], a["y"], b["x"], b["y"]], fill=(20, 20, 20, 120), width=2)

    demos = [
        ("AG10", "FG11"),
        ("AG76", "NG43"),
        ("AG76", "MG76"),
        ("AG76", "FG11"),
        ("LG71", "NG43"),
        ("Computer Lab", "MG76"),
        ("BG10", "MG11"),
        ("AG52", "LG71"),
        ("VWR", "AG76"),
        ("Loading Dock", "AG76"),
        ("NG43", "MG76"),
    ]
    for a, b in demos:
        sa, sb = find_label(a), find_label(b)
        if not sa or not sb:
            print(f"DEMO missing {a}->{b}")
            continue
        path = dij(sa, sb)
        if not path:
            print(f"DEMO no path {a}->{b}")
            continue
        pts = [to_img(nb[i]) for i in path]
        ok = total = 0
        for i in range(len(pts) - 1):
            if nb[path[i]]["type"] == "room" or nb[path[i + 1]]["type"] == "room":
                continue
            p0, p1 = pts[i], pts[i + 1]
            for s in range(12):
                t = s / 11
                x = int(p0[0] * (1 - t) + p1[0] * t)
                y = int(p0[1] * (1 - t) + p1[1] * t)
                total += 1
                if any(
                    0 <= x + dx < W and 0 <= y + dy < H and corridor[y + dy, x + dx]
                    for dx in range(-2, 3)
                    for dy in range(-2, 3)
                ):
                    ok += 1
        score = ok / total if total else 1
        print(f"DEMO {a}->{b}: n={len(path)} corridor={score:.0%}")
        col = (220, 30, 30, 230) if score >= 0.9 else (255, 140, 0, 230)
        for i in range(len(pts) - 1):
            draw.line([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]], fill=col, width=5)

    for lab in ["AG76", "NG43", "MG76", "LG71", "FG11", "AG10", "Computer Lab", "VWR", "BG10"]:
        nid = find_label(lab)
        if not nid:
            continue
        x, y = to_img(nb[nid])
        draw.ellipse([x - 7, y - 7, x + 7, y + 7], outline=(255, 210, 0, 255), width=3)

    out = Image.alpha_composite(overlay, layer)
    out.resize((1400, int(1400 * H / W)), Image.Resampling.LANCZOS).save(
        f"{OUT}/ground-spine-preview.png"
    )
    out.save(f"{OUT}/ground-spine-full.png")
    # Cross-wing crop: A to N / F
    out.crop((400, 200, 3200, 3600)).resize((1200, 1457), Image.LANCZOS).save(
        f"{OUT}/crosswing-routes.png"
    )
    print(f"preview {OUT}/ground-spine-preview.png")


if __name__ == "__main__":
    main()
