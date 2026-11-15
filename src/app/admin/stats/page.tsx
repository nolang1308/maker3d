'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.scss';
import { useAuth } from '@/contexts/AuthContext';
import { DayStats, fillDays, loadDayStats, ranked, sumDays } from '@/services/statsService';
import {
  ChannelGroup,
  DEVICE_LABELS,
  GROUP_LABELS,
  LINK_PRESETS,
  QUOTE_STEPS,
  QUOTE_STEP_LABELS,
  addDays,
  buildTaggedUrl,
  channelInfo,
  classifyVisit,
  kstParts,
  pageLabel,
} from '@/utils/visitStats/classify';
import { isOptedOut, setOptedOut } from '@/utils/visitStats/tracker';
import { CHART_COLORS, ColumnChart, ShareBar, TrendChart, formatCount, formatDay } from './charts';

type ViewId = 'visitors' | 'channels' | 'funnel' | 'links';

const VIEWS: { id: ViewId; label: string; note: string }[] = [
  { id: 'visitors', label: '방문자통계', note: '방문 수 · 시간대 · 페이지' },
  { id: 'channels', label: '접속 경로', note: '어디서 들어왔는지' },
  { id: 'funnel', label: '견적 흐름', note: '견적 페이지의 단계별 수' },
  { id: 'links', label: '광고 링크 만들기', note: '꼬리표 붙은 주소 · 설정' },
];

const PERIODS = [
  { id: 'today', label: '오늘', days: 1 },
  { id: '7', label: '최근 7일', days: 7 },
  { id: '30', label: '최근 30일', days: 30 },
  { id: '90', label: '최근 90일', days: 90 },
  { id: 'all', label: '전체', days: null },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

// 묶음 색은 늘 같은 묶음에 붙는다 (기간을 바꿔도 색이 바뀌지 않는다)
const GROUP_ORDER: ChannelGroup[] = ['search', 'ad', 'social', 'direct', 'etc'];
const GROUP_COLORS: Record<ChannelGroup, string> = {
  search: CHART_COLORS.blue,
  ad: CHART_COLORS.orange,
  social: CHART_COLORS.aqua,
  direct: CHART_COLORS.yellow,
  etc: CHART_COLORS.gray,
};

const WEEKDAY_NAMES = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '-');

interface Loaded {
  key: string;
  periodId: PeriodId;
  today: string;
  rows: DayStats[];
  error: string | null;
}

export default function AdminStatsPage() {
  const { userRole, loading: authLoading } = useAuth();
  const isAdmin = userRole === 'admin';

  const [view, setView] = useState<ViewId>('visitors');
  const [periodId, setPeriodId] = useState<PeriodId>('30');
  const [reloadCount, setReloadCount] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const requestKey = `${periodId}:${reloadCount}`;

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const today = kstParts(Date.now()).day;
    const days = PERIODS.find((period) => period.id === periodId)?.days ?? null;
    // 이전 기간과 견주려고 고른 기간의 두 배를 읽는다 ('전체'는 처음부터)
    const from = days ? addDays(today, -(days * 2 - 1)) : null;

    loadDayStats(from, today)
      .then((rows) => {
        if (!cancelled) setLoaded({ key: requestKey, periodId, today, rows, error: null });
      })
      .catch((error) => {
        console.error('방문 통계 불러오기 오류:', error);
        if (!cancelled) setLoaded({ key: requestKey, periodId, today, rows: [], error: '통계를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, periodId, requestKey]);

  // 새로 읽는 동안에는 앞서 읽은 화면을 흐리게 둔 채 유지한다 (화면이 깜빡이거나 밀리지 않게)
  const refreshing = !!loaded && loaded.key !== requestKey;

  const data = useMemo(() => {
    if (!loaded) return null;
    const period = PERIODS.find((item) => item.id === loaded.periodId) ?? PERIODS[2];
    const from = period.days ? addDays(loaded.today, -(period.days - 1)) : (loaded.rows[0]?.date ?? loaded.today);
    const days = fillDays(loaded.rows.filter((row) => row.date >= from), from, loaded.today);
    const previousRows = period.days ? loaded.rows.filter((row) => row.date < from) : [];
    return {
      period,
      from,
      to: loaded.today,
      days,
      total: sumDays(days),
      previous: previousRows.length > 0 ? sumDays(previousRows) : null,
      everEmpty: loaded.rows.length === 0,
    };
  }, [loaded]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.gate}>확인하는 중입니다...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.gate}>
          <p>관리자만 볼 수 있는 페이지입니다.</p>
          <Link href="/login" className={styles.gateLink}>로그인하러 가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.ManagerSignatureBar}>
        <Image src="/Icon_smile.svg" width={24} height={24} alt="" />
        <p>관리자</p>
      </div>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h1 className={styles.sidebarTitle}>통계</h1>
          <nav aria-label="통계 메뉴">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.sideItem} ${view === item.id ? styles.sideItemActive : ''}`}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                <span className={styles.sideLabel}>{item.label}</span>
                <span className={styles.sideNote}>{item.note}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className={styles.main}>
          {view !== 'links' && (
            <div className={styles.toolbar}>
              <div className={styles.periods} role="group" aria-label="기간">
                {PERIODS.map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    className={`${styles.period} ${periodId === period.id ? styles.periodActive : ''}`}
                    aria-pressed={periodId === period.id}
                    onClick={() => setPeriodId(period.id)}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              <div className={styles.toolbarRight}>
                {data && (
                  <span className={styles.rangeText}>
                    {data.from === data.to ? formatDay(data.to) : `${formatDay(data.from)} ~ ${formatDay(data.to)}`}
                  </span>
                )}
                <button type="button" className={styles.ghostBtn} onClick={() => setReloadCount((count) => count + 1)}>
                  새로 고침
                </button>
              </div>
            </div>
          )}

          {view === 'links' ? (
            <LinksView />
          ) : !data ? (
            <p className={styles.stateText}>통계를 불러오는 중입니다...</p>
          ) : loaded?.error ? (
            <p className={styles.stateText} role="alert">{loaded.error}</p>
          ) : data.everEmpty ? (
            <div className={styles.emptyBox}>
              <p className={styles.emptyTitle}>아직 쌓인 기록이 없습니다.</p>
              <p className={styles.emptyText}>
                방문 기록은 운영 주소(www.maker3d.kr)로 들어온 방문부터 쌓입니다. 관리자로 로그인한 동안의 방문은 세지 않습니다.
              </p>
            </div>
          ) : (
            <div className={refreshing ? styles.refreshing : undefined}>
              {view === 'visitors' && <VisitorsView data={data} />}
              {view === 'channels' && <ChannelsView total={data.total} onOpenLinks={() => setView('links')} />}
              {view === 'funnel' && <FunnelView total={data.total} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 공통 조각
// ---------------------------------------------------------------------------

function Delta({ current, previous, label }: { current: number; previous: number | null; label: string }) {
  if (previous === null || previous <= 0) return <p className={styles.tileDelta}>{label} 기록 없음</p>;
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  const direction = rounded > 0 ? styles.up : rounded < 0 ? styles.down : '';
  return (
    <p className={`${styles.tileDelta} ${direction}`}>
      <span aria-hidden="true">{rounded > 0 ? '▲' : rounded < 0 ? '▼' : '–'}</span>
      {' '}{rounded > 0 ? '+' : ''}{rounded.toLocaleString('ko-KR')}%
      <span className={styles.tileDeltaNote}> {label} 대비</span>
    </p>
  );
}

interface RankRow {
  key: string;
  name: string;
  sub?: string;
  value: number;
  color?: string;
}

function RankTable({ rows, total, nameHead, valueHead, limit = 12 }: { rows: RankRow[]; total: number; nameHead: string; valueHead: string; limit?: number }) {
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(1, ...shown.map((row) => row.value));
  if (rows.length === 0) return <p className={styles.cardEmpty}>이 기간에는 기록이 없습니다.</p>;

  return (
    <table className={styles.rank}>
      <thead>
        <tr>
          <th scope="col">{nameHead}</th>
          <th scope="col" className={styles.num}>{valueHead}</th>
          <th scope="col" className={styles.num}>비율</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((row) => (
          <tr key={row.key}>
            <th scope="row">
              <span className={styles.rankName}>
                {row.color && <span className={styles.dot} style={{ background: row.color }} />}
                {row.name}
                {row.sub && <span className={styles.rankSub}>{row.sub}</span>}
              </span>
              <span className={styles.meter}>
                <span className={styles.meterFill} style={{ width: `${(row.value / max) * 100}%` }} />
              </span>
            </th>
            <td className={styles.num}>{formatCount(row.value)}</td>
            <td className={styles.num}>{percent(row.value, total)}</td>
          </tr>
        ))}
        {rest > 0 && (
          <tr>
            <th scope="row"><span className={styles.rankName}>그 밖의 {rows.length - limit}개</span></th>
            <td className={styles.num}>{formatCount(rest)}</td>
            <td className={styles.num}>{percent(rest, total)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// 방문자통계
// ---------------------------------------------------------------------------

interface ViewData {
  period: (typeof PERIODS)[number];
  days: DayStats[];
  total: DayStats;
  previous: DayStats | null;
}

function VisitorsView({ data }: { data: ViewData }) {
  const { days, total, previous, period } = data;
  const compareLabel = period.days === 1 ? '어제' : `이전 ${period.days}일`;
  const perVisit = total.visits > 0 ? total.pageViews / total.visits : 0;
  const prevPerVisit = previous && previous.visits > 0 ? previous.pageViews / previous.visits : null;

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, '0');
    return { label: `${hour}시`, name: `${hour}시 ~ ${hour + 1}시`, value: total.hourVisits[key] ?? 0 };
  });

  // 요일별 평균: 그 요일이 기간 안에 몇 번 있었는지로 나눈다
  const weekdays = WEEKDAY_NAMES.map((name, index) => {
    const matching = days.filter((day) => (new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7 === index);
    const sum = matching.reduce((acc, day) => acc + day.visits, 0);
    return { label: name.slice(0, 1), name, value: matching.length > 0 ? sum / matching.length : 0 };
  });

  const deviceColors = [CHART_COLORS.blue, CHART_COLORS.orange, CHART_COLORS.aqua];
  const devices = (['mobile', 'desktop', 'tablet'] as const).map((key, index) => ({
    key,
    label: DEVICE_LABELS[key],
    value: total.devices[key] ?? 0,
    color: deviceColors[index],
  }));

  const pages = ranked(total.pages).map(([path, value]) => ({ key: path, name: pageLabel(path), sub: pageLabel(path) === path ? undefined : path, value }));
  const landings = ranked(total.landings).map(([path, value]) => ({ key: path, name: pageLabel(path), sub: pageLabel(path) === path ? undefined : path, value }));

  return (
    <>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>방문 수</p>
          <p className={styles.tileValue}>{formatCount(total.visits)}</p>
          {period.days && <Delta current={total.visits} previous={previous?.visits ?? null} label={compareLabel} />}
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>방문자 수</p>
          <p className={styles.tileValue}>{formatCount(total.visitors)}</p>
          {period.days && <Delta current={total.visitors} previous={previous?.visitors ?? null} label={compareLabel} />}
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>페이지뷰</p>
          <p className={styles.tileValue}>{formatCount(total.pageViews)}</p>
          {period.days && <Delta current={total.pageViews} previous={previous?.pageViews ?? null} label={compareLabel} />}
        </div>
        <div className={styles.tile}>
          <p className={styles.tileLabel}>방문당 본 페이지</p>
          <p className={styles.tileValue}>{(Math.round(perVisit * 10) / 10).toLocaleString('ko-KR')}</p>
          {period.days && <Delta current={perVisit} previous={prevPerVisit} label={compareLabel} />}
        </div>
      </div>

      {days.length > 1 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>방문 추이</h2>
          <TrendChart points={days.map((day) => ({ date: day.date, visits: day.visits, visitors: day.visitors, pageViews: day.pageViews }))} />
          <details className={styles.details}>
            <summary>표로 보기</summary>
            <div className={styles.tableScroll}>
              <table className={styles.plain}>
                <thead>
                  <tr>
                    <th scope="col">날짜</th>
                    <th scope="col" className={styles.num}>방문 수</th>
                    <th scope="col" className={styles.num}>방문자 수</th>
                    <th scope="col" className={styles.num}>처음 온 방문자</th>
                    <th scope="col" className={styles.num}>페이지뷰</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days].reverse().map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{formatDay(day.date)}</th>
                      <td className={styles.num}>{formatCount(day.visits)}</td>
                      <td className={styles.num}>{formatCount(day.visitors)}</td>
                      <td className={styles.num}>{formatCount(day.newVisitors)}</td>
                      <td className={styles.num}>{formatCount(day.pageViews)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}

      <div className={styles.columns}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>시간대별 방문</h2>
          <p className={styles.cardNote}>방문이 시작된 시각 기준 (한국 시간)</p>
          <ColumnChart items={hours} labelEvery={3} unit="방문" ariaLabel="시간대별 방문 수 그래프" />
        </section>
        {days.length >= 14 ? (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>요일별 평균 방문</h2>
            <p className={styles.cardNote}>하루 평균 방문 수</p>
            <ColumnChart items={weekdays} unit="방문 (하루 평균)" ariaLabel="요일별 하루 평균 방문 수 그래프" decimals />
          </section>
        ) : (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>방문자 구성</h2>
            <dl className={styles.facts}>
              <div><dt>처음 온 방문자</dt><dd>{formatCount(total.newVisitors)}</dd></div>
              <div><dt>다시 온 방문자</dt><dd>{formatCount(Math.max(0, total.visitors - total.newVisitors))}</dd></div>
            </dl>
            <p className={styles.cardNote}>요일별 평균은 14일 이상의 기간에서 볼 수 있습니다.</p>
          </section>
        )}
      </div>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>기기</h2>
        {total.visits > 0 ? (
          <>
            <ShareBar parts={devices} unit="회" />
            <table className={styles.plain}>
              <thead>
                <tr>
                  <th scope="col">기기</th>
                  <th scope="col" className={styles.num}>방문 수</th>
                  <th scope="col" className={styles.num}>비율</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.key}>
                    <th scope="row"><span className={styles.dot} style={{ background: device.color }} />{device.label}</th>
                    <td className={styles.num}>{formatCount(device.value)}</td>
                    <td className={styles.num}>{percent(device.value, total.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className={styles.cardEmpty}>이 기간에는 기록이 없습니다.</p>
        )}
      </section>

      <div className={styles.columns}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>많이 본 페이지</h2>
          <RankTable rows={pages} total={total.pageViews} nameHead="페이지" valueHead="페이지뷰" />
        </section>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>처음 들어온 페이지</h2>
          <RankTable rows={landings} total={total.visits} nameHead="페이지" valueHead="방문 수" limit={8} />
        </section>
      </div>

      <p className={styles.footnote}>
        방문 수는 30분 넘게 쉬었다가 다시 오면 새로 셉니다. 방문자 수는 브라우저를 하루 단위로 센 값의 합이라, 같은 사람이 이틀 오면 2로 셉니다.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// 접속 경로
// ---------------------------------------------------------------------------

function channelRows(total: DayStats) {
  return ranked(total.channels).map(([key, visits]) => {
    const info = channelInfo(key);
    return {
      key,
      label: info.label,
      group: info.group,
      visits,
      estimates: total.stepChannels.estimate?.[key] ?? 0,
      inquiries: total.stepChannels.inquiry?.[key] ?? 0,
    };
  });
}

function ChannelTable({ total }: { total: DayStats }) {
  const rows = channelRows(total);
  const max = Math.max(1, ...rows.map((row) => row.visits));
  if (rows.length === 0) return <p className={styles.cardEmpty}>이 기간에는 기록이 없습니다.</p>;

  return (
    <div className={styles.tableWide}>
      <table className={styles.rank}>
        <thead>
          <tr>
            <th scope="col">접속 경로</th>
            <th scope="col" className={styles.num}>방문 수</th>
            <th scope="col" className={styles.num}>비율</th>
            <th scope="col" className={styles.num}>견적 계산</th>
            <th scope="col" className={styles.num}>견적 문의</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                <span className={styles.rankName}>
                  <span className={styles.dot} style={{ background: GROUP_COLORS[row.group] }} />
                  {row.label}
                  <span className={styles.rankSub}>{GROUP_LABELS[row.group]}</span>
                </span>
                <span className={styles.meter}>
                  <span className={styles.meterFill} style={{ width: `${(row.visits / max) * 100}%` }} />
                </span>
              </th>
              <td className={styles.num}>{formatCount(row.visits)}</td>
              <td className={styles.num}>{percent(row.visits, total.visits)}</td>
              <td className={styles.num}>{formatCount(row.estimates)}</td>
              <td className={styles.num}>{formatCount(row.inquiries)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChannelsView({ total, onOpenLinks }: { total: DayStats; onOpenLinks: () => void }) {
  const groups = GROUP_ORDER.map((group) => ({
    key: group,
    label: GROUP_LABELS[group],
    color: GROUP_COLORS[group],
    value: Object.entries(total.channels).reduce((sum, [key, count]) => sum + (channelInfo(key).group === group ? count : 0), 0),
  }));

  const campaigns = ranked(total.campaigns).map(([key, visits]) => {
    const [channel, ...name] = key.split('|');
    return {
      key,
      channel: channelInfo(channel).label,
      name: name.join('|'),
      visits,
      estimates: total.stepCampaigns.estimate?.[key] ?? 0,
      inquiries: total.stepCampaigns.inquiry?.[key] ?? 0,
    };
  });

  const keywords = ranked(total.keywords).map(([key, value]) => ({ key, name: key, value }));
  const referrers = ranked(total.referrers).map(([key, value]) => ({ key, name: key, value }));
  const keywordTotal = keywords.reduce((sum, row) => sum + row.value, 0);
  const referrerTotal = referrers.reduce((sum, row) => sum + row.value, 0);

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>어디서 들어왔나</h2>
        <p className={styles.cardNote}>방문 {formatCount(total.visits)}회를 들어온 경로로 나눈 것입니다. 견적 계산 · 견적 문의는 그 경로로 온 방문 중 거기까지 간 수입니다.</p>
        <ShareBar parts={groups} unit="회" />
        <ChannelTable total={total} />
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>광고 · 링크별</h2>
        <p className={styles.cardNote}>꼬리표에 이름을 붙인 링크로 들어온 방문입니다.</p>
        {campaigns.length === 0 ? (
          <div className={styles.cardEmpty}>
            <p>이 기간에는 이름 붙인 링크로 들어온 방문이 없습니다.</p>
            <button type="button" className={styles.textBtn} onClick={onOpenLinks}>광고 링크 만들기로 가기</button>
          </div>
        ) : (
          <div className={styles.tableWide}>
            <table className={styles.plain}>
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">접속 경로</th>
                  <th scope="col" className={styles.num}>방문 수</th>
                  <th scope="col" className={styles.num}>견적 계산</th>
                  <th scope="col" className={styles.num}>견적 문의</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.name}</th>
                    <td>{row.channel}</td>
                    <td className={styles.num}>{formatCount(row.visits)}</td>
                    <td className={styles.num}>{formatCount(row.estimates)}</td>
                    <td className={styles.num}>{formatCount(row.inquiries)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={styles.columns}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>광고 검색어</h2>
          <p className={styles.cardNote}>광고가 알려 준 검색어만 나옵니다. 일반 검색의 검색어는 검색 사이트가 넘겨주지 않습니다.</p>
          <RankTable rows={keywords} total={keywordTotal} nameHead="검색어" valueHead="방문 수" limit={15} />
        </section>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>기타 사이트</h2>
          <p className={styles.cardNote}>&lsquo;기타 사이트&rsquo;로 묶인 방문이 넘어온 곳입니다.</p>
          <RankTable rows={referrers} total={referrerTotal} nameHead="사이트" valueHead="방문 수" limit={15} />
        </section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 견적 흐름
// ---------------------------------------------------------------------------

function FunnelView({ total }: { total: DayStats }) {
  const steps = QUOTE_STEPS.map((step) => ({ step, label: QUOTE_STEP_LABELS[step], value: total.funnel[step] ?? 0 }));
  const first = steps[0].value;
  const withGoals = channelRows(total).filter((row) => row.estimates > 0 || row.inquiries > 0);

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>견적 페이지에서 어디까지 가는가</h2>
        <p className={styles.cardNote}>방문 한 번에 각 단계는 한 번만 셉니다. 저장과 문의는 로그인이 필요한 단계입니다.</p>
        {first === 0 ? (
          <p className={styles.cardEmpty}>이 기간에는 견적 페이지 방문 기록이 없습니다.</p>
        ) : (
          <ol className={styles.funnel}>
            {steps.map((item, index) => {
              const before = index > 0 ? steps[index - 1].value : null;
              return (
                <li key={item.step} className={styles.funnelRow}>
                  <span className={styles.funnelLabel}>
                    <span className={styles.funnelIndex}>{index + 1}</span>
                    {item.label}
                  </span>
                  <span className={styles.funnelTrack}>
                    <span className={styles.funnelFill} style={{ width: `${(item.value / first) * 100}%` }} />
                  </span>
                  <span className={styles.funnelValue}>{formatCount(item.value)}</span>
                  <span className={styles.funnelRate}>
                    {before === null ? '시작' : `앞 단계의 ${percent(item.value, before)}`}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>경로별 견적 · 문의</h2>
        <p className={styles.cardNote}>어느 경로로 온 방문이 견적 계산과 문의까지 갔는지입니다.</p>
        {withGoals.length === 0 ? (
          <p className={styles.cardEmpty}>이 기간에는 견적 계산이나 문의까지 간 방문이 없습니다.</p>
        ) : (
          <div className={styles.tableWide}>
            <table className={styles.plain}>
              <thead>
                <tr>
                  <th scope="col">접속 경로</th>
                  <th scope="col" className={styles.num}>방문 수</th>
                  <th scope="col" className={styles.num}>견적 계산</th>
                  <th scope="col" className={styles.num}>계산까지 간 비율</th>
                  <th scope="col" className={styles.num}>견적 문의</th>
                </tr>
              </thead>
              <tbody>
                {withGoals.map((row) => (
                  <tr key={row.key}>
                    <th scope="row"><span className={styles.dot} style={{ background: GROUP_COLORS[row.group] }} />{row.label}</th>
                    <td className={styles.num}>{formatCount(row.visits)}</td>
                    <td className={styles.num}>{formatCount(row.estimates)}</td>
                    <td className={styles.num}>{percent(row.estimates, row.visits)}</td>
                    <td className={styles.num}>{formatCount(row.inquiries)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// 광고 링크 만들기 + 설정
// ---------------------------------------------------------------------------

const LANDING_PAGES = ['/', '/quote', '/store', '/portfolio', '/contact', '/cliker', '/shapecliker'];
const CUSTOM = 'custom';

function LinksView() {
  const [presetId, setPresetId] = useState(LINK_PRESETS[0].id);
  const [customSource, setCustomSource] = useState('');
  const [customPaid, setCustomPaid] = useState(false);
  const [path, setPath] = useState('/');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);
  // 이 화면은 로그인 확인이 끝난 뒤 브라우저에서만 그려지므로 저장소를 바로 읽어도 된다
  const [excluded, setExcluded] = useState(() => isOptedOut());

  const preset = LINK_PRESETS.find((item) => item.id === presetId);
  const source = preset ? preset.source : customSource.trim();
  const medium = preset ? preset.medium : customPaid ? 'ad' : 'link';
  const url = source ? buildTaggedUrl(path, source, medium, campaign) : '';
  // 통계가 이 주소를 실제로 어떻게 읽는지 그대로 보여 준다
  const reads = url ? classifyVisit({ search: new URL(url).search, referrer: '', userAgent: '', ownHosts: [] }) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>광고 링크 만들기</h2>
        <p className={styles.cardNote}>
          광고나 게시물에 넣을 주소를 여기서 만들어 쓰면, 그 링크로 들어온 방문이 접속 경로에 따로 집계됩니다. 손님에게는 같은 페이지가 열립니다.
        </p>

        <div className={styles.field}>
          <p className={styles.fieldLabel} id="link-where">어디에 쓸 링크인가요</p>
          <div className={styles.chips} role="group" aria-labelledby="link-where">
            {LINK_PRESETS.map((item) => (
              <button key={item.id} type="button" className={`${styles.chip} ${presetId === item.id ? styles.chipActive : ''}`} aria-pressed={presetId === item.id} onClick={() => setPresetId(item.id)}>
                {item.label}
              </button>
            ))}
            <button type="button" className={`${styles.chip} ${presetId === CUSTOM ? styles.chipActive : ''}`} aria-pressed={presetId === CUSTOM} onClick={() => setPresetId(CUSTOM)}>
              직접 입력
            </button>
          </div>
          {presetId === CUSTOM && (
            <div className={styles.inline}>
              <input
                className={styles.input}
                type="text"
                placeholder="예: 전단지, 당근마켓"
                aria-label="통계에 보일 이름"
                maxLength={24}
                value={customSource}
                onChange={(event) => setCustomSource(event.target.value)}
              />
              <label className={styles.check}>
                <input type="checkbox" checked={customPaid} onChange={(event) => setCustomPaid(event.target.checked)} />
                돈을 내는 광고
              </label>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <p className={styles.fieldLabel} id="link-page">눌렀을 때 열릴 페이지</p>
          <div className={styles.chips} role="group" aria-labelledby="link-page">
            {LANDING_PAGES.map((item) => (
              <button key={item} type="button" className={`${styles.chip} ${path === item ? styles.chipActive : ''}`} aria-pressed={path === item} onClick={() => setPath(item)}>
                {pageLabel(item)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="link-name">광고 이름 (선택)</label>
          <input
            id="link-name"
            className={styles.input}
            type="text"
            placeholder="예: 11월 행사"
            maxLength={40}
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
          />
          <p className={styles.fieldHelp}>이름을 붙이면 같은 인스타 광고라도 광고마다 따로 볼 수 있습니다.</p>
        </div>

        <div className={styles.result}>
          {url ? (
            <>
              <p className={styles.resultUrl}>{url}</p>
              <div className={styles.resultRow}>
                <p className={styles.resultReads}>
                  통계에는 <strong>{reads ? channelInfo(reads.channel).label : ''}</strong>
                  {reads?.campaign ? <> · <strong>{reads.campaign}</strong></> : null}
                  {' '}(으)로 집계됩니다.
                </p>
                <button type="button" className={styles.primaryBtn} onClick={copy}>
                  {copied ? '복사했습니다' : '주소 복사'}
                </button>
              </div>
            </>
          ) : (
            <p className={styles.cardEmpty}>통계에 보일 이름을 입력하면 주소가 만들어집니다.</p>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>알아 두면 좋은 것</h2>
        <ul className={styles.notes}>
          <li>네이버 검색광고는 광고 관리 화면에서 &lsquo;자동 추적&rsquo;을 켜 두면 꼬리표 없이도 &lsquo;네이버 광고&rsquo;로 집계되고, 광고 검색어도 함께 기록됩니다.</li>
          <li>구글 광고는 자동 태그(gclid)가 붙어 있으면 꼬리표 없이도 &lsquo;구글 광고&rsquo;로 집계됩니다.</li>
          <li>인스타 광고는 꼬리표가 없으면 일반 &lsquo;인스타그램&rsquo; 방문과 구분되지 않습니다. 위에서 만든 주소를 광고에 넣어 주세요.</li>
          <li>카카오톡으로 받은 링크나 주소를 직접 친 방문은 넘어온 곳을 알 수 없어 &lsquo;직접 접속&rsquo;으로 집계됩니다.</li>
          <li>이름, 연락처, IP 같은 개인 정보는 저장하지 않고 날짜별 합계만 저장합니다.</li>
        </ul>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>이 브라우저의 방문</h2>
        <p className={styles.cardNote}>
          관리자로 로그인한 동안의 방문은 원래 세지 않습니다. 로그아웃한 상태로 사이트를 자주 여는 사무실 컴퓨터라면 아래를 켜 두세요.
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={excluded}
            onChange={(event) => {
              setOptedOut(event.target.checked);
              setExcluded(isOptedOut());
            }}
          />
          이 브라우저의 방문은 통계에서 제외
        </label>
      </section>
    </>
  );
}
