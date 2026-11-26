/**
 * 쉐이프 클리커: 로고 그림의 모양에서 클리커 부품의 외곽선을 만든다.
 *
 * 전부 브라우저 안에서 계산한다 (서버로 보내는 것이 없다). 흐름은 다음과 같다.
 *   1. 그림에서 "로고인 부분"을 격자에 옮긴다 (한 칸 약 0.1mm)
 *   2. 여백만큼 부풀리고, 떨어진 조각이 있으면 이어 붙여 한 덩어리로 만든다
 *   3. 스위치가 들어갈 자리를 찾는다 (자리가 모자라면 그 부분만 넓힌다)
 *   4. 그 모양이 "누르는 곳(뚜껑)"이 되고, 바깥으로 일정하게 키운 선들이 뚜껑이 들어가는 자리와 몸체가 된다
 *
 * 좌표는 위에서 내려다본 것으로 x 는 오른쪽, y 는 앞쪽(화면 아래)이다. 단위는 mm, 원점은 몸체 중심.
 * 3D 에서는 (x, y) 가 그대로 (x, z) 가 된다 — /clicker 와 같은 약속이다.
 */

import { CASE_SPEC, CLICKER, type ClickerLug } from '../clicker/layouts';

export type Pt = [number, number];
/** 닫힌 선. 끝점을 되풀이하지 않는다. 넓이가 양수가 되는 방향으로 돈다 */
export type Loop = Pt[];

/** 치수 (mm). 케이스 높이 · 스위치 판 · 키캡 높이는 준비된 클리커와 같게 맞춘다 */
export const SHAPE_SPEC = {
  bodyHeight: CASE_SPEC.height,
  /** 바닥에서 스위치가 걸리는 판 윗면까지 */
  plateHeight: CASE_SPEC.plateHeight,
  /** 스위치 걸쇠가 걸리는 판의 두께 */
  plateThickness: 1.5,
  floorThickness: 2,
  /** 뚜껑 둘레를 감싸는 벽의 두께 */
  rim: 2,
  /** 뚜껑과 벽 사이의 틈 */
  gap: 0.4,
  bodyBevel: 0.7,
  /** MX 스위치 구멍 한 변 */
  switchHole: 14,
  /** 판 아래, 스위치 몸통이 들어가는 공간 한 변 */
  pocket: 16,
  pocketRadius: 1.2,
  capHeight: CLICKER.keycapHeight,
  /** 스위치 판에서 뚜껑 바닥까지 (스위치에 끼웠을 때) */
  capSeat: CLICKER.keycapSeat,
  capTravel: CLICKER.keyTravel,
  capTop: 1.6,
  capWall: 1.2,
  capBevel: 0.6,
  /** 뚜껑 안에 스위치 윗부분이 들어가려면 필요한 네모 자리 한 변 (속 16.6 + 벽 1.2 × 2) */
  seat: 19,
  seatRadius: 2.4,
  /** 오목한 모서리를 둥글리는 반경. 이보다 좁은 틈은 메워진다 */
  smooth: 1,
  /** 떨어진 조각을 잇는 다리의 폭 */
  bridge: 2.6,
  /** 이보다 작은 조각은 잡티로 보고 버린다 (mm²) */
  minPiece: 0.25,
  /** 스위치 축을 끼우는 기둥 (MX 십자, FDM 출력 공차 포함) */
  stemRadius: 2.75,
  stemCrossLength: 4,
  stemCrossWidth: 1.3,
  stemBottom: 1,
  stemCrossDepth: 4.2,
  size: { min: 30, max: 90, initial: 45 },
  margin: { min: 0, max: 5, initial: 1.5 },
} as const;

export interface ShapeSource {
  /** 칸마다 로고인 정도 (0 ~ 255). 128 이상을 로고로 본다 */
  matte: Uint8Array;
  width: number;
  height: number;
}

export interface ShapeParams {
  /** 완성품(몸체)의 긴 쪽 길이 */
  sizeMm: number;
  /** 로고 둘레에 두르는 여백 */
  marginMm: number;
  /** 스위치 위치: 그림 전체를 0 ~ 1 로 본 좌표. null 이면 알아서 정한다 */
  switchAt: { u: number; v: number } | null;
  lug: boolean;
  /** 고리 위치: 위쪽이 0°, 시계 방향. null 이면 몸체의 맨 위 */
  lugAngle: number | null;
  /** 격자를 성기게 해서 빨리 계산한다 (슬라이더를 끄는 동안) */
  draft?: boolean;
}

export interface ShapeDesign {
  /** 누르는 곳(뚜껑)의 외곽 */
  cap: Loop;
  /** 뚜껑 윗면: 모서리를 깎고 남은 평평한 곳. 아주 가는 모양이면 여러 조각 */
  capTop: Loop[];
  /** 뚜껑 속 빈 곳 */
  hollows: Loop[];
  /** hollows 가운데 스위치가 들어가는 것 */
  switchHollow: number;
  /** 몸체에서 뚜껑이 들어가는 자리 */
  well: Loop;
  /** 몸체 외곽 (옆면) */
  body: Loop;
  /** 몸체 윗면 · 바닥면의 외곽 (모서리를 깎은 선) */
  bodyInset: Loop;
  switchAt: { x: number; y: number };
  /** 스위치 위치를 그림 기준 0 ~ 1 로 나타낸 것 */
  switchUV: { u: number; v: number };
  lug: ClickerLug | null;
  /** 고리가 달린 방향 (위쪽이 0°, 시계 방향). 고리가 없으면 0 */
  lugAngle: number;
  /** 원본 그림 전체가 놓이는 자리 (뚜껑 윗면에 그림을 입힐 때 쓴다) */
  imageRect: { x: number; y: number; w: number; h: number };
  size: { width: number; depth: number; height: number };
  notes: {
    /** 떨어져 있던 조각을 이어 붙였다 */
    joined: boolean;
    /** 스위치 자리가 모자라 그 부분을 넓혔다 */
    seatAdded: boolean;
  };
}

export class ShapeError extends Error {
  constructor(
    public readonly reason: 'empty' | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'ShapeError';
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// 격자 연산
// ---------------------------------------------------------------------------

const FAR = 1e12;

interface Grid {
  w: number;
  h: number;
}

/**
 * 칸마다 가장 가까운 "켜진 칸"까지의 거리의 제곱 (Felzenszwalb · Huttenlocher).
 * feature 를 넘기면 그 가장 가까운 칸의 번호도 채운다.
 */
function squaredDistance(mask: Uint8Array, { w, h }: Grid, feature?: Int32Array): Float32Array {
  const out = new Float32Array(w * h);
  const column = new Float32Array(w * h);
  const columnSite = feature ? new Int32Array(w * h) : null;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const arg = new Int32Array(n);

  const transform = (length: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < length; q++) {
      let p = v[k];
      let s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      while (s <= z[k]) {
        k--;
        p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
      arg[q] = p;
    }
  };

  // 세로 방향
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = mask[y * w + x] ? 0 : FAR;
    transform(h);
    for (let y = 0; y < h; y++) {
      column[y * w + x] = d[y];
      if (columnSite) columnSite[y * w + x] = arg[y];
    }
  }
  // 가로 방향
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = column[row + x];
    transform(w);
    for (let x = 0; x < w; x++) {
      out[row + x] = d[x];
      if (feature && columnSite) {
        const sx = arg[x];
        feature[row + x] = columnSite[row + sx] * w + sx;
      }
    }
  }
  return out;
}

/** 켜진 칸에서 r 칸 안에 있는 칸을 모두 켠다 */
function dilate(mask: Uint8Array, grid: Grid, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const sq = squaredDistance(mask, grid);
  const limit = r * r;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = sq[i] <= limit ? 1 : 0;
  return out;
}

/** 꺼진 칸에서 r 칸 안에 있는 칸을 모두 끈다 */
function erode(mask: Uint8Array, grid: Grid, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  const inverse = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inverse[i] = mask[i] ? 0 : 1;
  const sq = squaredDistance(inverse, grid);
  const limit = r * r;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = sq[i] > limit ? 1 : 0;
  return out;
}

/** 부풀렸다가 같은 만큼 줄인다: 2r 보다 좁은 틈과 오목한 곳이 메워진다 */
const close = (mask: Uint8Array, grid: Grid, r: number) => erode(dilate(mask, grid, r), grid, r);

/** 꺼진 칸까지의 거리 (칸). 켜진 칸 안쪽으로 갈수록 커진다 */
function depthInside(mask: Uint8Array, grid: Grid): Float32Array {
  const inverse = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) inverse[i] = mask[i] ? 0 : 1;
  const sq = squaredDistance(inverse, grid);
  for (let i = 0; i < sq.length; i++) sq[i] = Math.sqrt(sq[i]);
  return sq;
}

/** 켜진 칸까지의 거리 (칸) */
function distanceOutside(mask: Uint8Array, grid: Grid): Float32Array {
  const sq = squaredDistance(mask, grid);
  for (let i = 0; i < sq.length; i++) sq[i] = Math.sqrt(sq[i]);
  return sq;
}

/** 이어진 덩어리마다 번호(1부터)를 붙인다. 대각선으로 닿아도 이어진 것으로 본다 */
function labelPieces(mask: Uint8Array, { w, h }: Grid): { labels: Int32Array; areas: number[] } {
  const labels = new Int32Array(w * h);
  const areas: number[] = [0];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    const id = areas.length;
    let top = 0;
    let area = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top > 0) {
      const i = stack[--top];
      area++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const j = ny * w + nx;
          if (mask[j] && !labels[j]) {
            labels[j] = id;
            stack[top++] = j;
          }
        }
      }
    }
    areas.push(area);
  }
  return { labels, areas };
}

/** 안쪽에 갇힌 빈 곳을 메운다 */
function fillHoles(mask: Uint8Array, { w, h }: Grid): Uint8Array {
  const outside = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      stack[top++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (top > 0) {
    const i = stack[--top];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/** 칸마다, 그 칸을 중심으로 모양 안에 들어가는 가장 큰 바른 네모의 절반 크기 (칸) */
function squareClearance(mask: Uint8Array, { w, h }: Grid): Int32Array {
  const c = new Int32Array(w * h);
  const big = w + h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        c[i] = 1;
        continue;
      }
      c[i] = Math.min(big, c[i - 1], c[i - w], c[i - w - 1], c[i - w + 1]) + 1;
    }
  }
  for (let y = h - 2; y > 0; y--) {
    for (let x = w - 2; x > 0; x--) {
      const i = y * w + x;
      if (!mask[i]) continue;
      c[i] = Math.min(c[i], c[i + 1] + 1, c[i + w] + 1, c[i + w + 1] + 1, c[i + w - 1] + 1);
    }
  }
  return c;
}

// ---------------------------------------------------------------------------
// 외곽선 뽑기
// ---------------------------------------------------------------------------

/**
 * 점들을 눈에 보이지 않을 만큼(0.00002mm) 흩뜨린다.
 * 격자에서 뽑은 점들은 같은 가로줄 · 세로줄 위에 정확히 놓인 것이 많은데, 면을 삼각형으로 나누는 계산은
 * 정확히 한 줄에 놓인 점을 건너뛰어서 이웃 면과 꼭짓점이 어긋난다 (출력용 파일에 틈이 생긴다).
 */
export function unalign(loop: Loop, seed: number): Loop {
  const noise = (i: number, k: number) => {
    const v = Math.sin(i * 12.9898 + (seed + k) * 78.233) * 43758.5453;
    return (v - Math.floor(v) - 0.5) * 4e-5;
  };
  return loop.map(([x, y], i): Pt => [x + noise(i, 0), y + noise(i, 1)]);
}

/** 선의 넓이 (도는 방향에 따라 부호가 바뀐다) */
export function loopArea(loop: Loop): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i];
    const [x1, y1] = loop[(i + 1) % loop.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

export function loopBounds(loop: Loop): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of loop) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInLoop(x: number, y: number, loop: Loop): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, yi] = loop[i];
    const [xj, yj] = loop[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 격자 한두 칸 크기의 잔물결을 편다 (이웃 점과 1:2:1 로 섞기를 되풀이).
 * 잔물결은 0.01mm 남짓이라 치수에는 영향이 없지만, 그대로 두면 옆면의 음영에 세로 줄무늬가 생긴다.
 */
function relaxLoop(loop: Loop, rounds: number): Loop {
  const n = loop.length;
  if (n < 8) return loop;
  let xs = Float64Array.from(loop, (p) => p[0]);
  let ys = Float64Array.from(loop, (p) => p[1]);
  let nx = new Float64Array(n);
  let ny = new Float64Array(n);
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? n - 1 : i - 1;
      const b = i === n - 1 ? 0 : i + 1;
      nx[i] = (xs[a] + 2 * xs[i] + xs[b]) / 4;
      ny[i] = (ys[a] + 2 * ys[i] + ys[b]) / 4;
    }
    [xs, nx] = [nx, xs];
    [ys, ny] = [ny, ys];
  }
  return Array.from({ length: n }, (_, i): Pt => [xs[i], ys[i]]);
}

/** 꼭짓점을 줄인다 (Douglas–Peucker). 닫힌 선이므로 가장 먼 두 점을 고정하고 양쪽을 따로 줄인다 */
function simplifyLoop(loop: Loop, tolerance: number): Loop {
  const n = loop.length;
  if (n <= 8 || tolerance <= 0) return loop;
  let far = 0;
  let farDist = -1;
  for (let i = 1; i < n; i++) {
    const dist = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2;
    if (dist > farDist) {
      farDist = dist;
      far = i;
    }
  }
  const keep = new Uint8Array(n + 1);
  keep[0] = 1;
  keep[far] = 1;
  keep[n] = 1;
  const at = (i: number) => loop[i % n];
  const tol2 = tolerance * tolerance;
  const stack: [number, number][] = [
    [0, far],
    [far, n],
  ];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    if (b - a < 2) continue;
    const [ax, ay] = at(a);
    const [bx, by] = at(b);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1;
    let worstDist = tol2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = at(i);
      let dist: number;
      if (len2 < 1e-12) {
        dist = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
        dist = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (dist > worstDist) {
        worstDist = dist;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: Loop = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(loop[i]);
  return out;
}

/**
 * 값이 level 을 넘는(above) 또는 못 미치는 칸들의 테두리를 닫힌 선으로 뽑는다 (marching squares).
 * 좌표는 칸 중심을 정수로 본 격자 좌표. 격자 가장자리 칸은 반드시 바깥이어야 한다.
 */
function traceLevel(field: Float32Array, { w, h }: Grid, level: number, above: boolean): Loop[] {
  const sign = above ? 1 : -1;
  const g = (i: number) => sign * (field[i] - level);
  const next = new Int32Array(2 * w * h).fill(-1);
  const px = new Float32Array(2 * w * h);
  const py = new Float32Array(2 * w * h);

  // 변 번호: 가로 변 (x,y)-(x+1,y) = 2·(y·w+x), 세로 변 (x,y)-(x,y+1) = 2·(y·w+x)+1
  const crossH = (x: number, y: number): number => {
    const i = y * w + x;
    const key = 2 * i;
    const a = g(i);
    const b = g(i + 1);
    px[key] = x + a / (a - b);
    py[key] = y;
    return key;
  };
  const crossV = (x: number, y: number): number => {
    const i = y * w + x;
    const key = 2 * i + 1;
    const a = g(i);
    const b = g(i + w);
    px[key] = x;
    py[key] = y + a / (a - b);
    return key;
  };

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const ga = g(i);
      const gb = g(i + 1);
      const gc = g(i + w + 1);
      const gd = g(i + w);
      const kind = (ga > 0 ? 1 : 0) | (gb > 0 ? 2 : 0) | (gc > 0 ? 4 : 0) | (gd > 0 ? 8 : 0);
      if (kind === 0 || kind === 15) continue;
      const T = () => crossH(x, y);
      const B = () => crossH(x, y + 1);
      const L = () => crossV(x, y);
      const R = () => crossV(x + 1, y);
      const link = (from: number, to: number) => {
        next[from] = to;
      };
      switch (kind) {
        case 1:
          link(T(), L());
          break;
        case 2:
          link(R(), T());
          break;
        case 4:
          link(B(), R());
          break;
        case 8:
          link(L(), B());
          break;
        case 3:
          link(R(), L());
          break;
        case 6:
          link(B(), T());
          break;
        case 12:
          link(L(), R());
          break;
        case 9:
          link(T(), B());
          break;
        case 14:
          link(L(), T());
          break;
        case 13:
          link(T(), R());
          break;
        case 11:
          link(R(), B());
          break;
        case 7:
          link(B(), L());
          break;
        case 5: {
          // 대각선으로 마주 본 두 칸: 가운데 값으로 이어진 쪽을 정한다
          if (ga + gb + gc + gd > 0) {
            link(T(), R());
            link(B(), L());
          } else {
            link(T(), L());
            link(B(), R());
          }
          break;
        }
        default: {
          // 10
          if (ga + gb + gc + gd > 0) {
            link(L(), T());
            link(R(), B());
          } else {
            link(R(), T());
            link(L(), B());
          }
        }
      }
    }
  }

  const loops: Loop[] = [];
  const seen = new Uint8Array(next.length);
  for (let start = 0; start < next.length; start++) {
    if (next[start] < 0 || seen[start]) continue;
    const loop: Loop = [];
    let key = start;
    let guard = next.length;
    while (!seen[key] && guard-- > 0) {
      seen[key] = 1;
      loop.push([px[key], py[key]]);
      key = next[key];
      if (key < 0) break;
    }
    if (key === start && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

// ---------------------------------------------------------------------------
// 로고 → 부품 외곽선
// ---------------------------------------------------------------------------

/**
 * 떨어진 조각들을 다리로 잇는다. 조각마다 가장 가까운 이웃 조각과 제일 가까운 두 점 사이에 굵은 선을 긋는다.
 * (크게 부풀렸다 줄여서 붙이면 로고의 오목한 곳이 전부 메워지므로, 필요한 곳에만 다리를 놓는다)
 * 다리를 놓았으면 true.
 */
function bridgePieces(mask: Uint8Array, grid: Grid, width: number): boolean {
  const { labels, areas } = labelPieces(mask, grid);
  const count = areas.length - 1;
  if (count <= 1) return false;
  const { w, h } = grid;
  const feature = new Int32Array(w * h);
  const sq = squaredDistance(mask, grid, feature);

  // 서로 이웃한 조각 사이의 가장 짧은 길: "가장 가까운 조각"이 바뀌는 경계에서 양쪽 조각의 가장 가까운 칸을 잇는다
  const links = new Map<number, { gap: number; from: number; to: number }>();
  const note = (i: number, j: number) => {
    const a = labels[feature[i]];
    const b = labels[feature[j]];
    if (a === b) return;
    const key = a < b ? a * (count + 1) + b : b * (count + 1) + a;
    const gap = Math.sqrt(sq[i]) + Math.sqrt(sq[j]) + 1;
    const known = links.get(key);
    if (!known || gap < known.gap) links.set(key, { gap, from: feature[i], to: feature[j] });
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x < w - 1) note(i, i + 1);
      if (y < h - 1) note(i, i + w);
    }
  }

  // 짧은 길부터 골라 모두 한 덩어리가 될 때까지 (최소 신장 트리)
  const parent = Array.from({ length: count + 1 }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const radius = width / 2;
  for (const [key, link] of [...links.entries()].sort((a, b) => a[1].gap - b[1].gap)) {
    const a = find(Math.floor(key / (count + 1)));
    const b = find(key % (count + 1));
    if (a === b) continue;
    parent[a] = b;
    const ax = link.from % w;
    const ay = (link.from - ax) / w;
    const bx = link.to % w;
    const by = (link.to - bx) / w;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = Math.max(1, Math.floor(Math.min(ay, by) - radius)); y <= Math.min(h - 2, Math.ceil(Math.max(ay, by) + radius)); y++) {
      for (let x = Math.max(1, Math.floor(Math.min(ax, bx) - radius)); x <= Math.min(w - 2, Math.ceil(Math.max(ax, bx) + radius)); x++) {
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / len2, 0, 1);
        if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= radius * radius) mask[y * w + x] = 1;
      }
    }
  }
  return true;
}

function largestLoop(loops: Loop[]): Loop | null {
  let best: Loop | null = null;
  let bestArea = 0;
  for (const loop of loops) {
    const area = Math.abs(loopArea(loop));
    if (area > bestArea) {
      bestArea = area;
      best = loop;
    }
  }
  return best;
}

/**
 * 몸체 옆면에서 고리가 붙을 자리와 바깥 방향을 찾는다.
 * angleDeg 가 null 이면 몸체의 맨 위(여러 곳이면 가운데에 가까운 곳)에 단다.
 */
function placeLug(body: Loop, angleDeg: number | null): { lug: ClickerLug; angle: number } {
  const n = body.length;
  const at = (i: number) => body[((i % n) + n) % n];
  // 넓이 중심
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = body[i];
    const [bx, by] = at(i + 1);
    const cross = ax * by - bx * ay;
    area += cross;
    cx += (ax + bx) * cross;
    cy += (ay + by) * cross;
  }
  cx /= 3 * area;
  cy /= 3 * area;

  let px = cx;
  let py = cy;
  let edge = 0;
  if (angleDeg === null) {
    let top = Infinity;
    for (const [, y] of body) if (y < top) top = y;
    // 맨 위에서 0.4mm 안쪽에 드는 외곽 가운데, 좌우로 가운데에 가장 가까운 점 (꼭짓점 사이의 점도 본다)
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = body[i];
      const [bx, by] = at(i + 1);
      const t = Math.abs(bx - ax) < 1e-9 ? 0 : clamp((cx - ax) / (bx - ax), 0, 1);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (y > top + 0.4) continue;
      const off = Math.abs(x - cx);
      if (off < best) {
        best = off;
        edge = i;
        px = x;
        py = y;
      }
    }
  } else {
    // 중심에서 그 방향으로 쏜 선이 몸체 외곽과 만나는 가장 먼 점
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    let far = 0;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = body[i];
      const [bx, by] = at(i + 1);
      const ex = bx - ax;
      const ey = by - ay;
      const det = dx * -ey + dy * ex;
      if (Math.abs(det) < 1e-9) continue;
      const t = ((ax - cx) * -ey + (ay - cy) * ex) / det;
      const u = (dx * (ay - cy) - dy * (ax - cx)) / det;
      if (u >= 0 && u <= 1 && t > far) {
        far = t;
        edge = i;
      }
    }
    px = cx + dx * far;
    py = cy + dy * far;
  }

  // 그 자리에서 양쪽으로 2mm 씩의 방향을 평균해서 바깥 방향을 정한다 (외곽이 꺾인 곳에서도 고리가 비스듬히 서지 않게).
  // 넓이가 양수가 되게 도는 선에서 (dy, -dx) 가 바깥쪽이다
  let nx = 0;
  let ny = 0;
  const edgeLength = (i: number) => Math.hypot(at(i + 1)[0] - at(i)[0], at(i + 1)[1] - at(i)[1]);
  const add = (i: number, amount: number) => {
    const len = edgeLength(i);
    if (len < 1e-9) return;
    nx += ((at(i + 1)[1] - at(i)[1]) / len) * amount;
    ny += (-(at(i + 1)[0] - at(i)[0]) / len) * amount;
  };
  const first = edgeLength(edge) || 1;
  const hit = clamp(
    ((px - at(edge)[0]) * (at(edge + 1)[0] - at(edge)[0]) + (py - at(edge)[1]) * (at(edge + 1)[1] - at(edge)[1])) /
      (first * first),
    0,
    1,
  );
  for (const step of [1, -1]) {
    let left = 2;
    let piece = first * (step === 1 ? 1 - hit : hit);
    for (let k = 0; k < n && left > 0; k++) {
      const i = edge + k * step;
      if (k > 0) piece = edgeLength(i);
      const take = Math.min(piece, left);
      add(i, take);
      left -= take;
    }
  }
  const length = Math.hypot(nx, ny) || 1;
  nx /= length;
  ny /= length;
  const angle = (Math.atan2(px - cx, -(py - cy)) * 180) / Math.PI;
  return {
    lug: {
      x: px,
      y: py,
      dx: nx,
      dy: ny,
      length: CASE_SPEC.lug.length,
      thickness: CASE_SPEC.lug.thickness,
      hole: { ...CASE_SPEC.lug.hole },
    },
    angle: (angle + 360) % 360,
  };
}

interface CleanSource {
  matte: Uint8Array;
  x0: number;
  y0: number;
  logoW: number;
  logoH: number;
}

const cleanCache = new WeakMap<ShapeSource, CleanSource>();

/** 잡티(아주 작은 조각)를 지운 그림과 로고가 차지하는 범위. 같은 그림으로 여러 번 계산하므로 기억해 둔다 */
function cleanSource(source: ShapeSource): CleanSource {
  const known = cleanCache.get(source);
  if (known) return known;
  const { width: sw, height: sh } = source;
  const on = new Uint8Array(sw * sh);
  for (let i = 0; i < on.length; i++) on[i] = source.matte[i] >= 128 ? 1 : 0;
  const { labels, areas } = labelPieces(on, { w: sw, h: sh });
  let total = 0;
  for (let i = 1; i < areas.length; i++) total += areas[i];
  const minArea = Math.max(4, total * 0.001);
  const matte = new Uint8Array(sw * sh);
  let x0 = sw;
  let y0 = sh;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = y * sw + x;
      if (!on[i]) {
        // 로고 가장자리의 반투명한 칸은 남긴다 (경계가 매끈해진다). 버린 조각 옆의 것은 128 미만이라 어차피 남지 않는다
        matte[i] = source.matte[i];
        continue;
      }
      if (areas[labels[i]] < minArea) continue;
      matte[i] = source.matte[i];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new ShapeError('empty', '그림에서 로고를 찾지 못했습니다.');
  const clean = { matte, x0, y0, logoW: x1 - x0 + 1, logoH: y1 - y0 + 1 };
  cleanCache.set(source, clean);
  return clean;
}

export function computeShape(source: ShapeSource, params: ShapeParams): ShapeDesign {
  const S = SHAPE_SPEC;
  const { width: sw, height: sh } = source;
  const { matte, x0, y0, logoW, logoH } = cleanSource(source);

  const sizeMm = clamp(params.sizeMm, S.size.min, S.size.max);
  const margin = clamp(params.marginMm, S.margin.min, S.margin.max);
  const border = S.gap + S.rim;
  // 그림 한 칸이 몇 mm 인지: 몸체의 긴 쪽이 sizeMm 가 되도록
  const scale = Math.max(6, sizeMm - 2 * (margin + border)) / Math.max(logoW, logoH);
  const cell = clamp(sizeMm / 520, 0.07, 0.13) * (params.draft ? 1.7 : 1);
  const toCells = (mm: number) => mm / cell;

  // 격자를 만들고 로고를 옮긴다. 로고 바깥으로는 여백 + 스위치 자리가 삐져나올 수 있는 만큼 + 몸체 벽만큼 비워 둔다
  const pad = Math.ceil(toCells(margin + S.seat / 2 + Math.max(border, S.smooth) + 1.2)) + 2;
  const w = Math.ceil(toCells(logoW * scale)) + 2 * pad;
  const h = Math.ceil(toCells(logoH * scale)) + 2 * pad;
  const grid: Grid = { w, h };
  const perCell = cell / scale;
  const raw = new Uint8Array(w * h);
  for (let gy = pad; gy < h - pad; gy++) {
    // 격자 칸 중심 → 그림 칸 번호 (칸 중심 기준)
    const sy = y0 + (gy - pad + 0.5) * perCell - 0.5;
    const iy = clamp(Math.floor(sy), 0, sh - 1);
    const iy1 = Math.min(sh - 1, iy + 1);
    const fy = clamp(sy - iy, 0, 1);
    for (let gx = pad; gx < w - pad; gx++) {
      const sx = x0 + (gx - pad + 0.5) * perCell - 0.5;
      const ix = clamp(Math.floor(sx), 0, sw - 1);
      const ix1 = Math.min(sw - 1, ix + 1);
      const fx = clamp(sx - ix, 0, 1);
      const top = matte[iy * sw + ix] * (1 - fx) + matte[iy * sw + ix1] * fx;
      const bottom = matte[iy1 * sw + ix] * (1 - fx) + matte[iy1 * sw + ix1] * fx;
      if (top * (1 - fy) + bottom * fy >= 128) raw[gy * w + gx] = 1;
    }
  }

  // 잡티를 버리고 여백만큼 부풀린다
  const padded = (() => {
    const { labels, areas } = labelPieces(raw, grid);
    let total = 0;
    for (let i = 1; i < areas.length; i++) total += areas[i];
    const minArea = Math.max(S.minPiece / (cell * cell), total * 0.001);
    const cleaned = new Uint8Array(raw.length);
    for (let i = 0; i < cleaned.length; i++) cleaned[i] = labels[i] && areas[labels[i]] >= minArea ? 1 : 0;
    return dilate(cleaned, grid, toCells(margin));
  })();

  // 한 덩어리로 만들기: 떨어진 조각은 다리로 잇고, 좁은 틈과 안쪽에 갇힌 빈 곳은 메운다
  const smooth = toCells(S.smooth);
  const joined = bridgePieces(padded, grid, toCells(S.bridge));
  let solid = fillHoles(close(padded, grid, smooth), grid);
  {
    const { labels, areas } = labelPieces(solid, grid);
    if (areas.length > 2) {
      // 그래도 떨어져 있으면 가장 큰 덩어리만 남긴다
      let keep = 1;
      for (let i = 2; i < areas.length; i++) if (areas[i] > areas[keep]) keep = i;
      for (let i = 0; i < solid.length; i++) solid[i] = labels[i] === keep ? 1 : 0;
    }
  }

  // 그림 좌표(0~1) ↔ 격자 좌표
  const cellOfU = (u: number) => (u * sw - x0) / perCell + pad - 0.5;
  const cellOfV = (v: number) => (v * sh - y0) / perCell + pad - 0.5;
  const uOfCell = (gx: number) => ((gx - pad + 0.5) * perCell + x0) / sw;
  const vOfCell = (gy: number) => ((gy - pad + 0.5) * perCell + y0) / sh;

  // 스위치 자리
  const clearance = squareClearance(solid, grid);
  const need = Math.ceil(toCells(S.seat / 2));
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid[y * w + x]) continue;
      sumX += x;
      sumY += y;
      count++;
    }
  }
  if (count === 0) throw new ShapeError('failed', '로고 모양을 만들지 못했습니다.');
  // 직접 정한 위치가 있으면 그 근처, 없으면 무게중심 근처에서 고른다 (가운데를 눌러야 뚜껑이 기울지 않는다)
  const wishX = params.switchAt ? cellOfU(params.switchAt.u) : sumX / count;
  const wishY = params.switchAt ? cellOfV(params.switchAt.v) : sumY / count;
  let seatX = -1;
  let seatY = -1;
  {
    let bestFit = -1;
    let bestDist = Infinity;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = clearance[y * w + x];
        if (c === 0) continue;
        // 직접 정했으면 모양 안에서 가장 가까운 곳, 아니면 자리가 충분한 곳 가운데 가장 가까운 곳
        const fit = params.switchAt ? 1 : Math.min(c, need);
        const dist = (x - wishX) ** 2 + (y - wishY) ** 2;
        if (fit > bestFit || (fit === bestFit && dist < bestDist)) {
          bestFit = fit;
          bestDist = dist;
          seatX = x;
          seatY = y;
        }
      }
    }
  }
  const seatAdded = clearance[seatY * w + seatX] < need;
  if (seatAdded) {
    const half = toCells(S.seat / 2);
    const corner = toCells(S.seatRadius);
    const inner = half - corner;
    for (let y = Math.max(1, Math.floor(seatY - half)); y <= Math.min(h - 2, Math.ceil(seatY + half)); y++) {
      for (let x = Math.max(1, Math.floor(seatX - half)); x <= Math.min(w - 2, Math.ceil(seatX + half)); x++) {
        const ax = Math.abs(x - seatX);
        const ay = Math.abs(y - seatY);
        if (ax > half || ay > half) continue;
        if (ax > inner && ay > inner && Math.hypot(ax - inner, ay - inner) > corner) continue;
        solid[y * w + x] = 1;
      }
    }
    solid = fillHoles(solid, grid);
  }

  // 뚜껑: 한 번 더 부풀렸다 줄이며 매끈한 선으로 뽑는다 (오목한 모서리가 둥글어진다)
  const swollen = dilate(solid, grid, smooth);
  const depth = depthInside(swollen, grid);
  const capMask = new Uint8Array(w * h);
  for (let i = 0; i < capMask.length; i++) capMask[i] = depth[i] > smooth ? 1 : 0;
  const capSolid = fillHoles(capMask, grid);
  const capLoop = largestLoop(traceLevel(depth, grid, smooth + 0.5, true));

  // 뚜껑에서 바깥으로: 들어가는 자리 · 몸체, 안으로: 속 빈 곳 · 윗면
  const outside = distanceOutside(capSolid, grid);
  const inside = depthInside(capSolid, grid);
  const outward = (mm: number) => largestLoop(traceLevel(outside, grid, toCells(mm) + 0.5, false));
  const inward = (mm: number) => traceLevel(inside, grid, toCells(mm) + 0.5, true);
  const wellLoop = outward(S.gap);
  const bodyLoop = outward(border);
  const bodyInsetLoop = outward(border - S.bodyBevel);
  if (!capLoop || !wellLoop || !bodyLoop || !bodyInsetLoop) {
    throw new ShapeError('failed', '로고 모양을 만들지 못했습니다.');
  }

  // 격자 좌표 → mm (원점은 몸체 중심), 넓이가 양수가 되는 방향으로 통일
  const bounds = loopBounds(bodyLoop);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const tolerance = params.draft ? 0.05 : 0.02;
  let loopCount = 0;
  const finish = (loop: Loop): Loop => {
    const mm = relaxLoop(loop, 4).map(([gx, gy]): Pt => [(gx - centerX) * cell, (gy - centerY) * cell]);
    const simple = unalign(simplifyLoop(mm, tolerance), ++loopCount);
    return loopArea(simple) < 0 ? simple.reverse() : simple;
  };
  const outerSign = Math.sign(loopArea(capLoop)) || 1;
  /** 바깥 테두리만 (안쪽에 뚫린 곳의 선은 도는 방향이 반대다), 너무 작은 것은 버린다 */
  const pieces = (loops: Loop[], minAreaMm: number): Loop[] =>
    loops
      .filter((loop) => loopArea(loop) * outerSign * cell * cell >= minAreaMm)
      .map(finish)
      .sort((a, b) => loopArea(b) - loopArea(a));

  const cap = finish(capLoop);
  const well = finish(wellLoop);
  const body = finish(bodyLoop);
  const bodyInset = finish(bodyInsetLoop);
  const capTop = pieces(inward(S.capBevel), 0.3);
  const hollows = pieces(inward(S.capWall), 3);
  const switchAt = { x: (seatX - centerX) * cell, y: (seatY - centerY) * cell };
  const switchHollow = hollows.findIndex((loop) => pointInLoop(switchAt.x, switchAt.y, loop));
  if (switchHollow < 0 || capTop.length === 0) {
    throw new ShapeError('failed', '스위치가 들어갈 자리를 만들지 못했습니다.');
  }

  const placed = params.lug ? placeLug(body, params.lugAngle) : null;
  const bodyBounds = loopBounds(body);
  return {
    cap,
    capTop,
    hollows,
    switchHollow,
    well,
    body,
    bodyInset,
    switchAt,
    switchUV: { u: uOfCell(seatX), v: vOfCell(seatY) },
    lug: placed?.lug ?? null,
    lugAngle: placed?.angle ?? 0,
    imageRect: {
      x: (cellOfU(0) - centerX) * cell,
      y: (cellOfV(0) - centerY) * cell,
      w: sw * scale,
      h: sh * scale,
    },
    size: {
      width: bodyBounds.maxX - bodyBounds.minX,
      depth: bodyBounds.maxY - bodyBounds.minY,
      height: S.plateHeight + S.capSeat + S.capHeight,
    },
    notes: { joined, seatAdded },
  };
}
