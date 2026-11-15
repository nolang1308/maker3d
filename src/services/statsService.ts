import { collection, documentId, endAt, getDocs, orderBy, query, startAt } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { STATS_COLLECTION, addDays } from '@/utils/visitStats/classify';

type Counts = Record<string, number>;

// 하루치 통계 (siteStats/{YYYY-MM-DD} 문서 하나)
export interface DayStats {
  date: string;
  pageViews: number;
  visits: number;
  visitors: number;
  newVisitors: number;
  pages: Counts;
  landings: Counts;
  channels: Counts;
  campaigns: Counts;
  keywords: Counts;
  referrers: Counts;
  devices: Counts;
  hourViews: Counts;
  hourVisits: Counts;
  funnel: Counts;
  /** 단계(estimate · inquiry) → 접속 경로별 수 */
  stepChannels: Record<string, Counts>;
  stepCampaigns: Record<string, Counts>;
  /** 마지막으로 기록된 시각(ms). 없으면 0 */
  updatedAt: number;
}

const COUNT_FIELDS = ['pages', 'landings', 'channels', 'campaigns', 'keywords', 'referrers', 'devices', 'hourViews', 'hourVisits', 'funnel'] as const;

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function toCounts(value: unknown): Counts {
  if (!value || typeof value !== 'object') return {};
  const result: Counts = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    const number = toNumber(count);
    if (number > 0) result[key] = number;
  }
  return result;
}

function toNestedCounts(value: unknown): Record<string, Counts> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, Counts> = {};
  for (const [key, counts] of Object.entries(value as Record<string, unknown>)) {
    result[key] = toCounts(counts);
  }
  return result;
}

export function emptyDay(date: string): DayStats {
  return {
    date,
    pageViews: 0,
    visits: 0,
    visitors: 0,
    newVisitors: 0,
    pages: {},
    landings: {},
    channels: {},
    campaigns: {},
    keywords: {},
    referrers: {},
    devices: {},
    hourViews: {},
    hourVisits: {},
    funnel: {},
    stepChannels: {},
    stepCampaigns: {},
    updatedAt: 0,
  };
}

function parseDay(date: string, data: Record<string, unknown>): DayStats {
  const updated = data.updatedAt as { toMillis?: () => number } | undefined;
  return {
    date,
    pageViews: toNumber(data.pageViews),
    visits: toNumber(data.visits),
    visitors: toNumber(data.visitors),
    newVisitors: toNumber(data.newVisitors),
    pages: toCounts(data.pages),
    landings: toCounts(data.landings),
    channels: toCounts(data.channels),
    campaigns: toCounts(data.campaigns),
    keywords: toCounts(data.keywords),
    referrers: toCounts(data.referrers),
    devices: toCounts(data.devices),
    hourViews: toCounts(data.hourViews),
    hourVisits: toCounts(data.hourVisits),
    funnel: toCounts(data.funnel),
    stepChannels: toNestedCounts(data.stepChannels),
    stepCampaigns: toNestedCounts(data.stepCampaigns),
    updatedAt: typeof updated?.toMillis === 'function' ? updated.toMillis() : 0,
  };
}

/** from ~ to 날짜의 기록을 읽는다. from 이 null 이면 처음부터 (기록이 있는 날만 돌려준다) */
export async function loadDayStats(from: string | null, to: string): Promise<DayStats[]> {
  const base = collection(db, STATS_COLLECTION);
  const range = from
    ? query(base, orderBy(documentId()), startAt(from), endAt(to))
    : query(base, orderBy(documentId()), endAt(to));
  const snapshot = await getDocs(range);
  return snapshot.docs
    .filter((document) => /^\d{4}-\d{2}-\d{2}$/.test(document.id))
    .map((document) => parseDay(document.id, document.data()));
}

/** 기록이 없는 날을 0 으로 채워 from ~ to 를 빠짐없이 잇는다 */
export function fillDays(rows: DayStats[], from: string, to: string): DayStats[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const days: DayStats[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    days.push(byDate.get(date) ?? emptyDay(date));
  }
  return days;
}

function addCounts(target: Counts, source: Counts): void {
  for (const [key, count] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + count;
  }
}

/** 여러 날의 기록을 하나로 합친다 */
export function sumDays(rows: DayStats[]): DayStats {
  const total = emptyDay('');
  for (const row of rows) {
    total.pageViews += row.pageViews;
    total.visits += row.visits;
    total.visitors += row.visitors;
    total.newVisitors += row.newVisitors;
    total.updatedAt = Math.max(total.updatedAt, row.updatedAt);
    for (const field of COUNT_FIELDS) addCounts(total[field], row[field]);
    for (const field of ['stepChannels', 'stepCampaigns'] as const) {
      for (const [step, counts] of Object.entries(row[field])) {
        total[field][step] = total[field][step] ?? {};
        addCounts(total[field][step], counts);
      }
    }
  }
  return total;
}

/** 많은 순으로 정렬한 [이름, 수] 목록 */
export function ranked(counts: Counts): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
