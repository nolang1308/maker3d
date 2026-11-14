/**
 * 클리커 꾸미기 상태: 종류, 사진 목록, 키마다의 배치, 선택.
 * 모든 변경을 한곳(designReducer)에서 처리해 "사진 추가 → 빈 키에 자동 배치 → 선택" 같은 연쇄가 한 번에 일어난다.
 */

import {
  ClickerLayout,
  ClickerLayoutId,
  DEFAULT_LAYOUT_ID,
  MAX_KEYS,
  PhotoMode,
  getLayoutById,
  regionFor,
  spanRegion,
} from './layouts';
import { clampPlacement, createPlacement, PhotoAsset, Placement } from './placement';

/** 올려 둘 수 있는 사진 수. 직접 입력한 큰 배열(예: 5×5)에서도 키마다 다른 사진을 넣을 수 있게 넉넉히 둔다 */
export const MAX_PHOTOS = 30;

export interface DesignState {
  layoutId: ClickerLayoutId;
  /** 사용자가 고른 배치 방식. 키가 하나뿐이면 항상 each 로 동작한다 (getMode) */
  mode: PhotoMode;
  photos: PhotoAsset[];
  /** 키 인덱스별 배치 (each 모드). 종류를 바꿔도 유지된다 */
  slots: (Placement | null)[];
  /** 한 장을 이어 붙일 때의 배치 (span 모드) */
  span: Placement | null;
  /** 선택한 키. span 모드에서는 null 이 아니면 전체가 선택된 것으로 본다 */
  selected: number | null;
}

export type DesignAction =
  | { type: 'setLayout'; layoutId: ClickerLayoutId }
  | { type: 'setMode'; mode: PhotoMode }
  | { type: 'select'; index: number | null }
  /** target: 사진을 놓은 키. null 이면 빈 키부터 차례로 채운다 */
  | { type: 'addPhotos'; photos: PhotoAsset[]; target: number | null }
  /** 이미 올린 사진을 키에 넣는다. target 이 null 이면 선택한 키 → 첫 빈 키 순으로 고른다 */
  | { type: 'usePhoto'; photoId: string; target: number | null }
  | { type: 'place'; index: number; placement: Placement }
  | { type: 'clear'; index: number }
  | { type: 'deletePhoto'; photoId: string }
  | { type: 'reset' };

export const initialDesign: DesignState = {
  layoutId: DEFAULT_LAYOUT_ID,
  mode: 'each',
  photos: [],
  slots: Array.from({ length: MAX_KEYS }, () => null),
  span: null,
  selected: null,
};

export function getLayout(state: DesignState): ClickerLayout {
  return getLayoutById(state.layoutId);
}

export function getMode(state: DesignState): PhotoMode {
  return getLayout(state).keys.length > 1 ? state.mode : 'each';
}

export function getPlacement(state: DesignState, index: number): Placement | null {
  return getMode(state) === 'span' ? state.span : (state.slots[index] ?? null);
}

/** 새로 올린 사진이 곧바로 키에 들어가는지. false 면 사진 목록에만 추가된다 */
export function willPlaceUpload(state: DesignState, target: number | null): boolean {
  if (target !== null || state.selected !== null) return true;
  if (getMode(state) === 'span') return !state.span;
  const layout = getLayout(state);
  return layout.keys.length === 1 || layout.keys.some((key) => !state.slots[key.index]);
}

/** 지금 사진을 넣을 수 있는 자리가 있는지 (선택한 키 또는 빈 키) */
export function canUsePhoto(state: DesignState): boolean {
  if (getMode(state) === 'span') return true;
  if (state.selected !== null) return true;
  return getLayout(state).keys.some((key) => !state.slots[key.index]);
}

function samePlacement(a: Placement | null, b: Placement): boolean {
  return (
    a !== null &&
    a.photoId === b.photoId &&
    a.x === b.x &&
    a.y === b.y &&
    a.zoom === b.zoom &&
    a.rotation === b.rotation
  );
}

export function designReducer(state: DesignState, action: DesignAction): DesignState {
  const layout = getLayout(state);
  const mode = getMode(state);
  const findPhoto = (id: string) => state.photos.find((p) => p.id === id);

  switch (action.type) {
    case 'setLayout': {
      if (action.layoutId === state.layoutId) return state;
      const nextLayout = getLayoutById(action.layoutId);
      // 이어 붙이는 영역의 모양이 달라지므로 이동 범위를 새 영역에 맞춘다
      const spanPhoto = state.span ? findPhoto(state.span.photoId) : undefined;
      const span = state.span && spanPhoto ? clampPlacement(state.span, spanPhoto, spanRegion(nextLayout)) : null;
      const selected = state.selected !== null && state.selected < nextLayout.keys.length ? state.selected : null;
      // 키가 늘어나 빈 자리가 생기면, 아직 어느 키에도 넣지 않은 사진을 올린 순서대로 채운다
      const slots = [...state.slots];
      const used = new Set(nextLayout.keys.map((key) => slots[key.index]?.photoId));
      const spare = state.photos.filter((photo) => !used.has(photo.id));
      for (const key of nextLayout.keys) {
        if (spare.length === 0) break;
        if (!slots[key.index]) slots[key.index] = createPlacement(spare.shift()!.id);
      }
      return { ...state, layoutId: action.layoutId, span, selected, slots };
    }

    case 'setMode': {
      if (action.mode === state.mode) return state;
      if (action.mode === 'span') {
        // 이미 올린 사진이 있으면 첫 장을 바로 펼쳐 보여준다
        const firstId = layout.keys.map((k) => state.slots[k.index]?.photoId).find(Boolean) ?? state.photos[0]?.id;
        const span = state.span ?? (firstId ? createPlacement(firstId) : null);
        return { ...state, mode: 'span', span, selected: null };
      }
      // 키마다 넣기로 돌아왔는데 전부 비어 있으면 올린 사진을 차례로 채운다
      const allEmpty = layout.keys.every((k) => !state.slots[k.index]);
      if (!allEmpty || state.photos.length === 0) return { ...state, mode: 'each', selected: null };
      const slots = [...state.slots];
      layout.keys.forEach((key, i) => {
        const photo = state.photos[i];
        if (photo) slots[key.index] = createPlacement(photo.id);
      });
      return { ...state, mode: 'each', slots, selected: null };
    }

    case 'select': {
      const index = action.index !== null && action.index >= 0 && action.index < layout.keys.length ? action.index : null;
      return index === state.selected ? state : { ...state, selected: index };
    }

    case 'addPhotos': {
      const room = Math.max(0, MAX_PHOTOS - state.photos.length);
      const added = action.photos.slice(0, room);
      if (added.length === 0) return state;
      const photos = [...state.photos, ...added];

      if (mode === 'span') {
        // 키 위에 직접 놓았거나 아직 사진이 없을 때만 새 사진으로 바꾼다
        if (action.target !== null || state.selected !== null || !state.span) {
          return { ...state, photos, span: createPlacement(added[0].id), selected: 0 };
        }
        return { ...state, photos };
      }

      const slots = [...state.slots];
      const queue = [...added];
      let first: number | null = null;
      // 놓은 키(또는 선택해 둔 빈 키)를 먼저 채우고, 남은 사진은 빈 키에 차례로 넣는다
      const selectedEmpty = state.selected !== null && !slots[state.selected] ? state.selected : null;
      const start = action.target ?? selectedEmpty;
      if (start !== null && start < layout.keys.length) {
        slots[start] = createPlacement(queue.shift()!.id);
        first = start;
      }
      for (const key of layout.keys) {
        if (queue.length === 0) break;
        if (slots[key.index]) continue;
        slots[key.index] = createPlacement(queue.shift()!.id);
        if (first === null) first = key.index;
      }
      if (first === null) {
        // 빈 키가 없다: 선택해 둔 키(키가 하나뿐이면 그 키)의 사진을 새 사진으로 바꾼다.
        // 어느 키인지 알 수 없으면 목록에만 추가한다 (willPlaceUpload 가 false 인 경우)
        const replace = state.selected ?? (layout.keys.length === 1 ? 0 : null);
        if (replace !== null) {
          slots[replace] = createPlacement(queue.shift()!.id);
          first = replace;
        }
      }
      return { ...state, photos, slots, selected: first ?? state.selected };
    }

    case 'usePhoto': {
      if (!findPhoto(action.photoId)) return state;
      if (mode === 'span') {
        if (state.span?.photoId === action.photoId) return { ...state, selected: state.selected ?? 0 };
        return { ...state, span: createPlacement(action.photoId), selected: state.selected ?? 0 };
      }
      let index = action.target ?? state.selected;
      if (index === null) index = layout.keys.find((k) => !state.slots[k.index])?.index ?? null;
      if (index === null || index >= layout.keys.length) return state;
      // 같은 사진을 다시 고르면 맞춰 둔 위치를 그대로 둔다
      if (state.slots[index]?.photoId === action.photoId) return { ...state, selected: index };
      const slots = [...state.slots];
      slots[index] = createPlacement(action.photoId);
      return { ...state, slots, selected: index };
    }

    case 'place': {
      const photo = findPhoto(action.placement.photoId);
      if (!photo || action.index < 0 || action.index >= layout.keys.length) return state;
      const next = clampPlacement(action.placement, photo, regionFor(layout, mode, action.index));
      if (mode === 'span') return samePlacement(state.span, next) ? state : { ...state, span: next };
      if (samePlacement(state.slots[action.index] ?? null, next)) return state;
      const slots = [...state.slots];
      slots[action.index] = next;
      return { ...state, slots };
    }

    case 'clear': {
      if (mode === 'span') return state.span ? { ...state, span: null } : state;
      if (!state.slots[action.index]) return state;
      const slots = [...state.slots];
      slots[action.index] = null;
      return { ...state, slots };
    }

    case 'deletePhoto': {
      if (!findPhoto(action.photoId)) return state;
      return {
        ...state,
        photos: state.photos.filter((p) => p.id !== action.photoId),
        slots: state.slots.map((s) => (s?.photoId === action.photoId ? null : s)),
        span: state.span?.photoId === action.photoId ? null : state.span,
      };
    }

    case 'reset':
      return { ...initialDesign, layoutId: state.layoutId, mode: state.mode };

    default:
      return state;
  }
}
