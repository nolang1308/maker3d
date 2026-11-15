// 방문 기록: 브라우저에서 "오늘의 통계" 문서 하나에 숫자를 더한다.
// 누가 왔는지는 저장하지 않는다. 방문자를 가리는 번호도 만들지 않고, 이 브라우저가
// 오늘 · 이번 방문에 이미 세어졌는지만 브라우저 안(localStorage)에 적어 둔다.

import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, usingEmulator } from '@/config/firebase';
import {
  BOT_PATTERN,
  SESSION_GAP_MS,
  STATS_COLLECTION,
  classifyVisit,
  deviceOf,
  kstParts,
  normalizePath,
} from './classify';
import type { QuoteStep } from './classify';

const STATE_KEY = 'm3dVisit';
/** 관리자 화면에서 "이 브라우저는 통계에서 제외"를 켜면 생기는 표시 */
export const OPT_OUT_KEY = 'm3dStatsOff';

// 여기에 있는 주소로 들어온 것만 센다. 개발용 주소(localhost)나 미리보기 주소는 통계에 섞이지 않는다
const OWN_HOSTS = ['www.maker3d.kr', 'maker3d.kr'];

interface VisitState {
  /** 이 브라우저가 처음 온 날 */
  first: string;
  /** 방문자 수에 마지막으로 세어진 날 */
  day: string;
  /** 마지막으로 움직인 시각 */
  last: number;
  /** 이번 방문의 접속 경로와 광고 이름 */
  ch: string;
  camp: string;
  /** 이번 방문에서 이미 센 견적 단계 */
  steps: string[];
}

// 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등)에서는 페이지가 떠 있는 동안만 기억한다
let memoryState: VisitState | null = null;
let blocked = false;
let landed = false;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function loadState(): VisitState | null {
  const raw = readStorage(STATE_KEY);
  if (!raw) return memoryState;
  try {
    const parsed = JSON.parse(raw) as Partial<VisitState>;
    if (typeof parsed.last !== 'number' || typeof parsed.ch !== 'string') return memoryState;
    return {
      first: String(parsed.first ?? ''),
      day: String(parsed.day ?? ''),
      last: parsed.last,
      ch: parsed.ch,
      camp: String(parsed.camp ?? ''),
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
    };
  } catch {
    return memoryState;
  }
}

function saveState(state: VisitState): void {
  memoryState = state;
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // 저장소를 못 쓰면 memoryState 로만 이어 간다
  }
}

/** 관리자로 로그인한 동안에는 세지 않는다 (VisitTracker 가 알려 준다) */
export function setTrackingBlocked(value: boolean): void {
  blocked = value;
}

export function isOptedOut(): boolean {
  return typeof window !== 'undefined' && readStorage(OPT_OUT_KEY) === '1';
}

export function setOptedOut(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(OPT_OUT_KEY, '1');
    else window.localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // 저장소를 못 쓰는 브라우저에서는 설정할 수 없다
  }
}

function trackingAllowed(): boolean {
  if (typeof window === 'undefined' || blocked || isOptedOut()) return false;
  // 에뮬레이터에 붙어 있을 때는 자동 시험도 기록돼야 하므로 아래 검사를 건너뛴다
  if (usingEmulator) return true;
  if (!OWN_HOSTS.includes(window.location.hostname)) return false;
  if (navigator.webdriver || BOT_PATTERN.test(navigator.userAgent)) return false;
  return true;
}

type Counters = Record<string, unknown>;

function write(day: string, counters: Counters): void {
  setDoc(
    doc(db, STATS_COLLECTION, day),
    { ...counters, date: day, updatedAt: serverTimestamp() },
    { merge: true },
  ).catch(() => {
    // 통계 저장이 실패해도 사이트 사용에는 영향을 주지 않는다
  });
}

const one = () => increment(1);

/** 페이지를 한 번 본 것을 기록한다. 새 방문이면 접속 경로 · 기기 · 들어온 페이지도 함께 센다 */
export function recordPageView(pathname: string): void {
  try {
    if (!trackingAllowed()) return;
    const path = normalizePath(pathname);
    if (!path) return;

    const now = Date.now();
    const { day, hour } = kstParts(now);
    const previous = loadState();

    // 어디서 왔는지는 사이트에 막 들어온 첫 화면에서만 알 수 있다 (사이트 안에서 옮겨 다닐 때는 보지 않는다)
    const isLanding = !landed;
    landed = true;
    const attribution = isLanding
      ? classifyVisit({
          search: window.location.search,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          ownHosts: [...OWN_HOSTS, window.location.hostname],
        })
      : null;

    const expired = !previous || now - previous.last > SESSION_GAP_MS;
    const arrivedByNewLink = !!previous && !!attribution?.explicit
      && (attribution.channel !== previous.ch || attribution.campaign !== previous.camp);
    const isNewVisit = expired || arrivedByNewLink;

    const state: VisitState = previous
      ? { ...previous, last: now }
      : { first: day, day: '', last: now, ch: 'direct', camp: '', steps: [] };

    const counters: Counters = {
      pageViews: one(),
      pages: { [path]: one() },
      hourViews: { [hour]: one() },
    };

    if (isNewVisit) {
      // 사이트를 켜 둔 채 30분 넘게 쉬었다가 다시 움직인 경우에는 처음 들어온 경로를 그대로 잇는다
      state.ch = attribution?.channel ?? previous?.ch ?? 'direct';
      state.camp = attribution?.campaign ?? previous?.camp ?? '';
      state.steps = [];

      counters.visits = one();
      counters.channels = { [state.ch]: one() };
      counters.landings = { [path]: one() };
      counters.devices = { [deviceOf(navigator.userAgent)]: one() };
      counters.hourVisits = { [hour]: one() };
      if (state.camp) counters.campaigns = { [`${state.ch}|${state.camp}`]: one() };
      if (attribution?.keyword) counters.keywords = { [attribution.keyword]: one() };
      if (attribution?.referrerHost) counters.referrers = { [attribution.referrerHost]: one() };
    }

    if (state.day !== day) {
      state.day = day;
      counters.visitors = one();
      if (!previous) counters.newVisitors = one();
    }

    if (path === '/quote' && !state.steps.includes('view')) {
      state.steps = [...state.steps, 'view'];
      counters.funnel = { view: one() };
    }

    saveState(state);
    write(day, counters);
  } catch {
    // 통계 때문에 화면이 멈추는 일은 없어야 한다
  }
}

/** 견적 페이지에서 한 단계를 마친 것을 기록한다. 한 번의 방문에서 같은 단계는 한 번만 센다 */
export function recordQuoteStep(step: Exclude<QuoteStep, 'view'>): void {
  try {
    if (!trackingAllowed()) return;
    const state = loadState();
    // 페이지 방문이 먼저 기록되지 않은 브라우저(제외 설정 등)는 단계도 세지 않는다
    if (!state || state.steps.includes(step)) return;

    const now = Date.now();
    const { day } = kstParts(now);
    saveState({ ...state, last: now, steps: [...state.steps, step] });

    const counters: Counters = { funnel: { [step]: one() } };
    // 어떤 경로로 온 방문이 견적 · 문의까지 갔는지 보려고 경로별로도 센다
    if (step === 'estimate' || step === 'inquiry') {
      counters.stepChannels = { [step]: { [state.ch]: one() } };
      if (state.camp) counters.stepCampaigns = { [step]: { [`${state.ch}|${state.camp}`]: one() } };
    }
    write(day, counters);
  } catch {
    // 통계 때문에 견적 흐름이 멈추는 일은 없어야 한다
  }
}
