/**
 * 사진 불러오기와 배치 계산.
 *
 * 사진은 "배치 영역"(키 하나의 인쇄면, 또는 모든 키를 감싸는 영역)을 기준으로 놓인다.
 *  - zoom = 1 은 현재 회전 각도에서 영역을 빈틈없이 덮는 최소 크기
 *  - x, y 는 영역 중심에서 사진 중심까지의 거리 (mm)
 *  - rotation 은 시계 방향 각도 (도)
 * 2D 편집기와 3D 텍스처가 같은 drawPlacement 를 쓰기 때문에 편집 화면과 미리보기가 항상 일치한다.
 */

import type { Rect } from './layouts';

export interface PhotoMip {
  canvas: HTMLCanvasElement;
  /** 작업 해상도 대비 축소 비율 (1, 0.5, 0.25 …) */
  scale: number;
}

export interface PhotoAsset {
  id: string;
  name: string;
  /** 작업 해상도 (원본을 긴 변 기준으로 줄인 크기) */
  width: number;
  height: number;
  /** 큰 것부터 작은 순서. 화면 배율에 맞는 단계를 골라 그려 축소 화질을 지킨다 */
  mips: PhotoMip[];
  thumbUrl: string;
}

export interface Placement {
  photoId: string;
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 5;
export const MAX_FILE_SIZE = 30 * 1024 * 1024;

const DEG = Math.PI / 180;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// ---------------------------------------------------------------------------
// 배치 계산
// ---------------------------------------------------------------------------

export function createPlacement(photoId: string): Placement {
  return { photoId, x: 0, y: 0, zoom: 1, rotation: 0 };
}

/** (-180, 180] 범위로 정리 */
export function normalizeRotation(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** 각도만큼 돌린 w×h 사각형을 감싸는 축 정렬 사각형의 크기 */
function rotatedExtent(w: number, h: number, deg: number): [number, number] {
  const c = Math.abs(Math.cos(deg * DEG));
  const s = Math.abs(Math.sin(deg * DEG));
  return [w * c + h * s, w * s + h * c];
}

/** zoom = 1 일 때 사진 1px 의 크기(mm). 돌려도 영역이 비지 않는 최소 배율이다 */
export function coverScale(photo: { width: number; height: number }, region: Rect, rotation: number): number {
  const [needW, needH] = rotatedExtent(region.w, region.h, rotation);
  return Math.max(needW / photo.width, needH / photo.height);
}

/** 사진 전체가 영역 안에 다 보이는 zoom 값 */
export function containZoom(photo: { width: number; height: number }, region: Rect, rotation: number): number {
  const [photoW, photoH] = rotatedExtent(photo.width, photo.height, rotation);
  const contain = Math.min(region.w / photoW, region.h / photoH);
  return clamp(contain / coverScale(photo, region, rotation), ZOOM_MIN, ZOOM_MAX);
}

/**
 * 배치 값을 허용 범위로 정리한다.
 * 사진이 영역보다 크면 빈 곳이 생기지 않게, 작으면 영역 밖으로 나가지 않게 이동 범위를 제한한다.
 */
export function clampPlacement(p: Placement, photo: PhotoAsset, region: Rect): Placement {
  const zoom = clamp(Number.isFinite(p.zoom) ? p.zoom : 1, ZOOM_MIN, ZOOM_MAX);
  const rotation = normalizeRotation(Number.isFinite(p.rotation) ? p.rotation : 0);
  const cos = Math.cos(rotation * DEG);
  const sin = Math.sin(rotation * DEG);
  const scale = coverScale(photo, region, rotation) * zoom;
  const [needW, needH] = rotatedExtent(region.w, region.h, rotation);
  const limitX = Math.abs(photo.width * scale - needW) / 2;
  const limitY = Math.abs(photo.height * scale - needH) / 2;
  // 사진 기준 좌표로 옮겨 축마다 제한한 뒤 되돌린다
  const localX = clamp(p.x * cos + p.y * sin, -limitX, limitX);
  const localY = clamp(-p.x * sin + p.y * cos, -limitY, limitY);
  return {
    photoId: p.photoId,
    zoom,
    rotation,
    x: localX * cos - localY * sin,
    y: localX * sin + localY * cos,
  };
}

/** anchor(영역 중심 기준 mm) 아래의 그림이 제자리에 있도록 확대/축소한다 */
export function zoomPlacement(p: Placement, zoom: number, anchor: Point = { x: 0, y: 0 }): Placement {
  const next = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  const ratio = next / p.zoom;
  return {
    ...p,
    zoom: next,
    x: anchor.x + (p.x - anchor.x) * ratio,
    y: anchor.y + (p.y - anchor.y) * ratio,
  };
}

/** 영역 중심에 보이는 그림이 제자리에 있도록 회전한다 */
export function rotatePlacement(p: Placement, photo: PhotoAsset, region: Rect, rotation: number): Placement {
  const next = normalizeRotation(rotation);
  const delta = (next - p.rotation) * DEG;
  const ratio = coverScale(photo, region, next) / coverScale(photo, region, p.rotation);
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  return {
    ...p,
    rotation: next,
    x: (p.x * cos - p.y * sin) * ratio,
    y: (p.x * sin + p.y * cos) * ratio,
  };
}

// ---------------------------------------------------------------------------
// 그리기
// ---------------------------------------------------------------------------

/**
 * view(mm) 영역을 pixelWidth 폭의 캔버스에 그린다. 배경은 호출하는 쪽에서 미리 칠한다.
 * view 와 캔버스의 가로세로 비율은 같아야 한다.
 */
export function drawPlacement(
  ctx: CanvasRenderingContext2D,
  pixelWidth: number,
  view: Rect,
  region: Rect,
  photo: PhotoAsset,
  placement: Placement,
): void {
  const pxPerMm = pixelWidth / view.w;
  const scale = coverScale(photo, region, placement.rotation) * placement.zoom;

  // 출력 배율에 가장 가까운(더 작지 않은) 축소 단계를 고른다
  const outputScale = scale * pxPerMm;
  let mip = photo.mips[0];
  for (const candidate of photo.mips) {
    if (candidate.scale >= outputScale) mip = candidate;
    else break;
  }
  if (!mip || mip.canvas.width === 0 || mip.canvas.height === 0) return;

  ctx.save();
  ctx.setTransform(pxPerMm, 0, 0, pxPerMm, -view.x * pxPerMm, -view.y * pxPerMm);
  ctx.translate(region.x + region.w / 2 + placement.x, region.y + region.h / 2 + placement.y);
  ctx.rotate(placement.rotation * DEG);
  const drawW = photo.width * scale;
  const drawH = photo.height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mip.canvas, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

/**
 * 키 하나의 인쇄면을 size×size 캔버스로 만든다 (3D 텍스처, 사진 내보내기에 쓴다).
 * background 가 null 이면 사진이 덮지 않는 곳을 투명하게 둔다.
 */
export function renderFaceCanvas(
  size: number,
  view: Rect,
  region: Rect,
  photo: PhotoAsset,
  placement: Placement,
  background: string | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);
    }
    drawPlacement(ctx, size, view, region, photo, placement);
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// 사진 불러오기 (브라우저 안에서만 처리하며 어디로도 전송하지 않는다)
// ---------------------------------------------------------------------------

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function drawScaled(source: CanvasImageSource, target: HTMLCanvasElement): void {
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, target.width, target.height);
}

/** 작업 해상도의 긴 변. 화면이 작은 터치 기기는 메모리를 아끼려고 조금 낮춘다 */
function workingMaxSide(): number {
  if (typeof window === 'undefined') return 2048;
  const smallTouch = navigator.maxTouchPoints > 0 && Math.min(window.screen.width, window.screen.height) < 820;
  return smallTouch ? 1536 : 2048;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(file.name);
}

/** sideLimit: 작업 해상도(긴 변)를 이보다 크지 않게 한다. 사진을 많이 올릴 때 메모리를 아끼려고 쓴다 */
export async function loadPhotoFile(file: File, sideLimit?: number): Promise<PhotoAsset> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();

    const isVector = file.type === 'image/svg+xml';
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    if (!width || !height) {
      // 크기 정보가 없는 SVG
      width = 1024;
      height = 1024;
    }
    const maxSide = Math.min(workingMaxSide(), sideLimit ?? Infinity);
    const longSide = Math.max(width, height);
    // 벡터 이미지는 작게 지정돼 있어도 선명하게 키워서 그린다
    const scale = isVector ? 1024 / longSide : Math.min(1, maxSide / longSide);

    const base = makeCanvas(width * scale, height * scale);
    drawScaled(img, base);

    const mips: PhotoMip[] = [{ canvas: base, scale: 1 }];
    let previous = base;
    let mipScale = 1;
    while (Math.max(previous.width, previous.height) > 320) {
      mipScale /= 2;
      const next = makeCanvas(base.width * mipScale, base.height * mipScale);
      drawScaled(previous, next);
      mips.push({ canvas: next, scale: next.width / base.width });
      previous = next;
    }

    const thumbScale = Math.min(1, 192 / Math.max(previous.width, previous.height));
    const thumb = makeCanvas(previous.width * thumbScale, previous.height * thumbScale);
    drawScaled(previous, thumb);
    const thumbUrl = thumb.toDataURL('image/png');
    thumb.width = 0;
    thumb.height = 0;

    return { id: makeId(), name: file.name, width: base.width, height: base.height, mips, thumbUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 캔버스 메모리를 바로 돌려준다 (특히 iOS Safari 의 캔버스 메모리 한도 대비) */
export function disposePhoto(photo: PhotoAsset): void {
  for (const mip of photo.mips) {
    mip.canvas.width = 0;
    mip.canvas.height = 0;
  }
}
