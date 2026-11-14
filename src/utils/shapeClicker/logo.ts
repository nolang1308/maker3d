/**
 * 쉐이프 클리커: 올린 그림에서 "로고인 부분"을 가려낸다 (브라우저 안에서만 처리하고 어디에도 보내지 않는다).
 *
 *  - 배경이 투명한 그림(PNG · SVG 등): 투명하지 않은 곳이 로고
 *  - 배경이 한 가지 색인 그림(JPG 등): 가장자리에서 이어진 그 색을 지우고 남은 곳이 로고
 *  - 그 밖의 그림(사진 등): 그림 전체를 네모난 로고로 쓴다
 */

import type { ShapeSource } from './shape';

export const MAX_LOGO_FILE = 20 * 1024 * 1024;
/** 모양 계산용 그림의 긴 쪽 (칸) */
const MATTE_SIDE = 640;
/**
 * 그림을 처리하는 크기 (긴 쪽, px). 원본보다 키우지 않는다 — 키워도 없는 세부가 생기지는 않는다.
 * 너무 작은 그림만 경계가 계단지지 않을 만큼 키우고, 큰 그림은 이만큼까지 줄인다.
 */
const WORK_MIN = 512;
const WORK_MAX = 2048;
/** 윗면 그림 둘레에 두는 투명한 띠 (px). 그림 범위를 벗어난 곳이 뚜껑 색으로 채워지게 한다 */
const ART_PAD = 8;
/** 배경색과 이만큼 안에 드는 색은 배경으로 본다 (RGB 거리) */
const BACKGROUND_TOLERANCE = 42;
/**
 * 로고의 긴 쪽이 이보다 작으면(원본 px) 윗면 그림이 흐려 보일 수 있다고 알린다.
 * 직접 올려 본 결과: 약 210px 은 눈에 띄게 흐리고, 약 360px 은 당겨 보면 조금 무르고, 약 520px 은 또렷했다
 */
export const SHARP_LOGO_PIXELS = 400;
/** 또렷하게 나오려면 권하는 크기 (긴 쪽, px) */
export const RECOMMENDED_LOGO_PIXELS = 1000;

export type LogoBackground = 'transparent' | 'removed' | 'kept';

export interface LogoAsset {
  id: string;
  name: string;
  /** 모양 계산에 쓰는 그림 */
  source: ShapeSource;
  /** 뚜껑 윗면에 올릴 그림: 로고가 있는 부분만 잘라 낸 것 (배경은 투명) */
  art: HTMLCanvasElement;
  /** art 가 원본 그림의 어느 부분인지 (원본 전체를 0 ~ 1 로 본 좌표) */
  artRect: { x: number; y: number; w: number; h: number };
  background: LogoBackground;
  /** 원본에서 로고가 차지하는 긴 쪽 (px). 벡터 그림(SVG)은 얼마든지 키울 수 있어 Infinity */
  logoPixels: number;
}

let nextId = 0;
const newId = () => `logo-${++nextId}`;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context(canvas: HTMLCanvasElement, readBack = false): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: readBack });
  if (!ctx) throw new Error('이 브라우저에서는 그림을 처리할 수 없습니다.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** 가장자리를 가장 많이 차지하는 색과, 가장자리 가운데 그 색인 비율 */
function borderColor(data: Uint8ClampedArray, w: number, h: number): { color: [number, number, number]; share: number } {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  for (const i of border) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  let best = { count: 0, r: 0, g: 0, b: 0 };
  for (const bin of bins.values()) if (bin.count > best.count) best = bin;
  const color: [number, number, number] = [best.r / best.count, best.g / best.count, best.b / best.count];
  let near = 0;
  for (const i of border) {
    const d = Math.hypot(data[i * 4] - color[0], data[i * 4 + 1] - color[1], data[i * 4 + 2] - color[2]);
    if (d < BACKGROUND_TOLERANCE) near++;
  }
  return { color, share: near / border.length };
}

/** 그림(RGBA)에서 로고인 정도(0 ~ 255)를 뽑는다 */
function extractMatte(data: Uint8ClampedArray, w: number, h: number): { matte: Uint8Array; background: LogoBackground } {
  const total = w * h;
  const matte = new Uint8Array(total);

  let clear = 0;
  for (let i = 0; i < total; i++) if (data[i * 4 + 3] < 250) clear++;
  if (clear > total * 0.005) {
    for (let i = 0; i < total; i++) matte[i] = data[i * 4 + 3];
    return { matte, background: 'transparent' };
  }

  const { color, share } = borderColor(data, w, h);
  if (share < 0.7) {
    // 가장자리 색이 제각각이다 (사진 등): 그림 전체를 쓴다
    matte.fill(255);
    return { matte, background: 'kept' };
  }

  // 가장자리에서 이어진 배경색만 지운다. 로고 안쪽에 갇힌 같은 색(파란 원 안의 흰 글자 등)은 남는다
  const isBackground = (i: number) =>
    Math.hypot(data[i * 4] - color[0], data[i * 4 + 1] - color[1], data[i * 4 + 2] - color[2]) < BACKGROUND_TOLERANCE;
  const outside = new Uint8Array(total);
  const stack = new Int32Array(total);
  let top = 0;
  const push = (i: number) => {
    if (!outside[i] && isBackground(i)) {
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
    if (i < total - w) push(i + w);
  }

  // 배경과 맞닿은 경계는 배경색이 섞여 있어서 함께 지우고(희끗한 테가 남지 않게), 가장자리를 부드럽게 한다.
  // 지우는 폭은 그림 크기에 맞춘다 (큰 그림일수록 섞인 경계가 여러 줄이다)
  const rounds = Math.max(1, Math.round(Math.max(w, h) / 700));
  for (let round = 0; round < rounds; round++) {
    const grown = outside.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (outside[i]) continue;
        if (
          (x > 0 && outside[i - 1]) ||
          (x < w - 1 && outside[i + 1]) ||
          (y > 0 && outside[i - w]) ||
          (y < h - 1 && outside[i + w])
        ) {
          grown[i] = 1;
        }
      }
    }
    outside.set(grown);
  }
  const hard = new Uint8Array(total);
  for (let i = 0; i < total; i++) hard[i] = outside[i] ? 0 : 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          sum += hard[ny * w + nx];
          count++;
        }
      }
      matte[y * w + x] = Math.round(sum / count);
    }
  }
  return { matte, background: 'removed' };
}

/**
 * 그릴 수 있는 것(그림 · 캔버스)에서 로고를 만든다.
 * vector 는 얼마든지 키워 그릴 수 있는 그림(SVG)인지: 그렇다면 가장 큰 크기로 그려서 또렷하게 쓴다.
 */
function fromDrawable(
  drawable: CanvasImageSource,
  width: number,
  height: number,
  name: string,
  vector: boolean,
): LogoAsset {
  if (!(width > 0 && height > 0)) throw new Error('그림의 크기를 알 수 없습니다. 다른 파일로 시도해 주세요.');
  const longest = Math.max(width, height);
  const workScale = (vector ? WORK_MAX : Math.min(WORK_MAX, Math.max(WORK_MIN, longest))) / longest;

  // 처리용 그림: 배경을 가려내고, 지울 곳은 투명하게 만든다
  const work = makeCanvas(width * workScale, height * workScale);
  const workCtx = context(work, true);
  workCtx.drawImage(drawable, 0, 0, work.width, work.height);
  const pixels = workCtx.getImageData(0, 0, work.width, work.height);
  const { matte, background } = extractMatte(pixels.data, work.width, work.height);
  if (background === 'removed') {
    for (let i = 0; i < matte.length; i++) pixels.data[i * 4 + 3] = matte[i];
    workCtx.putImageData(pixels, 0, 0);
  }

  // 로고가 있는 범위
  let x0 = work.width;
  let y0 = work.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < work.height; y++) {
    for (let x = 0; x < work.width; x++) {
      if (matte[y * work.width + x] < 16) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error('그림에서 로고를 찾지 못했습니다. 다른 그림으로 시도해 주세요.');

  // 윗면에 올릴 그림: 로고가 있는 부분만 잘라 낸다 (빈 여백에 화소를 쓰지 않아 그만큼 또렷해진다)
  const cropX = x0 - ART_PAD;
  const cropY = y0 - ART_PAD;
  const art = makeCanvas(x1 - x0 + 1 + ART_PAD * 2, y1 - y0 + 1 + ART_PAD * 2);
  context(art).drawImage(work, -cropX, -cropY);

  // 모양 계산용: 투명도만 줄여서 뽑는다
  const matteScale = Math.min(1, MATTE_SIDE / Math.max(work.width, work.height));
  const small = makeCanvas(work.width * matteScale, work.height * matteScale);
  const smallCtx = context(small, true);
  if (background === 'kept') {
    smallCtx.fillRect(0, 0, small.width, small.height);
  } else {
    smallCtx.drawImage(work, 0, 0, small.width, small.height);
  }
  const smallPixels = smallCtx.getImageData(0, 0, small.width, small.height).data;
  const smallMatte = new Uint8Array(small.width * small.height);
  for (let i = 0; i < smallMatte.length; i++) smallMatte[i] = smallPixels[i * 4 + 3];

  return {
    id: newId(),
    name,
    source: { matte: smallMatte, width: small.width, height: small.height },
    art,
    artRect: {
      x: cropX / work.width,
      y: cropY / work.height,
      w: art.width / work.width,
      h: art.height / work.height,
    },
    background,
    logoPixels: vector ? Infinity : Math.max(x1 - x0 + 1, y1 - y0 + 1) / workScale,
  };
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(file.name);
}

export function loadLogoFile(file: File): Promise<LogoAsset> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error('그림 파일만 올릴 수 있어요.'));
      return;
    }
    if (file.size > MAX_LOGO_FILE) {
      reject(new Error('파일이 너무 큽니다. 20MB 이하의 그림을 올려 주세요.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const vector = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
        resolve(
          fromDrawable(image, image.naturalWidth, image.naturalHeight, file.name.replace(/\.[^.]+$/, ''), vector),
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error('그림을 처리하지 못했습니다.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('그림을 열지 못했습니다. PNG · JPG · SVG 파일로 시도해 주세요.'));
    };
    image.src = url;
  });
}

// ---------------------------------------------------------------------------
// 예시 모양
// ---------------------------------------------------------------------------

export type SampleId = 'heart' | 'star' | 'cloud' | 'bolt';

export const SAMPLES: { id: SampleId; label: string }[] = [
  { id: 'heart', label: '하트' },
  { id: 'star', label: '별' },
  { id: 'cloud', label: '구름' },
  { id: 'bolt', label: '번개' },
];

const SAMPLE_SIZE = 1280;

function drawSample(ctx: CanvasRenderingContext2D, id: SampleId): void {
  const s = SAMPLE_SIZE;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (id === 'heart') {
    const path = new Path2D();
    path.moveTo(s * 0.5, s * 0.86);
    path.bezierCurveTo(s * 0.12, s * 0.62, s * 0.02, s * 0.36, s * 0.16, s * 0.2);
    path.bezierCurveTo(s * 0.29, s * 0.06, s * 0.45, s * 0.12, s * 0.5, s * 0.27);
    path.bezierCurveTo(s * 0.55, s * 0.12, s * 0.71, s * 0.06, s * 0.84, s * 0.2);
    path.bezierCurveTo(s * 0.98, s * 0.36, s * 0.88, s * 0.62, s * 0.5, s * 0.86);
    path.closePath();
    ctx.fillStyle = '#ff6f91';
    ctx.fill(path);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(s * 0.3, s * 0.3, s * 0.07, s * 0.045, -0.7, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (id === 'star') {
    const path = new Path2D();
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? s * 0.4 : s * 0.19;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = s * 0.5 + radius * Math.cos(angle);
      const y = s * 0.53 + radius * Math.sin(angle);
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    // 같은 색 굵은 선을 둘러서 끝을 둥글린다
    ctx.fillStyle = '#ffc94d';
    ctx.strokeStyle = '#ffc94d';
    ctx.lineWidth = s * 0.08;
    ctx.fill(path);
    ctx.stroke(path);
    ctx.fillStyle = '#5b4313';
    for (const dx of [-0.07, 0.07]) {
      ctx.beginPath();
      ctx.arc(s * (0.5 + dx), s * 0.5, s * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#5b4313';
    ctx.lineWidth = s * 0.016;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.55, s * 0.05, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    return;
  }
  if (id === 'cloud') {
    ctx.fillStyle = '#7fbff0';
    const circles: [number, number, number][] = [
      [0.3, 0.58, 0.17],
      [0.46, 0.44, 0.2],
      [0.66, 0.5, 0.17],
      [0.76, 0.62, 0.13],
    ];
    ctx.beginPath();
    for (const [x, y, r] of circles) {
      ctx.moveTo(s * (x + r), s * y);
      ctx.arc(s * x, s * y, s * r, 0, Math.PI * 2);
    }
    ctx.rect(s * 0.3, s * 0.58, s * 0.46, s * 0.17);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(s * 0.42, s * 0.36, s * 0.08, s * 0.035, -0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const path = new Path2D();
  const points: [number, number][] = [
    [0.58, 0.08],
    [0.24, 0.54],
    [0.46, 0.54],
    [0.38, 0.92],
    [0.76, 0.42],
    [0.53, 0.42],
  ];
  points.forEach(([x, y], i) => (i === 0 ? path.moveTo(s * x, s * y) : path.lineTo(s * x, s * y)));
  path.closePath();
  ctx.fillStyle = '#ffd43b';
  ctx.strokeStyle = '#ffd43b';
  ctx.lineWidth = s * 0.06;
  ctx.fill(path);
  ctx.stroke(path);
}

export function makeSample(id: SampleId): LogoAsset {
  const canvas = makeCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
  drawSample(context(canvas), id);
  const label = SAMPLES.find((sample) => sample.id === id)?.label ?? '예시';
  return { ...fromDrawable(canvas, SAMPLE_SIZE, SAMPLE_SIZE, label, false), id: `sample-${id}` };
}
