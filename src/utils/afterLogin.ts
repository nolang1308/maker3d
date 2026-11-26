/**
 * 로그인한 뒤 돌아갈 곳.
 *
 * 무언가를 하다가 로그인이 필요해져 로그인 페이지로 보낼 때, 돌아올 주소를 적어 둔다.
 * 로그인 페이지는 로그인에 성공하면 이 주소로 보낸다 (없으면 홈).
 * 같은 탭 안에서만 통하는 sessionStorage 에 두므로, 회원가입 → 정보 입력 → 로그인처럼
 * 여러 페이지를 거쳐도 유지되고 탭을 닫으면 사라진다.
 */

const KEY = 'maker3d:afterLogin';
/** 이 시간이 지난 기록은 쓰지 않는다 (오래전에 적어 둔 곳으로 뜬금없이 보내지 않게) */
const VALID_MS = 60 * 60 * 1000;

/** 사이트 안의 주소만 받는다 ('/' 로 시작하고, 다른 사이트를 가리키는 '//' 나 '/\' 는 아님) */
const isInternalPath = (path: unknown): path is string =>
  typeof path === 'string' && /^\/(?![/\\])/.test(path);

export function setAfterLogin(path: string): void {
  if (!isInternalPath(path)) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 로그인 뒤 홈으로 가게 둔다
  }
}

/** 적어 둔 주소를 꺼내고 지운다. 없거나 오래됐으면 null */
export function takeAfterLogin(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof saved.at !== 'number' || Date.now() - saved.at > VALID_MS) return null;
    return isInternalPath(saved.path) ? saved.path : null;
  } catch {
    return null;
  }
}

export function clearAfterLogin(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
