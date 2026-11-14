'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './ClickerEditor.module.scss';
import {
  CLICKER,
  ClickerLayout,
  PhotoMode,
  PRINT_FACE,
  PRINT_FACE_RADIUS,
  Rect,
  faceRect,
  getKeycapProfile,
  regionFor,
  spanRegion,
} from '@/utils/clicker/layouts';
import { drawPlacement, PhotoAsset, Placement, Point, zoomPlacement } from '@/utils/clicker/placement';
import { luminance, mixHex } from '@/utils/clicker/color';

/** 사진 목록에서 키로 끌어다 놓을 때 쓰는 드래그 데이터 형식 */
export const PHOTO_DRAG_TYPE = 'application/x-maker3d-clicker-photo';

/** 화면이 아무리 커도 키가 지나치게 커지지 않게 하는 상한 (px/mm) */
const MAX_SCALE = 21;
/** 이보다 적게 움직이면 드래그가 아니라 클릭으로 본다 (px) */
const DRAG_THRESHOLD = 3;
/**
 * 키캡을 위에서 본 모습 (mm). 3D 모델과 같은 치수를 쓴다.
 * 바깥(바닥)에서 안쪽으로: 기울어진 옆면 → 윗면 가장자리의 둥근 턱 → 사진이 올라가는 평평한 면.
 * 키캡은 모서리가 둥글어서, 사진도 그 모양대로 모서리가 둥글게 잘린다
 */
const KEYCAP_PROFILE = getKeycapProfile();
const KEYCAP_TOP = {
  /** 바닥 가장자리에서 윗면 가장자리까지 (옆면이 위에서 보이는 폭) */
  slope: CLICKER.keycapBottom / 2 - KEYCAP_PROFILE.filletStartHalf,
  /** 윗면 가장자리의 모서리 반경 */
  radius: KEYCAP_PROFILE.filletStartRadius,
};
/** 옆면의 밝기가 모서리를 돌며 바뀌는 구간 (대각선 양쪽으로, 도). 둥근 모서리라 뚝 끊기지 않고 이어진다 */
const CORNER_BLEND = 9;

/** 초점을 맞춘 키의 윗면이 편집 화면의 짧은 변에서 차지하는 비율 */
const FOCUS_FILL = 0.58;
const FOCUS_MAX_SCALE = 8;
/** 이만큼도 커지지 않으면(이미 크게 보이면) 확대하지 않는다 */
const FOCUS_MIN_SCALE = 1.15;
/** 확대 · 축소 · 옆 키로 옮겨 가는 움직임의 길이 (ms). 스타일의 transition 과 맞춘다 */
const FOCUS_MOTION_MS = 450;

interface ClickerEditorProps {
  layout: ClickerLayout;
  mode: PhotoMode;
  photos: ReadonlyMap<string, PhotoAsset>;
  slots: readonly (Placement | null)[];
  span: Placement | null;
  selected: number | null;
  caseColor: string;
  keycapColor: string;
  /** 선택한 키로 화면을 확대해 초점을 맞출지. 꺼 두면 선택만 표시하고 전체를 그대로 보여준다 */
  focusSelected?: boolean;
  onSelect: (index: number | null) => void;
  /** 범위를 벗어난 값이 올 수 있으므로 받는 쪽에서 정리한다 */
  onPlacementChange: (index: number, placement: Placement) => void;
  /** 사진이 없는 키를 눌렀을 때 */
  onRequestPhoto: (index: number) => void;
  onDropFiles: (files: File[], index: number | null) => void;
  onDropPhoto: (photoId: string, index: number) => void;
  onRemove: (index: number) => void;
}

interface Gesture {
  index: number;
  start: Placement;
  startMid: Point;
  startDist: number;
  /** 확대 기준점 (영역 중심 기준 mm) */
  anchor: Point;
  moved: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function acceptsDrag(e: React.DragEvent): 'files' | 'photo' | null {
  const types = Array.from(e.dataTransfer.types);
  if (types.includes('Files')) return 'files';
  if (types.includes(PHOTO_DRAG_TYPE)) return 'photo';
  return null;
}

// ---------------------------------------------------------------------------
// 사진을 그리는 캔버스
// ---------------------------------------------------------------------------

interface PlacementCanvasProps {
  width: number;
  height: number;
  view: Rect;
  region: Rect;
  photo: PhotoAsset;
  placement: Placement;
  /** null 이면 투명 */
  background: string | null;
  /** 화면에서 확대해 보여줄 때의 배율. 그만큼 해상도를 높여 그린다 */
  pixelScale?: number;
}

const PlacementCanvas = memo(function PlacementCanvas({
  width,
  height,
  view,
  region,
  photo,
  placement,
  background,
  pixelScale = 1,
}: PlacementCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = Math.min(Math.min(window.devicePixelRatio || 1, 3) * pixelScale, 2048 / Math.max(width, height));
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, pw, ph);
    } else {
      ctx.clearRect(0, 0, pw, ph);
    }
    drawPlacement(ctx, pw, view, region, photo, placement);
  }, [width, height, view, region, photo, placement, background, pixelScale]);

  return <canvas ref={ref} style={{ width, height }} aria-hidden="true" />;
});

// ---------------------------------------------------------------------------
// 편집기
// ---------------------------------------------------------------------------

export default function ClickerEditor({
  layout,
  mode,
  photos,
  slots,
  span,
  selected,
  caseColor,
  keycapColor,
  focusSelected = true,
  onSelect,
  onPlacementChange,
  onRequestPhoto,
  onDropFiles,
  onDropPhoto,
  onRemove,
}: ClickerEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const clickerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dropTarget, setDropTarget] = useState<number | 'stage' | null>(null);
  const [dragging, setDragging] = useState(false);

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // mm → px 배치. 키링 고리까지 포함한 전체가 화면 가운데 오도록 맞춘다
  const geo = useMemo(() => {
    const { lug, caseWidth, caseDepth } = layout;
    const reach = lug ? lug.length : 0;
    const minX = -caseWidth / 2 - (lug && lug.dx < 0 ? reach : 0);
    const maxX = caseWidth / 2 + (lug && lug.dx > 0 ? reach : 0);
    const minY = -caseDepth / 2 - (lug && lug.dy < 0 ? reach : 0);
    const maxY = caseDepth / 2 + (lug && lug.dy > 0 ? reach : 0);
    const pad = clamp(Math.min(size.w, size.h) * 0.09, 14, 56);
    const k = clamp(
      Math.min((size.w - 2 * pad) / (maxX - minX), (size.h - 2 * pad) / (maxY - minY)),
      1,
      MAX_SCALE,
    );
    const width = (maxX - minX) * k;
    const height = (maxY - minY) * k;
    return { k, minX, minY, width, height, left: (size.w - width) / 2, top: (size.h - height) / 2 };
  }, [layout, size]);

  const faces = useMemo(() => layout.keys.map((key) => faceRect(key)), [layout]);
  const wholeRegion = useMemo(() => spanRegion(layout), [layout]);

  const { k } = geo;
  const px = (x: number) => (x - geo.minX) * k;
  const py = (y: number) => (y - geo.minY) * k;
  const facePx = PRINT_FACE * k;

  // 키에 초점을 맞출 때의 확대 배율: 키 윗면이 화면의 짧은 변을 FOCUS_FILL 만큼 채운다.
  // 한 장을 이어 붙일 때는 전체를 보며 맞추므로 확대하지 않고, 이미 크게 보이는 종류(1구 등)도 그대로 둔다
  const focusScale = useMemo(() => {
    const face = PRINT_FACE * geo.k;
    if (mode !== 'each' || face <= 0 || size.w <= 0 || size.h <= 0) return 1;
    const scale = Math.min((Math.min(size.w, size.h) * FOCUS_FILL) / face, FOCUS_MAX_SCALE);
    return scale >= FOCUS_MIN_SCALE ? scale : 1;
  }, [mode, geo, size]);

  // 선택한 키를 화면 가운데로 끌어와 확대한다
  const focus = useMemo(() => {
    const key = focusSelected && focusScale > 1 && selected !== null ? layout.keys[selected] : undefined;
    if (!key) return null;
    return {
      scale: focusScale,
      x: size.w / 2 - geo.left - (key.cx - geo.minX) * geo.k * focusScale,
      y: size.h / 2 - geo.top - (key.cy - geo.minY) * geo.k * focusScale,
    };
  }, [focusSelected, focusScale, selected, layout, geo, size]);
  const viewScale = focus?.scale ?? 1;
  /** 화면에 실제로 보이는 px/mm (확대 포함). 포인터 좌표를 mm 로 바꿀 때 쓴다 */
  const ks = k * viewScale;

  // 사진을 그리는 해상도 배율. 확대할 때는 바로 올리고, 축소할 때는 움직임이 끝날 때까지 높은 해상도를 유지한다
  // (바로 낮추면 줄어드는 동안 사진이 뿌옇게 보인다)
  const [sharp, setSharp] = useState({ view: 1, render: 1 });
  if (sharp.view !== viewScale) {
    setSharp({ view: viewScale, render: Math.max(viewScale, sharp.view) });
  }
  useEffect(() => {
    if (sharp.render <= sharp.view) return;
    const timer = window.setTimeout(() => setSharp((s) => ({ view: s.view, render: s.view })), FOCUS_MOTION_MS + 60);
    return () => window.clearTimeout(timer);
  }, [sharp]);

  const spanPhoto = span ? photos.get(span.photoId) : undefined;

  const targetOf = (index: number) => {
    const placement = mode === 'span' ? span : (slots[index] ?? null);
    const photo = placement ? photos.get(placement.photoId) : undefined;
    if (!placement || !photo) return null;
    return { placement, photo, region: regionFor(layout, mode, index) };
  };
  const isSelected = (index: number) => (mode === 'span' ? selected !== null : selected === index);

  /** 화면 좌표 → 영역 중심 기준 mm */
  const toRegionMm = (clientX: number, clientY: number, region: Rect): Point => {
    const rect = clickerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) / ks + geo.minX - (region.x + region.w / 2),
      y: (clientY - rect.top) / ks + geo.minY - (region.y + region.h / 2),
    };
  };

  // -------------------------------------------------------------------------
  // 드래그 이동 / 두 손가락 확대
  // -------------------------------------------------------------------------

  const beginGesture = (index: number, placement: Placement, region: Rect, moved: boolean) => {
    const pts = [...pointers.current.values()];
    const mid = centroid(pts);
    gesture.current = {
      index,
      start: placement,
      startMid: mid,
      startDist: pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      anchor: toRegionMm(mid.x, mid.y, region),
      moved,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    suppressClick.current = false;

    const active = gesture.current;
    if (active) {
      // 두 번째 손가락이 닿으면 확대/축소로 전환
      if (e.pointerType === 'touch' && pointers.current.size === 1) {
        const target = targetOf(active.index);
        if (!target) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        beginGesture(active.index, target.placement, target.region, true);
      }
      return;
    }

    const keyEl = (e.target as HTMLElement).closest<HTMLElement>('[data-key-index]');
    if (!keyEl) return;
    const index = Number(keyEl.dataset.keyIndex);
    const target = targetOf(index);
    if (!target) return;
    const already = isSelected(index);
    // 아직 고르지 않은 키는 먼저 눌러서 고른다 (그러면 그 키로 확대된다). 누르자마자 끌면 화면이 확대되는 도중에 사진이 딸려 간다.
    // 터치에서는 스크롤과 헷갈리지 않도록 늘 먼저 탭해서 선택한 뒤에 움직인다
    if (!already && (e.pointerType === 'touch' || focusScale > 1)) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture(index, target.placement, target.region, false);
    setDragging(true);
    if (!already) onSelect(index);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const mid = centroid(pts);
    const dx = mid.x - g.startMid.x;
    const dy = mid.y - g.startMid.y;
    if (!g.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      g.moved = true;
    }
    let base = g.start;
    if (pts.length >= 2 && g.startDist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      base = zoomPlacement(g.start, g.start.zoom * (dist / g.startDist), g.anchor);
    }
    onPlacementChange(g.index, { ...base, x: base.x + dx / ks, y: base.y + dy / ks });
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (!g) return;
    const target = pointers.current.size > 0 ? targetOf(g.index) : null;
    if (target) {
      // 손가락 하나가 남았으면 그 자리에서 이동을 이어 간다
      beginGesture(g.index, target.placement, target.region, true);
      return;
    }
    if (g.moved) suppressClick.current = true;
    pointers.current.clear();
    gesture.current = null;
    setDragging(false);
    // 이미 고른 키를 움직이지 않고 눌렀다 뗀 경우. 포인터를 붙잡은 뒤의 클릭은 키가 아니라 클리커 묶음으로 가서
    // handleKeyClick 이 불리지 않으므로, 여기서 "이 키를 눌렀다"고 알린다 (전체 보기 상태였다면 이 키로 확대된다)
    if (!g.moved && e.type === 'pointerup') onSelect(g.index);
  };

  // 휠 확대: 페이지 스크롤을 막아야 해서 passive 가 아닌 리스너로 직접 건다
  const wheelHandler = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelHandler.current = (e: WheelEvent) => {
      const keyEl = (e.target as HTMLElement).closest<HTMLElement>('[data-key-index]');
      if (!keyEl) return;
      const index = Number(keyEl.dataset.keyIndex);
      if (!isSelected(index)) return;
      const target = targetOf(index);
      if (!target) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 320 : 1;
      const delta = clamp(e.deltaY * unit, -160, 160);
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002));
      const anchor = toRegionMm(e.clientX, e.clientY, target.region);
      onPlacementChange(index, zoomPlacement(target.placement, target.placement.zoom * factor, anchor));
    };
  });
  useEffect(() => {
    const el = clickerRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => wheelHandler.current(e);
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, []);

  // -------------------------------------------------------------------------
  // 클릭 / 키보드
  // -------------------------------------------------------------------------

  const handleKeyClick = (index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (targetOf(index)) onSelect(index);
    else onRequestPhoto(index);
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const el = e.target as HTMLElement;
    // 포인터를 붙잡은 뒤의 클릭은 클리커 묶음 자체로 올 수 있다. 그건 빈 곳을 누른 게 아니다
    if (el === clickerRef.current || el.closest('[data-key-index]')) return;
    onSelect(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    const target = targetOf(index);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (target) onSelect(index);
      else onRequestPhoto(index);
      return;
    }
    if (e.key === 'Escape') {
      onSelect(null);
      return;
    }
    if (!target || !isSelected(index)) return;
    const step = e.shiftKey ? 1 : 0.2;
    const { placement } = target;
    const move = (dx: number, dy: number) => {
      e.preventDefault();
      onPlacementChange(index, { ...placement, x: placement.x + dx, y: placement.y + dy });
    };
    switch (e.key) {
      case 'ArrowLeft':
        return move(-step, 0);
      case 'ArrowRight':
        return move(step, 0);
      case 'ArrowUp':
        return move(0, -step);
      case 'ArrowDown':
        return move(0, step);
      case '+':
      case '=':
        e.preventDefault();
        return onPlacementChange(index, zoomPlacement(placement, placement.zoom * 1.08));
      case '-':
      case '_':
        e.preventDefault();
        return onPlacementChange(index, zoomPlacement(placement, placement.zoom / 1.08));
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        return onRemove(index);
      default:
        return;
    }
  };

  // -------------------------------------------------------------------------
  // 끌어다 놓기 (파일 / 사진 목록)
  // -------------------------------------------------------------------------

  const handleDragOver = (e: React.DragEvent, target: number | 'stage') => {
    const kind = acceptsDrag(e);
    if (!kind) return;
    // 사진 목록에서 끌어온 것은 키 위에만 놓을 수 있다
    if (kind === 'photo' && target === 'stage') return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (dropTarget !== target) setDropTarget(target);
  };

  const handleDragLeave = (e: React.DragEvent, target: number | 'stage') => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropTarget((current) => (current === target ? null : current));
  };

  const handleDrop = (e: React.DragEvent, target: number | 'stage') => {
    const kind = acceptsDrag(e);
    if (!kind) return;
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    if (kind === 'files') {
      onDropFiles(Array.from(e.dataTransfer.files), target === 'stage' ? null : target);
    } else if (target !== 'stage') {
      const photoId = e.dataTransfer.getData(PHOTO_DRAG_TYPE);
      if (photoId) onDropPhoto(photoId, target);
    }
  };

  // -------------------------------------------------------------------------
  // 모양
  // -------------------------------------------------------------------------

  const ready = size.w > 0 && size.h > 0;
  const darkCap = luminance(keycapColor) < 0.2;
  const skirt = (CLICKER.keycapBottom - PRINT_FACE) / 2;
  const capShades = darkCap
    ? {
        top: mixHex(keycapColor, '#ffffff', 0.17),
        left: mixHex(keycapColor, '#ffffff', 0.1),
        right: mixHex(keycapColor, '#ffffff', 0.04),
        bottom: mixHex(keycapColor, '#000000', 0.35),
      }
    : {
        top: mixHex(keycapColor, '#000000', 0.03),
        left: mixHex(keycapColor, '#000000', 0.08),
        right: mixHex(keycapColor, '#000000', 0.13),
        bottom: mixHex(keycapColor, '#000000', 0.2),
      };
  const emptyInk = darkCap ? 'rgba(255, 255, 255, 0.78)' : 'rgba(17, 24, 39, 0.5)';
  // 옆면: 가운데에서 바깥으로 본 방향에 따라 밝기가 다르고(빛이 왼쪽 위에서 온다), 모서리에서는 부드럽게 이어진다
  const b = CORNER_BLEND;
  const capSides = `conic-gradient(from 0deg, ${capShades.top} 0deg ${45 - b}deg, ${capShades.right} ${45 + b}deg ${135 - b}deg, ${
    capShades.bottom
  } ${135 + b}deg ${225 - b}deg, ${capShades.left} ${225 + b}deg ${315 - b}deg, ${capShades.top} ${315 + b}deg 360deg)`;
  // 윗면 가장자리의 둥근 턱: 빛을 받는 쪽은 밝고 반대쪽은 어둡다
  const capRim = `linear-gradient(135deg, ${mixHex(keycapColor, '#ffffff', darkCap ? 0.2 : 0.55)} 0%, ${keycapColor} 50%, ${mixHex(
    keycapColor,
    '#000000',
    darkCap ? 0.3 : 0.1,
  )} 100%)`;

  // 키링 고리: 옆면에 세로로 선 작은 고리라 위에서는 가는 막대로 보인다 (안쪽 끝은 몸체 밑에 살짝 겹친다)
  const { lug, well } = layout;
  let lugRect: Rect | null = null;
  if (lug) {
    const overlap = 1;
    const tip = { x: lug.x + lug.dx * lug.length, y: lug.y + lug.dy * lug.length };
    const root = { x: lug.x - lug.dx * overlap, y: lug.y - lug.dy * overlap };
    const half = lug.thickness / 2;
    lugRect =
      lug.dx === 0
        ? { x: lug.x - half, y: Math.min(tip.y, root.y), w: lug.thickness, h: Math.abs(tip.y - root.y) }
        : { x: Math.min(tip.x, root.x), y: lug.y - half, w: Math.abs(tip.x - root.x), h: lug.thickness };
  }

  const showGhost = mode === 'span' && selected !== null && span !== null && spanPhoto !== undefined;
  // 키가 아주 작게 보일 때는 번호표가 사진을 다 가리므로 숨긴다 (키를 눌러 확대하면 다시 보인다)
  const showNumbers = layout.keys.length > 1 && mode === 'each' && facePx * viewScale >= 30;
  const anySelected = selected !== null;

  return (
    <div
      ref={stageRef}
      className={`${styles.stage} ${dropTarget === 'stage' ? styles.stageDrop : ''}`}
      onClick={handleStageClick}
      onDragEnter={(e) => handleDragOver(e, 'stage')}
      onDragOver={(e) => handleDragOver(e, 'stage')}
      onDragLeave={(e) => handleDragLeave(e, 'stage')}
      onDrop={(e) => handleDrop(e, 'stage')}
    >
      <div
        ref={clickerRef}
        className={`${styles.clicker} ${ready ? '' : styles.hidden} ${anySelected ? styles.active : ''} ${
          dragging ? styles.dragging : ''
        } ${focus ? styles.focused : ''}`}
        style={
          {
            left: geo.left,
            top: geo.top,
            width: geo.width,
            height: geo.height,
            transform: focus ? `translate(${focus.x}px, ${focus.y}px) scale(${focus.scale})` : undefined,
            // 확대해도 선택 테두리와 번호표는 원래 굵기·크기로 보이게 한다
            '--inv': 1 / viewScale,
            // 키가 작게 보일 때는 번호표도 줄여 사진을 가리지 않게 한다
            '--badge': `${clamp(facePx * viewScale * 0.3, 12, 20)}px`,
          } as React.CSSProperties
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onLostPointerCapture={endPointer}
      >
        {lugRect && (
          <div
            className={styles.lug}
            style={{
              left: px(lugRect.x),
              top: py(lugRect.y),
              width: lugRect.w * k,
              height: lugRect.h * k,
              borderRadius: 0.5 * k,
              backgroundColor: mixHex(caseColor, '#000000', 0.08),
            }}
          />
        )}
        <div
          className={styles.case}
          style={{
            left: px(-layout.caseWidth / 2),
            top: py(-layout.caseDepth / 2),
            width: layout.caseWidth * k,
            height: layout.caseDepth * k,
            borderRadius: layout.cornerRadius * k,
            backgroundColor: caseColor,
          }}
        />
        {/* 테두리 벽 안쪽, 키캡이 들어가는 낮은 자리 */}
        <div
          className={styles.well}
          style={{
            left: px(well.x),
            top: py(well.y),
            width: well.w * k,
            height: well.h * k,
            borderRadius: 0.8 * k,
            backgroundColor: mixHex(caseColor, '#000000', 0.2),
          }}
        />

        {showGhost && span && spanPhoto && (
          <div
            className={styles.ghost}
            style={{
              left: px(wholeRegion.x),
              top: py(wholeRegion.y),
              borderRadius: PRINT_FACE_RADIUS * k,
            }}
          >
            <PlacementCanvas
              width={wholeRegion.w * k}
              height={wholeRegion.h * k}
              view={wholeRegion}
              region={wholeRegion}
              photo={spanPhoto}
              placement={span}
              background={null}
            />
          </div>
        )}

        {layout.keys.map((key) => {
          const target = targetOf(key.index);
          const keySelected = isSelected(key.index);
          const dropHere = dropTarget !== null && dropTarget !== 'stage' && (mode === 'span' || dropTarget === key.index);
          const number = key.index + 1;
          const label = target
            ? `${number}번 키: 사진 있음${keySelected ? ', 선택됨' : ''}`
            : `${number}번 키: 비어 있음, 눌러서 사진 넣기`;
          return (
            <div
              key={key.index}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={keySelected}
              data-key-index={key.index}
              className={`${styles.keycap} ${target ? styles.filled : ''} ${keySelected ? styles.selected : ''}`}
              style={
                {
                  left: px(key.cx - CLICKER.keycapBottom / 2),
                  top: py(key.cy - CLICKER.keycapBottom / 2),
                  width: CLICKER.keycapBottom * k,
                  height: CLICKER.keycapBottom * k,
                  padding: skirt * k,
                  borderRadius: CLICKER.keycapCornerBottom * k,
                  background: capSides,
                  '--skirt': `${skirt * k}px`,
                  '--cap-inset': `${KEYCAP_TOP.slope * k}px`,
                  '--cap-radius': `${KEYCAP_TOP.radius * k}px`,
                  '--cap-rim': capRim,
                } as React.CSSProperties
              }
              onClick={() => handleKeyClick(key.index)}
              onKeyDown={(e) => handleKeyDown(e, key.index)}
              onDragEnter={(e) => handleDragOver(e, key.index)}
              onDragOver={(e) => handleDragOver(e, key.index)}
              onDragLeave={(e) => handleDragLeave(e, key.index)}
              onDrop={(e) => handleDrop(e, key.index)}
            >
              <div className={styles.face} style={{ borderRadius: PRINT_FACE_RADIUS * k, backgroundColor: keycapColor }}>
                {target ? (
                  <PlacementCanvas
                    width={facePx}
                    height={facePx}
                    view={faces[key.index]}
                    region={mode === 'span' ? wholeRegion : faces[key.index]}
                    photo={target.photo}
                    placement={target.placement}
                    background={keycapColor}
                    pixelScale={sharp.render}
                  />
                ) : (
                  <div className={styles.empty} style={{ color: emptyInk }}>
                    <svg
                      width={clamp(facePx * 0.26, 14, 40)}
                      height={clamp(facePx * 0.26, 14, 40)}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {facePx >= 104 && <span>사진 넣기</span>}
                  </div>
                )}
                {dropHere && <div className={styles.dropHint}>{facePx >= 104 ? '여기에 놓기' : ''}</div>}
              </div>
              {showNumbers && <span className={styles.number}>{number}</span>}
            </div>
          );
        })}
      </div>

      {focus && (
        <button
          type="button"
          className={styles.zoomOut}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(null);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
          </svg>
          전체 보기
        </button>
      )}
    </div>
  );
}
