/**
 * 키보드 클리커 규격과 키 배열 (단위 mm).
 *
 * 케이스 종류는 실제 제작용 모델에서 뽑아낸 목록(models.generated.json)을 그대로 쓴다.
 * 목록은 `node scripts/build-clicker-models.mjs` 가 clicker/ 폴더의 STL 을 분석해서 만든다.
 *
 * 위에서 내려다본 좌표계를 쓴다: x 는 오른쪽, y 는 아래(사용자 쪽), 원점은 케이스 몸체 중심.
 * 2D 편집기와 3D 모델이 같은 값을 공유한다.
 */

import manifest from './models.generated.json';

export type ClickerLayoutId = string;

/** each: 키마다 사진 한 장 / span: 사진 한 장을 모든 키에 이어서 */
export type PhotoMode = 'each' | 'span';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 키캡 · 스위치 · 키링처럼 케이스 모델에 들어 있지 않은 부품의 치수 */
export const CLICKER = {
  /** 키캡 바닥 한 변 */
  keycapBottom: 18.1,
  /** 키캡 윗면 한 변 (모서리 라운드 포함) */
  keycapTop: 15.0,
  keycapHeight: 8.2,
  keycapTopFillet: 0.6,
  keycapCornerBottom: 1.4,
  keycapCornerTop: 2.4,
  /** 스위치가 얹히는 판에서 키캡 바닥까지 (MX 스위치에 키캡을 끼웠을 때) */
  keycapSeat: 6.0,
  /** 눌렀을 때 내려가는 거리 */
  keyTravel: 3.6,

  switchBase: 15.6,
  switchTop: 11.6,
  switchHeight: 6.4,

  ringRadius: 7,
  ringTube: 0.7,
} as const;

// ---------------------------------------------------------------------------
// 키캡 단면
// ---------------------------------------------------------------------------

export interface KeycapProfile {
  /** 옆면 기울기 (수직 기준, 라디안) */
  taper: number;
  /** 사진이 올라가는 평평한 윗면의 절반 폭 */
  faceHalf: number;
  /** 윗면 모서리 반경 */
  faceRadius: number;
  /** 윗면 라운드가 시작되는 높이 / 절반 폭 / 모서리 반경 */
  filletStartY: number;
  filletStartHalf: number;
  filletStartRadius: number;
}

export function getKeycapProfile(): KeycapProfile {
  const C = CLICKER;
  const taper = Math.atan((C.keycapBottom - C.keycapTop) / 2 / C.keycapHeight);
  const f = C.keycapTopFillet;
  // 기울어진 옆면과 수평 윗면에 동시에 접하는 라운드
  const faceHalf = C.keycapTop / 2 - f * Math.tan(Math.PI / 4 - taper / 2);
  const filletStartY = C.keycapHeight - f + f * Math.sin(taper);
  const filletStartHalf = faceHalf + f * Math.cos(taper);
  const filletStartRadius =
    C.keycapCornerBottom + (C.keycapCornerTop - C.keycapCornerBottom) * (filletStartY / C.keycapHeight);
  const faceRadius = Math.max(0.3, filletStartRadius - f * Math.cos(taper));
  return { taper, faceHalf, faceRadius, filletStartY, filletStartHalf, filletStartRadius };
}

const PROFILE = getKeycapProfile();

/** 사진이 인쇄되는 윗면 한 변 (mm) */
export const PRINT_FACE = PROFILE.faceHalf * 2;
/** 인쇄면 모서리 반경 (mm) */
export const PRINT_FACE_RADIUS = PROFILE.faceRadius;

// ---------------------------------------------------------------------------
// 케이스 종류
// ---------------------------------------------------------------------------

export interface ClickerKey {
  index: number;
  col: number;
  row: number;
  /** 키(스위치 구멍) 중심 */
  cx: number;
  cy: number;
}

/** 키링을 거는 고리: 몸체 옆면에 세로로 선 작은 고리 */
export interface ClickerLug {
  /** 몸체 옆면 위의 부착점 */
  x: number;
  y: number;
  /** 바깥 방향 단위 벡터 */
  dx: number;
  dy: number;
  /** 튀어나온 길이 / 두께 */
  length: number;
  thickness: number;
  /** 구멍: 몸체 면에서 중심까지의 거리 / 바닥에서의 높이 / 반경 */
  hole: { offset: number; height: number; radius: number };
}

export interface ClickerLayout {
  id: ClickerLayoutId;
  /** "3구" */
  label: string;
  /** "일자형" */
  description: string;
  cols: number;
  rows: number;
  keys: ClickerKey[];
  /** 몸체 크기 (고리 제외) */
  caseWidth: number;
  caseDepth: number;
  caseHeight: number;
  cornerRadius: number;
  /** 키캡이 들어가는 안쪽 공간 (테두리 벽 안쪽) */
  well: Rect;
  /** 바닥에서 스위치가 얹히는 판까지의 높이 */
  plateHeight: number;
  lug: ClickerLug | null;
  /** 3D 미리보기용 메시 파일. 직접 입력한 크기는 파일이 없어 null (같은 규격으로 그 자리에서 만든다) */
  meshUrl: string | null;
  /** 준비된 제작용 모델이 아니라 사용자가 직접 입력한 크기인지 */
  custom: boolean;
}

/**
 * 케이스 공통 규격 (mm). 준비된 제작용 모델들을 재서 얻은 값이며,
 * 직접 입력한 크기의 케이스를 같은 모양으로 만들 때 쓴다.
 */
export const CASE_SPEC = {
  /** 키 간격 */
  pitch: 19.2,
  /** 가장 바깥 키 칸에서 몸체 외곽까지 */
  margin: 4.3,
  height: 21,
  cornerRadius: 3.9,
  /** 옆면은 이 높이에서 가장 넓고, 위아래 끝으로 갈수록 taperInset 만큼 좁아진다 */
  widestHeight: 13,
  taperInset: 2.04,
  /** 윗면 · 바닥면 외곽의 모서리 반경 */
  edgeCornerRadius: 2.85,
  /** 안쪽 공간이 키 칸보다 사방으로 넓은 정도 / 모서리 반경 / 바닥 높이(스위치 판 기준) */
  wellSlack: 0.33,
  wellCornerRadius: 1,
  wellFloorAbovePlate: 2,
  plateHeight: 12,
  lug: { length: 3.02, thickness: 2, hole: { offset: 0.94, height: 10.46, radius: 1 } },
} as const;

/** 직접 입력할 수 있는 가로 · 세로 키 수의 범위 */
export const CUSTOM_GRID = { min: 1, max: 5 } as const;

export const CLICKER_LAYOUT_LIST: ClickerLayout[] = manifest.map((model) => ({
  id: model.id,
  label: model.label,
  description: model.description,
  cols: model.cols,
  rows: model.rows,
  keys: model.keys.map((key, index) => ({
    index,
    col: index % model.cols,
    row: Math.floor(index / model.cols),
    cx: key.x,
    cy: key.y,
  })),
  caseWidth: model.body.width,
  caseDepth: model.body.depth,
  caseHeight: model.body.height,
  cornerRadius: model.body.cornerRadius,
  well: model.well,
  plateHeight: model.plateHeight,
  lug: model.lug,
  meshUrl: model.mesh,
  custom: false,
}));

export const CLICKER_LAYOUTS: Record<ClickerLayoutId, ClickerLayout> = Object.fromEntries(
  CLICKER_LAYOUT_LIST.map((layout) => [layout.id, layout]),
);

export const DEFAULT_LAYOUT_ID: ClickerLayoutId = CLICKER_LAYOUT_LIST[0].id;

/** 한 클리커에 들어가는 최대 키 수 (직접 입력 포함) */
export const MAX_KEYS = Math.max(CUSTOM_GRID.max * CUSTOM_GRID.max, ...CLICKER_LAYOUT_LIST.map((l) => l.keys.length));

// ---------------------------------------------------------------------------
// 직접 입력한 크기
// ---------------------------------------------------------------------------

const CUSTOM_ID = /^custom-(\d+)x(\d+)$/;
const customLayouts = new Map<ClickerLayoutId, ClickerLayout>();

export const inGridRange = (n: number) => Number.isInteger(n) && n >= CUSTOM_GRID.min && n <= CUSTOM_GRID.max;

function describeGrid(cols: number, rows: number): string {
  if (cols * rows === 1) return '키 1개';
  if (rows === 1) return '일자형';
  if (cols === 1) return '세로 일자형';
  return rows === cols ? `정사각형 ${cols}×${rows}` : `${cols}×${rows}`;
}

/** 가로 cols · 세로 rows 개의 키를 공통 규격대로 늘어놓은 케이스 */
export function createCustomLayout(cols: number, rows: number): ClickerLayout {
  const id = `custom-${cols}x${rows}`;
  const cached = customLayouts.get(id);
  if (cached) return cached;

  const S = CASE_SPEC;
  const keys: ClickerKey[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      keys.push({
        index: keys.length,
        col,
        row,
        cx: (col - (cols - 1) / 2) * S.pitch,
        cy: (row - (rows - 1) / 2) * S.pitch,
      });
    }
  }
  const caseWidth = cols * S.pitch + 2 * S.margin;
  const caseDepth = rows * S.pitch + 2 * S.margin;
  const wellW = cols * S.pitch + 2 * S.wellSlack;
  const wellH = rows * S.pitch + 2 * S.wellSlack;
  const layout: ClickerLayout = {
    id,
    label: `${cols * rows}구`,
    description: describeGrid(cols, rows),
    cols,
    rows,
    keys,
    caseWidth,
    caseDepth,
    caseHeight: S.height,
    cornerRadius: S.cornerRadius,
    well: { x: -wellW / 2, y: -wellH / 2, w: wellW, h: wellH },
    plateHeight: S.plateHeight,
    // 준비된 모델들처럼 왼쪽 옆면 가운데에 고리를 단다
    lug: { x: -caseWidth / 2, y: 0, dx: -1, dy: 0, ...S.lug },
    meshUrl: null,
    custom: true,
  };
  customLayouts.set(id, layout);
  return layout;
}

/** 같은 배열의 제작용 모델이 준비되어 있으면 그것을, 없으면 직접 만든 것을 돌려준다 */
export function findLayoutForGrid(cols: number, rows: number): ClickerLayout {
  return CLICKER_LAYOUT_LIST.find((l) => l.cols === cols && l.rows === rows) ?? createCustomLayout(cols, rows);
}

export function getLayoutById(id: ClickerLayoutId): ClickerLayout {
  const known = CLICKER_LAYOUTS[id];
  if (known) return known;
  const match = CUSTOM_ID.exec(id);
  if (match) {
    const cols = Number(match[1]);
    const rows = Number(match[2]);
    if (inGridRange(cols) && inGridRange(rows)) return createCustomLayout(cols, rows);
  }
  return CLICKER_LAYOUT_LIST[0];
}

// ---------------------------------------------------------------------------
// 인쇄 영역
// ---------------------------------------------------------------------------

/** 키 하나의 인쇄면 */
export function faceRect(key: ClickerKey): Rect {
  return { x: key.cx - PRINT_FACE / 2, y: key.cy - PRINT_FACE / 2, w: PRINT_FACE, h: PRINT_FACE };
}

/** 모든 키의 인쇄면을 감싸는 영역 (사진 한 장을 이어 붙일 때의 기준) */
export function spanRegion(layout: ClickerLayout): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const key of layout.keys) {
    minX = Math.min(minX, key.cx - PRINT_FACE / 2);
    minY = Math.min(minY, key.cy - PRINT_FACE / 2);
    maxX = Math.max(maxX, key.cx + PRINT_FACE / 2);
    maxY = Math.max(maxY, key.cy + PRINT_FACE / 2);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** 사진 배치의 기준이 되는 영역 */
export function regionFor(layout: ClickerLayout, mode: PhotoMode, keyIndex: number): Rect {
  if (mode === 'span') return spanRegion(layout);
  return faceRect(layout.keys[keyIndex] ?? layout.keys[0]);
}

/** 키캡 바닥의 높이 (바닥 기준) */
export function keycapBaseHeight(layout: ClickerLayout): number {
  return layout.plateHeight + CLICKER.keycapSeat;
}

/** 키캡까지 포함한 전체 크기 (키링 고리 제외) */
export function getClickerSize(layout: ClickerLayout): { width: number; depth: number; height: number } {
  return {
    width: layout.caseWidth,
    depth: layout.caseDepth,
    height: Math.max(layout.caseHeight, keycapBaseHeight(layout) + CLICKER.keycapHeight),
  };
}
