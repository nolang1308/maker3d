/**
 * 만들던 쉐이프 클리커를 이 기기(브라우저)에 잠시 보관한다.
 *
 * 로그인이나 회원가입을 하러 페이지를 떠났다가 돌아와도 이어서 만들 수 있게 하려는 것이다.
 * 올린 로고 파일은 용량이 커서 localStorage 에 넣을 수 없으므로 IndexedDB 를 쓴다.
 * 서버로는 아무것도 보내지 않는다. 보관한 내용은 KEEP_MS 가 지나면 버린다.
 *
 * 키보드 클리커의 보관함(utils/clicker/draftStore)과 같은 방식이고, 서로 섞이지 않게 보관함은 따로 둔다.
 */

const DB_NAME = 'maker3d-shape-clicker';
const DB_VERSION = 1;
const META_STORE = 'draft';
const LOGO_STORE = 'logo';
const KEY = 'current';

/** 보관 형식이 바뀌면 올린다. 다른 버전으로 보관한 내용은 읽지 않고 버린다 */
const DRAFT_VERSION = 1;
/** 보관 기간: 하루. 로그인 · 회원가입을 하고 돌아오기에는 넉넉하고, 로고가 기기에 오래 남지는 않는다 */
const KEEP_MS = 24 * 60 * 60 * 1000;

export interface ShapeDraft {
  version: number;
  savedAt: number;
  step: string;
  /** 올린 로고 파일의 이름. 예시 모양으로 만들고 있었으면 null (파일은 LOGO_STORE 에 따로 들어 있다) */
  logoName: string | null;
  /** 예시 모양 */
  sampleId: string;
  sizeMm: number;
  marginMm: number;
  switchAt: { u: number; v: number } | null;
  showRing: boolean;
  lugAngle: number | null;
  bodyColor: string;
  capColor: string;
}

export type ShapeDraftInput = Omit<ShapeDraft, 'version' | 'savedAt'>;

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
      if (!db.objectStoreNames.contains(LOGO_STORE)) db.createObjectStore(LOGO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('보관함을 열지 못했습니다.'));
    request.onblocked = () => reject(new Error('보관함이 다른 탭에서 사용 중입니다.'));
  });
}

/** 한 번의 작업(transaction)으로 묶어 실행하고, 다 끝나면 결과를 돌려준다 */
async function withStores<T>(
  mode: IDBTransactionMode,
  run: (meta: IDBObjectStore, logo: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction([META_STORE, LOGO_STORE], mode);
      const request = run(tx.objectStore(META_STORE), tx.objectStore(LOGO_STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error('보관함 작업에 실패했습니다.'));
      tx.onabort = () => reject(tx.error ?? new Error('보관함 작업이 취소되었습니다.'));
    });
  } finally {
    db.close();
  }
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** 보관해 둔 내용이 쓸 수 있는 모양인지 확인한다 (형식이 다르거나 망가졌으면 null) */
function parseDraft(raw: unknown): ShapeDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.version !== DRAFT_VERSION || !isNumber(d.savedAt)) return null;
  if (typeof d.step !== 'string' || typeof d.sampleId !== 'string') return null;
  if (!isNumber(d.sizeMm) || !isNumber(d.marginMm)) return null;
  if (typeof d.bodyColor !== 'string' || typeof d.capColor !== 'string') return null;
  const at = d.switchAt as Record<string, unknown> | null | undefined;
  return {
    version: DRAFT_VERSION,
    savedAt: d.savedAt,
    step: d.step,
    logoName: typeof d.logoName === 'string' ? d.logoName : null,
    sampleId: d.sampleId,
    sizeMm: d.sizeMm,
    marginMm: d.marginMm,
    switchAt: at && isNumber(at.u) && isNumber(at.v) ? { u: at.u, v: at.v } : null,
    showRing: d.showRing !== false,
    lugAngle: isNumber(d.lugAngle) ? d.lugAngle : null,
    bodyColor: d.bodyColor,
    capColor: d.capColor,
  };
}

/** 보관해 둔 내용과 로고 파일을 읽는다. 없거나, 기간이 지났거나, 읽을 수 없으면 null */
export async function loadShapeDraft(): Promise<{ draft: ShapeDraft; logoFile: Blob | null } | null> {
  let raw: unknown;
  try {
    raw = await withStores('readonly', (meta) => meta.get(KEY));
  } catch {
    return null;
  }
  const draft = parseDraft(raw);
  if (!draft || Date.now() - draft.savedAt > KEEP_MS) {
    if (raw !== undefined) await clearShapeDraft();
    return null;
  }

  let logoFile: Blob | null = null;
  if (draft.logoName !== null) {
    try {
      const stored = await withStores('readonly', (_meta, logo) => logo.get(KEY));
      if (stored instanceof Blob) logoFile = stored;
    } catch {
      // 로고를 읽지 못하면 로고 없이 나머지(크기 · 색상)만 되살린다
    }
  }
  return { draft, logoFile };
}

/**
 * 지금 상태를 보관한다.
 * logo: 새로 올린 로고 파일이면 그 파일, 예시 모양으로 돌아갔으면 'remove', 그대로면 'keep'.
 * 로고와 나머지 내용을 한 번에 써서, 도중에 끊겨도 서로 어긋나지 않게 한다.
 */
export async function saveShapeDraft(input: ShapeDraftInput, logo: Blob | 'remove' | 'keep'): Promise<void> {
  const draft: ShapeDraft = { ...input, version: DRAFT_VERSION, savedAt: Date.now() };
  await withStores('readwrite', (meta, logoStore) => {
    if (logo === 'remove') logoStore.delete(KEY);
    else if (logo !== 'keep') logoStore.put(logo, KEY);
    meta.put(draft, KEY);
  });
}

/** 보관해 둔 내용을 모두 지운다 */
export async function clearShapeDraft(): Promise<void> {
  try {
    await withStores('readwrite', (meta, logo) => {
      meta.clear();
      logo.clear();
    });
  } catch {
    // 지우지 못해도 다음에 읽을 때 기간이 지난 것은 다시 걸러진다
  }
}
