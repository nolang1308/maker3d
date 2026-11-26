/**
 * 만들던 클리커를 이 기기(브라우저)에 잠시 보관한다.
 *
 * 로그인이나 회원가입을 하러 페이지를 떠났다가 돌아와도 이어서 만들 수 있게 하려는 것이다.
 * 사진은 용량이 커서 localStorage 에 넣을 수 없으므로 IndexedDB 를 쓴다.
 * 서버로는 아무것도 보내지 않는다. 보관한 내용은 KEEP_MS 가 지나면 버린다.
 */

import type { Placement } from './placement';
import type { PhotoMode } from './layouts';

const DB_NAME = 'maker3d-clicker';
const DB_VERSION = 1;
const META_STORE = 'draft';
const PHOTO_STORE = 'photos';
const META_KEY = 'current';

/** 보관 형식이 바뀌면 올린다. 다른 버전으로 보관한 내용은 읽지 않고 버린다 */
const DRAFT_VERSION = 1;
/** 보관 기간: 하루. 로그인 · 회원가입을 하고 돌아오기에는 넉넉하고, 사진이 기기에 오래 남지는 않는다 */
const KEEP_MS = 24 * 60 * 60 * 1000;

export interface ClickerDraft {
  version: number;
  savedAt: number;
  step: string;
  layoutId: string;
  mode: PhotoMode;
  slots: (Placement | null)[];
  span: Placement | null;
  /** 올린 순서 그대로의 사진 목록. 사진 파일은 PHOTO_STORE 에 id 로 따로 들어 있다 */
  photos: { id: string; name: string }[];
  caseColor: string;
  keycapColor: string;
  showRing: boolean;
  grid: { cols: string; rows: string };
}

export type ClickerDraftInput = Omit<ClickerDraft, 'version' | 'savedAt'>;

interface StoredPhoto {
  id: string;
  name: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저에서는 보관 기능을 쓸 수 없습니다.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('보관함을 열지 못했습니다.'));
    request.onblocked = () => reject(new Error('보관함이 다른 탭에서 사용 중입니다.'));
  });
}

/** 한 번의 작업(transaction)으로 묶어 실행하고, 다 끝나면 결과를 돌려준다 */
async function withStores<T>(
  mode: IDBTransactionMode,
  run: (meta: IDBObjectStore, photos: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction([META_STORE, PHOTO_STORE], mode);
      const request = run(tx.objectStore(META_STORE), tx.objectStore(PHOTO_STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error('보관함 작업에 실패했습니다.'));
      tx.onabort = () => reject(tx.error ?? new Error('보관함 작업이 취소되었습니다.'));
    });
  } finally {
    db.close();
  }
}

function isPlacement(value: unknown): value is Placement {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.photoId === 'string' &&
    [p.x, p.y, p.zoom, p.rotation].every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** 보관해 둔 내용이 쓸 수 있는 모양인지 확인한다 (형식이 다르거나 망가졌으면 null) */
function parseDraft(raw: unknown): ClickerDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== DRAFT_VERSION || typeof d.savedAt !== 'number') return null;
  if (typeof d.step !== 'string' || typeof d.layoutId !== 'string') return null;
  if (d.mode !== 'each' && d.mode !== 'span') return null;
  if (!Array.isArray(d.slots) || !Array.isArray(d.photos)) return null;
  if (typeof d.caseColor !== 'string' || typeof d.keycapColor !== 'string') return null;
  const grid = d.grid as Record<string, unknown> | undefined;
  return {
    version: DRAFT_VERSION,
    savedAt: d.savedAt,
    step: d.step,
    layoutId: d.layoutId,
    mode: d.mode,
    slots: d.slots.map((slot) => (isPlacement(slot) ? slot : null)),
    span: isPlacement(d.span) ? d.span : null,
    photos: d.photos.filter(
      (p): p is { id: string; name: string } =>
        !!p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string',
    ).map((p) => ({ id: p.id, name: typeof p.name === 'string' ? p.name : '사진' })),
    caseColor: d.caseColor,
    keycapColor: d.keycapColor,
    showRing: d.showRing !== false,
    grid: {
      cols: typeof grid?.cols === 'string' ? grid.cols : '',
      rows: typeof grid?.rows === 'string' ? grid.rows : '',
    },
  };
}

/** 보관해 둔 내용과 사진 파일을 읽는다. 없거나, 기간이 지났거나, 읽을 수 없으면 null */
export async function loadDraft(): Promise<{ draft: ClickerDraft; files: Map<string, Blob> } | null> {
  let raw: unknown;
  try {
    raw = await withStores('readonly', (meta) => meta.get(META_KEY));
  } catch {
    return null;
  }
  const draft = parseDraft(raw);
  if (!draft || Date.now() - draft.savedAt > KEEP_MS) {
    if (raw !== undefined) await clearDraft();
    return null;
  }

  const files = new Map<string, Blob>();
  try {
    const stored = (await withStores('readonly', (_meta, photos) => photos.getAll())) as StoredPhoto[] | undefined;
    for (const photo of stored ?? []) {
      if (photo && typeof photo.id === 'string' && photo.blob instanceof Blob) files.set(photo.id, photo.blob);
    }
  } catch {
    // 사진을 읽지 못하면 사진 없이 나머지(종류 · 색상)만 되살린다
  }
  return { draft, files };
}

/**
 * 지금 상태를 보관한다.
 * addPhotos: 새로 보관할 사진 파일, removePhotoIds: 더 이상 쓰지 않아 지울 사진.
 * 사진과 나머지 내용을 한 번에 써서, 도중에 끊겨도 서로 어긋나지 않게 한다.
 */
export async function saveDraft(
  input: ClickerDraftInput,
  addPhotos: { id: string; name: string; blob: Blob }[],
  removePhotoIds: string[],
): Promise<void> {
  const draft: ClickerDraft = { ...input, version: DRAFT_VERSION, savedAt: Date.now() };
  await withStores('readwrite', (meta, photos) => {
    for (const id of removePhotoIds) photos.delete(id);
    for (const photo of addPhotos) photos.put(photo satisfies StoredPhoto, photo.id);
    meta.put(draft, META_KEY);
  });
}

/** 보관해 둔 내용을 모두 지운다 */
export async function clearDraft(): Promise<void> {
  try {
    await withStores('readwrite', (meta, photos) => {
      meta.clear();
      photos.clear();
    });
  } catch {
    // 지우지 못해도 다음에 읽을 때 기간이 지난 것은 다시 걸러진다
  }
}
