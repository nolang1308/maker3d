#!/usr/bin/env node
/**
 * 키보드 클리커 케이스 모델 변환기
 *
 *   node scripts/build-clicker-models.mjs
 *
 * clicker/ 폴더의 STL 을 읽어서 /cliker 페이지가 쓰는 두 가지를 만든다.
 *   - public/clicker-models/<id>.bin             3D 미리보기용 메시 (위치 + 인덱스)
 *   - src/utils/clicker/models.generated.json    키 위치 · 치수 · 고리 위치
 *
 * 파일 이름은 보지 않는다. 모델 모양에서 스위치 구멍(약 14mm)의 배열을 찾아 "3구", "4구 정사각형"
 * 같은 종류를 정하므로, 새 STL 을 폴더에 넣고 다시 실행하면 종류 목록에 자동으로 추가된다.
 * 한 파일에 케이스가 여러 개 들어 있으면 각각 따로 처리하고, 똑같은 것은 하나만 남긴다.
 * 닫혀 있지 않은(깨진) 메시는 건너뛰고 이유를 출력한다.
 *
 * STL 좌표계는 X 오른쪽 · Y 뒤쪽 · Z 위쪽으로 본다. 결과물의 좌표는
 *   - 위에서 본 좌표(JSON): x 오른쪽, y 앞쪽(화면 아래), 원점은 몸체 중심
 *   - 3D 메시(bin): (x, 바닥에서의 높이, y)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'clicker');
const MESH_DIR = path.join(ROOT, 'public', 'clicker-models');
const MANIFEST_PATH = path.join(ROOT, 'src', 'utils', 'clicker', 'models.generated.json');
const MESH_URL_BASE = '/clicker-models';

const WELD_TOLERANCE = 1e-3; // mm
const CELL = 0.25; // 높이 지도 한 칸 (mm)
const SWITCH_HOLE = 14; // MX 스위치 구멍 한 변 (mm)

const round = (v, digits = 3) => Number(v.toFixed(digits));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// ---------------------------------------------------------------------------
// STL 읽기
// ---------------------------------------------------------------------------

/** 삼각형 배열을 돌려준다. 각 삼각형은 [x0,y0,z0, x1,y1,z1, x2,y2,z2] */
function parseStl(buffer) {
  if (buffer.length >= 84) {
    const count = buffer.readUInt32LE(80);
    if (84 + count * 50 === buffer.length) {
      const tris = [];
      for (let i = 0; i < count; i++) {
        const base = 84 + i * 50 + 12;
        const tri = [];
        for (let k = 0; k < 9; k++) tri.push(buffer.readFloatLE(base + k * 4));
        tris.push(tri);
      }
      return tris;
    }
  }
  // ASCII: 온전한 facet 블록만 읽는다 (중간에 잘린 파일도 읽을 수 있는 데까지 읽힌다)
  const text = buffer.toString('latin1');
  const facet =
    /facet\s+normal\s+\S+\s+\S+\s+\S+\s+outer\s+loop\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+vertex\s+(\S+)\s+(\S+)\s+(\S+)\s+endloop\s+endfacet/g;
  const tris = [];
  let match;
  while ((match = facet.exec(text))) {
    const tri = match.slice(1).map(Number);
    if (tri.every(Number.isFinite)) tris.push(tri);
  }
  return tris;
}

/** 같은 위치의 꼭짓점을 하나로 합친다 */
function weld(tris) {
  const lookup = new Map();
  const positions = [];
  const triangles = [];
  const indexOf = (x, y, z) => {
    const key = `${Math.round(x / WELD_TOLERANCE)},${Math.round(y / WELD_TOLERANCE)},${Math.round(z / WELD_TOLERANCE)}`;
    let index = lookup.get(key);
    if (index === undefined) {
      index = positions.length;
      positions.push([x, y, z]);
      lookup.set(key, index);
    }
    return index;
  };
  for (const t of tris) {
    const a = indexOf(t[0], t[1], t[2]);
    const b = indexOf(t[3], t[4], t[5]);
    const c = indexOf(t[6], t[7], t[8]);
    if (a !== b && b !== c && c !== a) triangles.push([a, b, c]);
  }
  return { positions, triangles };
}

/** 서로 이어진 덩어리별로 나눈다 */
function splitComponents({ positions, triangles }) {
  const parent = positions.map((_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (const [a, b, c] of triangles) {
    const root = find(a);
    parent[find(b)] = root;
    parent[find(c)] = root;
  }
  const groups = new Map();
  for (const tri of triangles) {
    const root = find(tri[0]);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(tri);
  }
  return [...groups.values()].map((group) => {
    const remap = new Map();
    const partPositions = [];
    const partTriangles = group.map((tri) =>
      tri.map((index) => {
        if (!remap.has(index)) {
          remap.set(index, partPositions.length);
          partPositions.push(positions[index]);
        }
        return remap.get(index);
      }),
    );
    return { positions: partPositions, triangles: partTriangles };
  });
}

/** 한 번만 쓰인 모서리 수. 0 이어야 닫힌(출력 가능한) 메시다 */
function countOpenEdges({ triangles }) {
  const counts = new Map();
  for (const [a, b, c] of triangles) {
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = p < q ? `${p}_${q}` : `${q}_${p}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const count of counts.values()) if (count === 1) open += 1;
  return open;
}

function signedVolume({ positions, triangles }) {
  let volume = 0;
  for (const [a, b, c] of triangles) {
    const [ax, ay, az] = positions[a];
    const [bx, by, bz] = positions[b];
    const [cx, cy, cz] = positions[c];
    volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return volume / 6;
}

function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of positions) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// 모양 분석
// ---------------------------------------------------------------------------

/**
 * 키링 고리 찾기. 몸체의 옆면은 길게 이어지지만 고리의 끝은 폭이 좁다는 점을 이용한다.
 * 돌려주는 값: { axis: 0|1 (튀어나온 방향의 축), sign: -1|1, length, ... } 또는 null
 */
function findLug(positions, box) {
  for (const axis of [0, 1]) {
    const other = 1 - axis;
    for (const sign of [-1, 1]) {
      const extreme = sign < 0 ? box.min[axis] : box.max[axis];
      const depthOf = (p) => (sign < 0 ? p[axis] - extreme : extreme - p[axis]);
      const span = (limit) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const p of positions) {
          if (depthOf(p) <= limit) {
            lo = Math.min(lo, p[other]);
            hi = Math.max(hi, p[other]);
          }
        }
        return hi - lo;
      };
      if (span(0.6) >= 8) continue; // 이쪽 끝은 몸체의 넓은 면이다

      // 안쪽으로 들어가며 폭이 갑자기 넓어지는 곳이 몸체의 면
      const depths = [...new Set(positions.map((p) => round(depthOf(p), 2)))].sort((a, b) => a - b);
      const length = depths.find((d) => span(d + 0.005) >= 8);
      if (length === undefined || length > 12) continue;

      const lugPoints = positions.filter((p) => depthOf(p) < length - 0.02);
      const lugBox = bounds(lugPoints);
      return {
        axis,
        sign,
        length,
        /** 몸체 면의 좌표 */
        face: extreme + (sign < 0 ? length : -length),
        /** 옆으로의 위치와 두께 */
        center: (lugBox.min[other] + lugBox.max[other]) / 2,
        thickness: lugBox.max[other] - lugBox.min[other],
        zMin: lugBox.min[2],
        zMax: lugBox.max[2],
      };
    }
  }
  return null;
}

/** 고리의 구멍(옆으로 뚫린 원) 위치를 찾는다: 구멍 벽은 법선이 구멍 중심을 향한다 */
function findLugHole(part, lug) {
  const { positions, triangles } = part;
  const other = 1 - lug.axis;
  const outward = (p) => (lug.sign < 0 ? lug.face - p[lug.axis] : p[lug.axis] - lug.face);
  const lugTriangles = triangles.filter((tri) => tri.every((i) => outward(positions[i]) > -0.05));
  if (lugTriangles.length === 0) return null;

  let sumO = 0;
  let sumZ = 0;
  let n = 0;
  for (const tri of lugTriangles) {
    for (const i of tri) {
      sumO += outward(positions[i]);
      sumZ += positions[i][2];
      n += 1;
    }
  }
  const centroid = [sumO / n, sumZ / n];

  const holePoints = new Map();
  for (const tri of lugTriangles) {
    const [a, b, c] = tri.map((i) => positions[i]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...normal);
    if (len < 1e-9) continue;
    // 구멍 축(옆 방향)과 나란한 면(= 고리의 양쪽 평면)은 제외
    if (Math.abs(normal[other]) / len > 0.2) continue;
    const normalO = ((lug.sign < 0 ? -1 : 1) * normal[lug.axis]) / len;
    const normalZ = normal[2] / len;
    const mid = [(outward(a) + outward(b) + outward(c)) / 3, (a[2] + b[2] + c[2]) / 3];
    if (normalO * (mid[0] - centroid[0]) + normalZ * (mid[1] - centroid[1]) >= 0) continue; // 바깥 테두리
    for (const p of [a, b, c]) holePoints.set(`${round(outward(p), 3)},${round(p[2], 3)}`, [outward(p), p[2]]);
  }
  let points = [...holePoints.values()];
  if (points.length < 6) return null;
  let circle = fitCircle(points);
  if (!circle) return null;
  // 구멍 벽이 아닌 점이 섞였을 수 있으므로 원에서 먼 점을 빼고 한 번 더 맞춘다
  points = points.filter((p) => Math.abs(Math.hypot(p[0] - circle.x, p[1] - circle.y) - circle.r) < 0.15);
  if (points.length >= 6) circle = fitCircle(points) ?? circle;
  return { offset: circle.x, z: circle.y, radius: circle.r };
}

/** 점들에 가장 잘 맞는 원 (대수적 최소제곱) */
function fitCircle(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p[0], 0) / n;
  const my = points.reduce((s, p) => s + p[1], 0) / n;
  let suu = 0;
  let svv = 0;
  let suv = 0;
  let suuu = 0;
  let svvv = 0;
  let suvv = 0;
  let svuu = 0;
  for (const [x, y] of points) {
    const u = x - mx;
    const v = y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-12) return null;
  const a = (suuu + suvv) / 2;
  const b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det;
  const vc = (b * suu - a * suv) / det;
  return { x: mx + uc, y: my + vc, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) };
}

/** 위에서 내려다본 높이 지도 (칸마다 가장 높은 면의 z, 없으면 NaN) */
function heightMap({ positions, triangles }, x0, y0, width, height) {
  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const z = new Float32Array(cols * rows).fill(NaN);
  for (const tri of triangles) {
    const [a, b, c] = tri.map((i) => positions[i]);
    const ax = (a[0] - x0) / CELL;
    const ay = (a[1] - y0) / CELL;
    const bx = (b[0] - x0) / CELL;
    const by = (b[1] - y0) / CELL;
    const cx = (c[0] - x0) / CELL;
    const cy = (c[1] - y0) / CELL;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(det) < 1e-12) continue;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5));
    const i1 = Math.min(cols - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
    const j0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5));
    const j1 = Math.min(rows - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const px = i + 0.5;
        const py = j + 0.5;
        const wa = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det;
        const wb = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det;
        const wc = 1 - wa - wb;
        if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
        const value = wa * a[2] + wb * b[2] + wc * c[2];
        const at = j * cols + i;
        if (Number.isNaN(z[at]) || value > z[at]) z[at] = value;
      }
    }
  }
  return { z, cols, rows, x0, y0, at: (x, y) => z[Math.floor((y - y0) / CELL) * cols + Math.floor((x - x0) / CELL)] };
}

/** true 가 이어지는 구간들을 [시작 칸, 끝 칸] 으로 */
function runs(flags) {
  const result = [];
  let start = -1;
  flags.forEach((flag, i) => {
    if (flag && start < 0) start = i;
    if (!flag && start >= 0) {
      result.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) result.push([start, flags.length - 1]);
  return result;
}

/** 케이스 하나를 분석한다. 실패하면 이유(문자열)를 던진다 */
function analyze(part) {
  const box = bounds(part.positions);
  const totalHeight = box.max[2] - box.min[2];
  if (totalHeight < 5 || totalHeight > 60) throw new Error(`높이가 케이스 같지 않음 (${totalHeight.toFixed(1)}mm)`);

  const lug = findLug(part.positions, box);
  const body = { min: [box.min[0], box.min[1]], max: [box.max[0], box.max[1]] };
  if (lug) {
    if (lug.sign < 0) body.min[lug.axis] = lug.face;
    else body.max[lug.axis] = lug.face;
  }
  const width = body.max[0] - body.min[0];
  const depth = body.max[1] - body.min[1];
  const cx = (body.min[0] + body.max[0]) / 2;
  const cy = (body.min[1] + body.max[1]) / 2;

  const map = heightMap(part, body.min[0], body.min[1], width, depth);

  // 스위치 구멍: 케이스 바닥 근처까지 뚫려 보이는 칸.
  // 부품 사이의 가는 틈(0.2~0.3mm)이나 가장자리도 낮게 찍히므로, 가로세로로 1mm 이상 이어진 곳만 구멍으로 본다
  const holeLevel = box.min[2] + totalHeight * 0.25;
  const reach = Math.round(1 / CELL);
  const isLow = (i, j) => i >= 0 && i < map.cols && j >= 0 && j < map.rows && map.z[j * map.cols + i] < holeLevel;
  const isHole = (i, j) => {
    for (let d = -reach; d <= reach; d++) if (!isLow(i + d, j) || !isLow(i, j + d)) return false;
    return true;
  };
  const colFlags = Array.from({ length: map.cols }, (_, i) => {
    for (let j = 0; j < map.rows; j++) if (isHole(i, j)) return true;
    return false;
  });
  const rowFlags = Array.from({ length: map.rows }, (_, j) => {
    for (let i = 0; i < map.cols; i++) if (isHole(i, j)) return true;
    return false;
  });
  const colRuns = runs(colFlags);
  const rowRuns = runs(rowFlags);
  if (colRuns.length === 0 || rowRuns.length === 0) throw new Error('스위치 구멍을 찾지 못함');
  // 위에서 가장자리를 reach 칸씩 깎아 냈으므로 그만큼 되돌린다
  const toInterval = ([start, end], origin) => [origin + (start - reach) * CELL, origin + (end + 1 + reach) * CELL];
  // 높이 지도는 0.25mm 단위라 오차가 있으므로, 경계를 가장 가까운 실제 꼭짓점 좌표에 맞춘다
  const snapTo = (axis) => {
    const coords = [...new Set(part.positions.map((p) => round(p[axis], 3)))].sort((a, b) => a - b);
    return (value) => {
      let best = value;
      let bestDistance = 0.3;
      for (const c of coords) {
        const d = Math.abs(c - value);
        if (d < bestDistance) {
          best = c;
          bestDistance = d;
        }
      }
      return best;
    };
  };
  const snapX = snapTo(0);
  const snapY = snapTo(1);
  const xIntervals = colRuns.map((run) => toInterval(run, body.min[0]).map(snapX));
  const yIntervals = rowRuns.map((run) => toInterval(run, body.min[1]).map(snapY));
  for (const [lo, hi] of [...xIntervals, ...yIntervals]) {
    if (Math.abs(hi - lo - SWITCH_HOLE) > 1.5) {
      throw new Error(`스위치 구멍 크기가 ${SWITCH_HOLE}mm 가 아님 (${(hi - lo).toFixed(1)}mm)`);
    }
  }
  for (const [xa, xb] of xIntervals) {
    for (const [ya, yb] of yIntervals) {
      if (!(map.at((xa + xb) / 2, (ya + yb) / 2) < holeLevel)) throw new Error('스위치 구멍이 격자 모양으로 놓여 있지 않음');
    }
  }

  // 스위치가 얹히는 판의 높이: 구멍 가장자리 바로 바깥
  const plateSamples = [];
  for (const [xa, xb] of xIntervals) {
    for (const [ya, yb] of yIntervals) {
      const mx = (xa + xb) / 2;
      const my = (ya + yb) / 2;
      plateSamples.push(map.at(mx, ya - 0.5), map.at(mx, yb + 0.5), map.at(xa - 0.5, my), map.at(xb + 0.5, my));
    }
  }
  const plateZ = median(plateSamples.filter(Number.isFinite));

  // 키캡이 들어가는 안쪽 공간(테두리 벽 안쪽)
  let wellMinI = Infinity;
  let wellMaxI = -Infinity;
  let wellMinJ = Infinity;
  let wellMaxJ = -Infinity;
  const isSunken = (i, j) =>
    i >= 0 && i < map.cols && j >= 0 && j < map.rows && map.z[j * map.cols + i] <= plateZ + 2.6;
  for (let j = 0; j < map.rows; j++) {
    for (let i = 0; i < map.cols; i++) {
      // 가장자리의 가는 줄은 빼고, 가로세로 1mm 이상 이어진 낮은 곳만
      let thick = true;
      for (let d = -reach; d <= reach && thick; d++) thick = isSunken(i + d, j) && isSunken(i, j + d);
      if (!thick) continue;
      wellMinI = Math.min(wellMinI, i - reach);
      wellMaxI = Math.max(wellMaxI, i + reach);
      wellMinJ = Math.min(wellMinJ, j - reach);
      wellMaxJ = Math.max(wellMaxJ, j + reach);
    }
  }
  const wellX = [snapX(body.min[0] + wellMinI * CELL), snapX(body.min[0] + (wellMaxI + 1) * CELL)];
  const wellY = [snapY(body.min[1] + wellMinJ * CELL), snapY(body.min[1] + (wellMaxJ + 1) * CELL)];

  // 바깥 모서리 반경: 모서리에서 비어 있는 넓이 = r² (1 - π/4)
  const cornerCells = Math.round(6 / CELL);
  const radii = [];
  for (const fromRight of [false, true]) {
    for (const fromTop of [false, true]) {
      let empty = 0;
      for (let j = 0; j < cornerCells; j++) {
        for (let i = 0; i < cornerCells; i++) {
          const ii = fromRight ? map.cols - 1 - i : i;
          const jj = fromTop ? map.rows - 1 - j : j;
          if (Number.isNaN(map.z[jj * map.cols + ii])) empty += 1;
        }
      }
      radii.push(Math.sqrt((empty * CELL * CELL) / (1 - Math.PI / 4)));
    }
  }

  // --- 결과 좌표로 옮기기: 위에서 본 좌표는 (X - cx, -(Y - cy)) ---
  const topX = (x) => x - cx;
  const topY = (y) => -(y - cy);
  const keys = [];
  // 뒤쪽 줄(STL 의 +Y)부터, 왼쪽에서 오른쪽으로
  for (const [ya, yb] of [...yIntervals].reverse()) {
    for (const [xa, xb] of xIntervals) keys.push({ x: round(topX((xa + xb) / 2), 2), y: round(topY((ya + yb) / 2), 2) });
  }

  let lugInfo = null;
  if (lug) {
    const hole = findLugHole(part, lug);
    const direction = lug.axis === 0 ? { dx: lug.sign, dy: 0 } : { dx: 0, dy: -lug.sign };
    const anchor =
      lug.axis === 0 ? { x: topX(lug.face), y: topY(lug.center) } : { x: topX(lug.center), y: topY(lug.face) };
    lugInfo = {
      x: round(anchor.x, 2),
      y: round(anchor.y, 2),
      ...direction,
      length: round(lug.length, 2),
      thickness: round(lug.thickness, 2),
      hole: {
        offset: round(hole ? hole.offset : lug.length * 0.35, 2),
        height: round((hole ? hole.z : (lug.zMin + lug.zMax) / 2) - box.min[2], 2),
        radius: round(hole ? hole.radius : 1, 2),
      },
    };
  }

  const mesh = {
    positions: part.positions.map((p) => [p[0] - cx, p[2] - box.min[2], -(p[1] - cy)]),
    triangles: part.triangles,
  };

  return {
    cols: xIntervals.length,
    rows: yIntervals.length,
    body: {
      width: round(width, 2),
      depth: round(depth, 2),
      height: round(totalHeight, 2),
      cornerRadius: round(median(radii), 1),
    },
    well: {
      x: round(topX(wellX[0]), 2),
      y: round(topY(wellY[1]), 2),
      w: round(wellX[1] - wellX[0], 2),
      h: round(wellY[1] - wellY[0], 2),
    },
    plateHeight: round(plateZ - box.min[2]),
    keys,
    lug: lugInfo,
    mesh,
  };
}

// ---------------------------------------------------------------------------
// 내보내기
// ---------------------------------------------------------------------------

/** 'CLKM' | 버전 | 꼭짓점 수 | 삼각형 수 | 인덱스 바이트 수 | float32 위치 | 인덱스 */
function encodeMesh({ positions, triangles }) {
  const indexSize = positions.length > 65535 ? 4 : 2;
  const header = Buffer.alloc(20);
  header.write('CLKM', 0, 'latin1');
  header.writeUInt32LE(1, 4);
  header.writeUInt32LE(positions.length, 8);
  header.writeUInt32LE(triangles.length, 12);
  header.writeUInt32LE(indexSize, 16);
  const vertexData = Buffer.alloc(positions.length * 12);
  positions.forEach((p, i) => {
    vertexData.writeFloatLE(p[0], i * 12);
    vertexData.writeFloatLE(p[1], i * 12 + 4);
    vertexData.writeFloatLE(p[2], i * 12 + 8);
  });
  const indexData = Buffer.alloc(triangles.length * 3 * indexSize);
  triangles.forEach((tri, i) => {
    tri.forEach((index, k) => {
      if (indexSize === 2) indexData.writeUInt16LE(index, (i * 3 + k) * 2);
      else indexData.writeUInt32LE(index, (i * 3 + k) * 4);
    });
  });
  return Buffer.concat([header, vertexData, indexData]);
}

function describeLayout(cols, rows) {
  const count = cols * rows;
  if (count === 1) return '키 1개';
  if (rows === 1 || cols === 1) return '일자형';
  if (rows === cols) return `정사각형 ${cols}×${rows}`;
  return `${cols}×${rows}`;
}

function lugSide(lug) {
  if (!lug) return 'none';
  if (lug.dx < 0) return 'left';
  if (lug.dx > 0) return 'right';
  return lug.dy < 0 ? 'top' : 'bottom';
}

const LUG_NOTE = { left: '고리 옆', right: '고리 옆', top: '고리 위', bottom: '고리 아래', none: '고리 없음' };

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`모델 폴더가 없습니다: ${SOURCE_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.toLowerCase().endsWith('.stl'))
    .sort((a, b) => a.localeCompare(b, 'ko'));

  const found = [];
  const skipped = [];
  for (const file of files) {
    const tris = parseStl(fs.readFileSync(path.join(SOURCE_DIR, file)));
    if (tris.length === 0) {
      skipped.push(`${file}: 읽을 수 있는 면이 없음`);
      continue;
    }
    const parts = splitComponents(weld(tris)).filter((part) => part.triangles.length >= 100);
    let usable = 0;
    const reasons = [];
    for (const part of parts) {
      const open = countOpenEdges(part);
      if (open > 0) {
        reasons.push(`면 ${part.triangles.length}개짜리 덩어리가 닫혀 있지 않음 (열린 모서리 ${open}개)`);
        continue;
      }
      if (signedVolume(part) < 0) part.triangles = part.triangles.map(([a, b, c]) => [a, c, b]);
      try {
        found.push({ file, ...analyze(part) });
        usable += 1;
      } catch (err) {
        reasons.push(err.message);
      }
    }
    if (usable === 0) skipped.push(`${file}: ${reasons.join(' / ') || '케이스를 찾지 못함'}`);
  }

  // 같은 배열 · 같은 고리 방향 · 같은 크기면 같은 모델로 본다 (한 파일에 복사본이 들어 있는 경우)
  const unique = [];
  for (const model of found) {
    const signature = [model.cols, model.rows, lugSide(model.lug), model.body.width, model.body.depth, model.mesh.triangles.length].join('|');
    if (unique.some((m) => m.signature === signature)) continue;
    unique.push({ ...model, signature });
  }

  unique.sort(
    (a, b) =>
      a.cols * a.rows - b.cols * b.rows || a.rows - b.rows || lugSide(a.lug).localeCompare(lugSide(b.lug)),
  );

  const baseCounts = new Map();
  for (const model of unique) {
    const base = `${model.cols}x${model.rows}`;
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  fs.rmSync(MESH_DIR, { recursive: true, force: true });
  fs.mkdirSync(MESH_DIR, { recursive: true });

  const usedIds = new Set();
  const manifest = unique.map((model) => {
    const base = `${model.cols}x${model.rows}`;
    const variant = baseCounts.get(base) > 1;
    let id = variant ? `${base}-${lugSide(model.lug)}` : base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${lugSide(model.lug)}-${n}`;
    usedIds.add(id);

    const data = encodeMesh(model.mesh);
    fs.writeFileSync(path.join(MESH_DIR, `${id}.bin`), data);

    const count = model.cols * model.rows;
    const description = describeLayout(model.cols, model.rows) + (variant ? ` · ${LUG_NOTE[lugSide(model.lug)]}` : '');
    return {
      id,
      label: `${count}구`,
      description,
      source: model.file,
      mesh: `${MESH_URL_BASE}/${id}.bin`,
      meshBytes: data.length,
      triangles: model.mesh.triangles.length,
      cols: model.cols,
      rows: model.rows,
      body: model.body,
      well: model.well,
      plateHeight: model.plateHeight,
      keys: model.keys,
      lug: model.lug,
    };
  });

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`모델 ${manifest.length}개를 만들었습니다.\n`);
  for (const m of manifest) {
    const size = `${m.body.width} × ${m.body.depth} × ${m.body.height}mm`;
    console.log(
      `  ${m.id.padEnd(10)} ${m.label.padEnd(3)} ${m.description.padEnd(18)} ${size.padEnd(26)} ${String(m.triangles).padStart(5)}면 ${(m.meshBytes / 1024).toFixed(0).padStart(3)}KB  ← ${m.source}`,
    );
  }
  if (skipped.length > 0) {
    console.log(`\n건너뛴 파일 ${skipped.length}개:`);
    for (const line of skipped) console.log(`  ✗ ${line}`);
  }
  console.log(`\n  메시: ${path.relative(ROOT, MESH_DIR)}/`);
  console.log(`  목록: ${path.relative(ROOT, MANIFEST_PATH)}`);
}

main();
