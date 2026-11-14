/**
 * 이미지 → 키캡 색상 레이어 변환 유틸
 *
 * 1. 이미지를 작은 캔버스에 래스터화
 * 2. k-means로 색상 양자화 (투명 픽셀은 배경 = -1)
 * 3. 테두리 색을 배경으로 자동 제거 (옵션)
 * 4. 노이즈 제거(다수결 필터) 후 실제 내용 영역으로 크롭
 * 5. 라벨별 외곽선을 추적해 구멍(hole)이 있는 다각형으로 변환
 */

export type Point = [number, number];

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  hex: string;
  count: number;
}

export interface QuantizedImage {
  width: number;
  height: number;
  /** 픽셀별 팔레트 인덱스, -1 = 배경(출력하지 않음) */
  labels: Int16Array;
  palette: PaletteColor[];
  hasTransparency: boolean;
}

export interface Polygon {
  outer: Point[];
  holes: Point[][];
}

export interface ProcessOptions {
  /** 추출할 색상 수 (1~6) */
  colorCount: number;
  /** 테두리를 차지하는 색을 배경으로 간주해 제거 */
  removeBackground: boolean;
  /** 긴 변 기준 최대 픽셀 크기 (원본이 더 작으면 확대하지 않음) */
  maxSize?: number;
  /** 3×3 다수결 노이즈 필터 횟수 (0이면 생략). 작을수록 세부가 많이 남는다 */
  noisePasses?: number;
}

// ---------------------------------------------------------------------------
// 색상 유틸
// ---------------------------------------------------------------------------

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 사람 눈 기준 가중 RGB 거리 (제곱값) */
export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const rmean = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
}

/** 후보 hex 목록 중 가장 가까운 색의 인덱스 */
export function nearestColorIndex(hex: string, candidates: string[]): number {
  const target = hexToRgb(hex);
  let best = 0;
  let bestD = Infinity;
  candidates.forEach((c, i) => {
    const d = colorDistance(target, hexToRgb(c));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// ---------------------------------------------------------------------------
// 이미지 로딩 / 래스터화
// ---------------------------------------------------------------------------

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 불러올 수 없습니다. PNG, JPG, SVG, WebP 파일을 사용해주세요.'));
    };
    img.src = url;
  });
}

function rasterize(img: HTMLImageElement, maxSize: number): ImageData {
  const iw = img.naturalWidth || 512;
  const ih = img.naturalHeight || 512;
  const scale = Math.min(1, maxSize / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('캔버스를 사용할 수 없는 브라우저입니다.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// k-means 색상 양자화
// ---------------------------------------------------------------------------

const ALPHA_THRESHOLD = 128;
const MERGE_DISTANCE = 22; // 이 거리(RGB 유클리드) 이내의 군집은 하나로 합침

function kmeansCentroids(samples: Uint8ClampedArray, n: number, k: number): number[][] {
  if (n === 0) return [];

  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    mr += samples[i * 3];
    mg += samples[i * 3 + 1];
    mb += samples[i * 3 + 2];
  }
  const mean = [mr / n, mg / n, mb / n];

  // maximin 초기화: 평균에서 가장 먼 색 → 기존 중심들에서 가장 먼 색 순으로 선택 (결정적, 평면 일러스트에 적합)
  const centroids: number[][] = [];
  const minDist = new Float32Array(n).fill(Infinity);
  let best = 0;
  let bestD = -1;
  for (let i = 0; i < n; i++) {
    const dr = samples[i * 3] - mean[0];
    const dg = samples[i * 3 + 1] - mean[1];
    const db = samples[i * 3 + 2] - mean[2];
    const d = dr * dr + dg * dg + db * db;
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  centroids.push([samples[best * 3], samples[best * 3 + 1], samples[best * 3 + 2]]);

  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    best = -1;
    bestD = -1;
    for (let i = 0; i < n; i++) {
      const dr = samples[i * 3] - last[0];
      const dg = samples[i * 3 + 1] - last[1];
      const db = samples[i * 3 + 2] - last[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < minDist[i]) minDist[i] = d;
      if (minDist[i] > bestD) {
        bestD = minDist[i];
        best = i;
      }
    }
    // 더 이상 구분되는 색이 없으면 중단
    if (best < 0 || bestD < MERGE_DISTANCE * MERGE_DISTANCE) break;
    centroids.push([samples[best * 3], samples[best * 3 + 1], samples[best * 3 + 2]]);
  }

  // Lloyd 반복
  const kk = centroids.length;
  const sums = new Float64Array(kk * 3);
  const counts = new Uint32Array(kk);
  for (let iter = 0; iter < 14; iter++) {
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const r = samples[i * 3];
      const g = samples[i * 3 + 1];
      const b = samples[i * 3 + 2];
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < kk; c++) {
        const dr = r - centroids[c][0];
        const dg = g - centroids[c][1];
        const db = b - centroids[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      sums[bi * 3] += r;
      sums[bi * 3 + 1] += g;
      sums[bi * 3 + 2] += b;
      counts[bi]++;
    }
    let moved = 0;
    for (let c = 0; c < kk; c++) {
      if (counts[c] === 0) continue;
      const nr = sums[c * 3] / counts[c];
      const ng = sums[c * 3 + 1] / counts[c];
      const nb = sums[c * 3 + 2] / counts[c];
      moved += Math.abs(nr - centroids[c][0]) + Math.abs(ng - centroids[c][1]) + Math.abs(nb - centroids[c][2]);
      centroids[c] = [nr, ng, nb];
    }
    if (moved < 0.5) break;
  }

  // 가까운 중심 병합
  const merged: number[][] = [];
  const mergedCounts: number[] = [];
  for (let c = 0; c < kk; c++) {
    if (counts[c] === 0) continue;
    let target = -1;
    for (let m = 0; m < merged.length; m++) {
      const dr = merged[m][0] - centroids[c][0];
      const dg = merged[m][1] - centroids[c][1];
      const db = merged[m][2] - centroids[c][2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) < MERGE_DISTANCE) {
        target = m;
        break;
      }
    }
    if (target < 0) {
      merged.push([...centroids[c]]);
      mergedCounts.push(counts[c]);
    } else {
      const total = mergedCounts[target] + counts[c];
      merged[target] = [
        (merged[target][0] * mergedCounts[target] + centroids[c][0] * counts[c]) / total,
        (merged[target][1] * mergedCounts[target] + centroids[c][1] * counts[c]) / total,
        (merged[target][2] * mergedCounts[target] + centroids[c][2] * counts[c]) / total,
      ];
      mergedCounts[target] = total;
    }
  }
  return merged;
}

/** 3×3 다수결 필터로 점 노이즈 제거 (배경 -1 포함) */
function majorityFilter(labels: Int16Array, w: number, h: number, paletteSize: number, passes: number): Int16Array {
  let src = labels;
  for (let p = 0; p < passes; p++) {
    const out = new Int16Array(src.length);
    const hist = new Int32Array(paletteSize + 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        hist.fill(0);
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            hist[src[yy * w + xx] + 1]++;
          }
        }
        const cur = src[y * w + x];
        if (hist[cur + 1] <= 2) {
          let bi = 0;
          let bc = -1;
          for (let i = 0; i < hist.length; i++) {
            if (hist[i] > bc) {
              bc = hist[i];
              bi = i;
            }
          }
          out[y * w + x] = bi - 1;
        } else {
          out[y * w + x] = cur;
        }
      }
    }
    src = out;
  }
  return src;
}

/**
 * 이미지 파일을 읽어 색상 양자화 결과를 반환한다.
 */
export async function processImageFile(file: File, options: ProcessOptions): Promise<QuantizedImage> {
  const img = await loadImage(file);
  const imageData = rasterize(img, options.maxSize ?? 800);
  return quantizeImageData(imageData, options);
}

export function quantizeImageData(imageData: ImageData, options: ProcessOptions): QuantizedImage {
  const { width: w, height: h, data } = imageData;
  const requested = Math.max(1, Math.min(8, Math.round(options.colorCount)));
  const total = w * h;

  // 불투명 픽셀 샘플 수집 (최대 24,000개)
  let opaqueCount = 0;
  let hasTransparency = false;
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] >= ALPHA_THRESHOLD) opaqueCount++;
    else hasTransparency = true;
  }
  if (opaqueCount === 0) {
    throw new Error('이미지가 모두 투명합니다. 다른 이미지를 사용해주세요.');
  }
  // 투명도가 없는 이미지에서 배경을 제거할 때는 배경색이 한 자리를 차지하므로 한 색 더 뽑는다
  const wantsBgRemoval = options.removeBackground && !hasTransparency;
  const k = wantsBgRemoval ? requested + 1 : requested;
  const stride = Math.max(1, Math.floor(opaqueCount / 24000));
  const samples = new Uint8ClampedArray(Math.ceil(opaqueCount / stride) * 3);
  let n = 0;
  let seen = 0;
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] < ALPHA_THRESHOLD) continue;
    if (seen++ % stride !== 0) continue;
    samples[n * 3] = data[i * 4];
    samples[n * 3 + 1] = data[i * 4 + 1];
    samples[n * 3 + 2] = data[i * 4 + 2];
    n++;
  }

  let centroids = kmeansCentroids(samples, n, k);
  if (centroids.length === 0) centroids = [[128, 128, 128]];

  // 전체 픽셀 라벨링
  let labels: Int16Array = new Int16Array(total);
  const assign = (cents: number[][]) => {
    for (let i = 0; i < total; i++) {
      if (data[i * 4 + 3] < ALPHA_THRESHOLD) {
        labels[i] = -1;
        continue;
      }
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < cents.length; c++) {
        const dr = r - cents[c][0];
        const dg = g - cents[c][1];
        const db = b - cents[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      labels[i] = bi;
    }
  };
  assign(centroids);

  // 전체의 0.05% 미만(최소 30px)인 군집은 안티앨리어싱·압축 노이즈로 보고 가장 가까운 색에 흡수
  {
    const minCluster = Math.max(30, Math.floor(opaqueCount * 0.0005));
    const counts0 = new Int32Array(centroids.length);
    for (let i = 0; i < total; i++) if (labels[i] >= 0) counts0[labels[i]]++;
    const keep = centroids.filter((_, i) => counts0[i] >= minCluster);
    if (keep.length > 0 && keep.length < centroids.length) {
      centroids = keep;
      assign(centroids);
    }
  }

  // 배경 자동 제거: 투명도가 없는 이미지에서 테두리를 절반 이상 차지하는 색을 배경으로 간주
  let backgroundRemoved = false;
  if (wantsBgRemoval && centroids.length > 1) {
    const border = new Int32Array(centroids.length);
    let borderTotal = 0;
    for (let x = 0; x < w; x++) {
      for (const y of [0, h - 1]) {
        const l = labels[y * w + x];
        if (l >= 0) {
          border[l]++;
          borderTotal++;
        }
      }
    }
    for (let y = 1; y < h - 1; y++) {
      for (const x of [0, w - 1]) {
        const l = labels[y * w + x];
        if (l >= 0) {
          border[l]++;
          borderTotal++;
        }
      }
    }
    let bgLabel = -1;
    let bgCount = 0;
    for (let c = 0; c < border.length; c++) {
      if (border[c] > bgCount) {
        bgCount = border[c];
        bgLabel = c;
      }
    }
    if (bgLabel >= 0 && borderTotal > 0 && bgCount / borderTotal >= 0.5) {
      // 테두리에서 이어진 배경색 영역만 지운다. 그림 안쪽에 고립된 같은 색(예: 파란 원 안의 흰 글자)은 남긴다.
      const stack: number[] = [];
      const visited = new Uint8Array(total);
      const pushIfBg = (idx: number) => {
        if (!visited[idx] && labels[idx] === bgLabel) {
          visited[idx] = 1;
          stack.push(idx);
        }
      };
      for (let x = 0; x < w; x++) {
        pushIfBg(x);
        pushIfBg((h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        pushIfBg(y * w);
        pushIfBg(y * w + w - 1);
      }
      while (stack.length) {
        const idx = stack.pop()!;
        labels[idx] = -1;
        const x = idx % w;
        const y = (idx - x) / w;
        if (x > 0) pushIfBg(idx - 1);
        if (x < w - 1) pushIfBg(idx + 1);
        if (y > 0) pushIfBg(idx - w);
        if (y < h - 1) pushIfBg(idx + w);
      }
      // 배경색이 더 이상 남아 있지 않으면 팔레트에서 제거
      let remaining = 0;
      for (let i = 0; i < total; i++) if (labels[i] === bgLabel) remaining++;
      if (remaining === 0) {
        centroids = centroids.filter((_, i) => i !== bgLabel);
        for (let i = 0; i < total; i++) {
          if (labels[i] > bgLabel) labels[i] = labels[i] - 1;
        }
      }
      backgroundRemoved = true;
    }
  }
  // 배경을 찾지 못했으면 요청한 색상 수로 다시 양자화
  if (wantsBgRemoval && !backgroundRemoved && centroids.length > requested) {
    return quantizeImageData(imageData, { ...options, removeBackground: false });
  }

  // 노이즈 제거
  const noisePasses = options.noisePasses ?? 1;
  if (noisePasses > 0) labels = majorityFilter(labels, w, h, centroids.length, noisePasses);

  // 내용 영역으로 크롭
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] >= 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) {
    throw new Error('이미지에서 출력할 색상 영역을 찾지 못했습니다. 배경 제거를 끄거나 다른 이미지를 사용해주세요.');
  }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = new Int16Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      cropped[y * cw + x] = labels[(y + minY) * w + (x + minX)];
    }
  }

  // 팔레트 집계 및 빈도순 정렬
  const counts = new Int32Array(centroids.length);
  for (let i = 0; i < cropped.length; i++) {
    if (cropped[i] >= 0) counts[cropped[i]]++;
  }
  const order = centroids
    .map((_, i) => i)
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a]);
  const remap = new Int16Array(centroids.length).fill(-1);
  order.forEach((oldIdx, newIdx) => {
    remap[oldIdx] = newIdx;
  });
  for (let i = 0; i < cropped.length; i++) {
    if (cropped[i] >= 0) cropped[i] = remap[cropped[i]];
  }
  const palette: PaletteColor[] = order.map((i) => ({
    r: Math.round(centroids[i][0]),
    g: Math.round(centroids[i][1]),
    b: Math.round(centroids[i][2]),
    hex: rgbToHex(centroids[i][0], centroids[i][1], centroids[i][2]),
    count: counts[i],
  }));

  return { width: cw, height: ch, labels: cropped, palette, hasTransparency };
}

// ---------------------------------------------------------------------------
// 미리보기 렌더링
// ---------------------------------------------------------------------------

/** 양자화 결과를 (매핑된 색으로) 그린 PNG data URL. 배경은 투명. */
export function renderQuantizedPreview(
  q: QuantizedImage,
  colorForLabel: (label: number) => string | null,
  targetWidth = 320,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = q.width;
  canvas.height = q.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(q.width, q.height);
  const rgbCache = new Map<number, [number, number, number] | null>();
  for (let i = 0; i < q.labels.length; i++) {
    const l = q.labels[i];
    if (l < 0) continue;
    let rgb = rgbCache.get(l);
    if (rgb === undefined) {
      const hex = colorForLabel(l);
      rgb = hex ? hexToRgb(hex) : null;
      rgbCache.set(l, rgb);
    }
    if (!rgb) continue;
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const scale = Math.max(1, Math.round(targetWidth / Math.max(q.width, q.height)));
  if (scale === 1) return canvas.toDataURL('image/png');
  const big = document.createElement('canvas');
  big.width = q.width * scale;
  big.height = q.height * scale;
  const bctx = big.getContext('2d');
  if (!bctx) return canvas.toDataURL('image/png');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(canvas, 0, 0, big.width, big.height);
  return big.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// 외곽선 추적 → 다각형
// ---------------------------------------------------------------------------

function ringArea(ring: Point[]): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function pointInRing(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 닫힌 고리를 라플라시안 평균으로 다듬는다 ([0.25, 0.5, 0.25] 커널).
 * 픽셀 경계에서 생긴 1px 계단(주기 2 지그재그)은 한 번에 사라지고, 모서리는 σ≈0.7·√n px 만큼만 둥글어진다.
 */
function smoothRing(ring: Point[], iterations: number): Point[] {
  if (iterations <= 0 || ring.length < 8) return ring;
  let cur = ring;
  for (let it = 0; it < iterations; it++) {
    const n = cur.length;
    const next: Point[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = cur[(i - 1 + n) % n];
      const c = cur[i];
      const q = cur[(i + 1) % n];
      next[i] = [0.25 * p[0] + 0.5 * c[0] + 0.25 * q[0], 0.25 * p[1] + 0.5 * c[1] + 0.25 * q[1]];
    }
    cur = next;
  }
  return cur;
}

/** 픽셀 크기(mm)에 맞춰 스무딩 횟수를 정한다. 픽셀아트처럼 픽셀이 큰 이미지는 각진 모양을 유지한다. */
function smoothingIterationsFor(pixelSizeMm: number): number {
  if (pixelSizeMm <= 0.1) return 3;
  if (pixelSizeMm <= 0.2) return 2;
  if (pixelSizeMm <= 0.35) return 1;
  return 0;
}

/** Douglas–Peucker (닫힌 고리용) */
function simplifyRing(ring: Point[], tolerance: number): Point[] {
  if (ring.length <= 4 || tolerance <= 0) return ring;
  const pts = [...ring, ring[0]];
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const tol2 = tolerance * tolerance;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    if (e - s < 2) continue;
    const [sx, sy] = pts[s];
    const [ex, ey] = pts[e];
    const dx = ex - sx;
    const dy = ey - sy;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      let d: number;
      if (len2 === 0) {
        d = (px - sx) * (px - sx) + (py - sy) * (py - sy);
      } else {
        const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / len2));
        const qx = sx + t * dx;
        const qy = sy + t * dy;
        d = (px - qx) * (px - qx) + (py - qy) * (py - qy);
      }
      if (d > maxD) {
        maxD = d;
        maxI = i;
      }
    }
    if (maxD > tol2 && maxI > 0) {
      keep[maxI] = 1;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (keep[i]) out.push(pts[i]);
  }
  return out;
}

/**
 * 라벨 마스크의 경계를 픽셀 격자 기준으로 추적해 닫힌 고리들을 반환한다 (픽셀 좌표, y 아래 방향).
 * 각 픽셀 사각형을 화면 기준 시계 방향으로 돌기 때문에 바깥 고리와 구멍 고리의 방향이 서로 반대가 된다.
 * 대각선으로만 닿은 영역은 분리된 고리가 되도록 교차점에서 항상 같은 방향(우회전)을 우선한다.
 */
function traceRings(labels: Int16Array, w: number, h: number, label: number): Point[][] {
  const vw = w + 1;
  const es: number[] = [];
  const ee: number[] = [];
  const outgoing = new Map<number, number[]>();
  const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
    const s = y0 * vw + x0;
    es.push(s);
    ee.push(y1 * vw + x1);
    let arr = outgoing.get(s);
    if (!arr) {
      arr = [];
      outgoing.set(s, arr);
    }
    arr.push(es.length - 1);
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== label) continue;
      if (y === 0 || labels[(y - 1) * w + x] !== label) addEdge(x, y, x + 1, y);
      if (x === w - 1 || labels[y * w + x + 1] !== label) addEdge(x + 1, y, x + 1, y + 1);
      if (y === h - 1 || labels[(y + 1) * w + x] !== label) addEdge(x + 1, y + 1, x, y + 1);
      if (x === 0 || labels[y * w + x - 1] !== label) addEdge(x, y + 1, x, y);
    }
  }

  const used = new Uint8Array(es.length);
  const rings: Point[][] = [];
  for (let e = 0; e < es.length; e++) {
    if (used[e]) continue;
    const startV = es[e];
    const ring: Point[] = [];
    let cur = e;
    for (let guard = 0; guard < es.length + 1; guard++) {
      used[cur] = 1;
      const sv = es[cur];
      const ev = ee[cur];
      ring.push([sv % vw, Math.floor(sv / vw)]);
      if (ev === startV) break;
      const cands = outgoing.get(ev);
      if (!cands) break;
      const dx = (ev % vw) - (sv % vw);
      const dy = Math.floor(ev / vw) - Math.floor(sv / vw);
      let best = -1;
      let bestScore = -1;
      for (const c of cands) {
        if (used[c]) continue;
        const cx = (ee[c] % vw) - (ev % vw);
        const cy = Math.floor(ee[c] / vw) - Math.floor(ev / vw);
        const cross = dx * cy - dy * cx;
        const dot = dx * cx + dy * cy;
        const score = cross > 0 ? 2 : cross === 0 && dot > 0 ? 1 : 0;
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best < 0) break;
      cur = best;
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

export interface PolygonOptions {
  /** 단순화 허용 오차 (mm) */
  tolerance: number;
  /** 이보다 작은 조각/구멍은 버림 (mm²) */
  minArea: number;
  /** 픽셀 한 변의 길이 (mm). 외곽선 스무딩 강도를 정하는 데 쓴다 */
  pixelSizeMm: number;
}

/**
 * 특정 라벨 영역을 mm 좌표계의 다각형(바깥 고리 + 구멍) 목록으로 변환한다.
 *
 * @param toMm  픽셀 좌표 → mm 좌표 변환 (y축을 뒤집어 수학 좌표계로 만든다)
 */
export function maskToPolygons(
  q: QuantizedImage,
  label: number,
  toMm: (x: number, y: number) => Point,
  options: PolygonOptions,
): Polygon[] {
  const { tolerance, minArea, pixelSizeMm } = options;
  const smoothIterations = smoothingIterationsFor(pixelSizeMm);
  const pixelRings = traceRings(q.labels, q.width, q.height, label);
  const outers: { ring: Point[]; area: number; holes: Point[][] }[] = [];
  const holes: { ring: Point[]; area: number; testPoint: Point }[] = [];

  for (const pr of pixelRings) {
    const mm = pr.map(([x, y]) => toMm(x, y));
    const area = ringArea(mm);
    // 픽셀 사각형을 화면 시계방향으로 돌았으므로 y를 뒤집은 mm 좌표에서는 바깥 고리가 음수 면적
    if (area < 0) {
      outers.push({ ring: mm, area: -area, holes: [] });
    } else if (area > 0) {
      // 구멍 내부 점: 첫 변의 중점에서 왼쪽(내부)으로 살짝 이동
      const [x0, y0] = mm[0];
      const [x1, y1] = mm[1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const off = len * 0.25;
      const testPoint: Point = [(x0 + x1) / 2 + (-dy / len) * off, (y0 + y1) / 2 + (dx / len) * off];
      holes.push({ ring: mm, area, testPoint });
    }
  }

  for (const hole of holes) {
    if (hole.area < minArea) continue;
    let bestIdx = -1;
    let bestArea = Infinity;
    for (let i = 0; i < outers.length; i++) {
      if (outers[i].area < bestArea && pointInRing(hole.testPoint, outers[i].ring)) {
        bestArea = outers[i].area;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) outers[bestIdx].holes.push(hole.ring);
  }

  const polygons: Polygon[] = [];
  for (const o of outers) {
    if (o.area < minArea) continue;
    const outer = simplifyRing(smoothRing(o.ring, smoothIterations), tolerance);
    if (outer.length < 3) continue;
    const simplifiedHoles = o.holes
      .map((hr) => simplifyRing(smoothRing(hr, smoothIterations), tolerance))
      .filter((hr) => hr.length >= 3);
    polygons.push({ outer, holes: simplifiedHoles });
  }
  return polygons;
}
