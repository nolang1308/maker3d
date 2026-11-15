'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import styles from './charts.module.scss';

// 그래프 색. 묶음 색 네 가지는 색각 이상에서도 이웃끼리 구분되는지 확인한 조합이다
export const CHART_COLORS = {
  blue: '#2493D8',
  orange: '#eb6834',
  aqua: '#1baf7a',
  yellow: '#eda100',
  gray: '#9aa3af',
} as const;

const GRID = '#eceff3';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const formatCount = (value: number) => Math.round(value).toLocaleString('ko-KR');

export function formatDay(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// 세로축 눈금: 0 부터 깔끔한 수까지, 4~5칸
function axisTicks(max: number): number[] {
  if (max <= 4) return [0, 1, 2, 3, 4];
  const power = 10 ** Math.floor(Math.log10(max));
  const unit = max / power;
  const top = (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
  const step = top % 4 === 0 ? top / 4 : top / 5;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value);
  return ticks;
}

const axisLabel = (value: number, top: number) => (top >= 10000 ? `${value / 1000}K` : formatCount(value));

// ---------------------------------------------------------------------------
// 날짜별 추이 (선 그래프)
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: string;
  visits: number;
  visitors: number;
  pageViews: number;
}

const TREND_SERIES = [
  { key: 'visits', label: '방문 수', color: CHART_COLORS.blue },
  { key: 'pageViews', label: '페이지뷰', color: CHART_COLORS.orange },
] as const;

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = 280;
  const margin = { top: 16, right: 84, bottom: 30, left: 48 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const count = points.length;

  const ticks = axisTicks(Math.max(1, ...points.map((point) => Math.max(point.visits, point.pageViews))));
  const top = ticks[ticks.length - 1];
  const x = (index: number) => margin.left + (count <= 1 ? innerWidth / 2 : (innerWidth * index) / (count - 1));
  const y = (value: number) => margin.top + innerHeight - (innerHeight * value) / top;
  const line = (key: 'visits' | 'pageViews') => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ');

  // 가로축 날짜는 여섯 개쯤만, 마지막 날에 맞춰서 적는다
  const labelStep = Math.max(1, Math.ceil(count / 6));
  const last = count - 1;
  const lastPoint = points[last];
  // 끝 이름표가 서로 겹칠 만큼 가까우면 적지 않고 위쪽 범례에 맡긴다
  const endLabels = !!lastPoint && Math.abs(y(lastPoint.visits) - y(lastPoint.pageViews)) >= 16;

  const moveTo = (event: PointerEvent<SVGSVGElement>) => {
    if (count === 0 || innerWidth <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - margin.left) / innerWidth;
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const from = active ?? last;
    setActive(Math.min(last, Math.max(0, from + (event.key === 'ArrowRight' ? 1 : -1))));
  };

  const activePoint = active !== null ? points[active] : null;
  const tipOnLeft = active !== null && x(active) > width * 0.6;

  return (
    <div className={styles.chart}>
      <ul className={styles.legend}>
        {TREND_SERIES.map((series) => (
          <li key={series.key}>
            <span className={styles.lineKey} style={{ background: series.color }} />
            {series.label}
          </li>
        ))}
      </ul>
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label="날짜별 방문 수와 페이지뷰 그래프. 좌우 화살표로 날짜를 옮겨 값을 볼 수 있습니다."
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? last)}
        onBlur={() => setActive(null)}
      >
        {width > 0 && count > 0 && (
          <svg width={width} height={height} onPointerMove={moveTo} onPointerLeave={() => setActive(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
                <text x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className={styles.axisText}>{axisLabel(tick, top)}</text>
              </g>
            ))}
            {points.map((point, index) => ((last - index) % labelStep === 0 ? (
              <text key={point.date} x={x(index)} y={height - 8} textAnchor="middle" className={styles.axisText}>
                {`${Number(point.date.slice(5, 7))}.${Number(point.date.slice(8, 10))}`}
              </text>
            ) : null))}

            {count > 1 && (
              <path
                d={`${line('visits')} L${x(last).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`}
                fill={CHART_COLORS.blue}
                opacity={0.1}
              />
            )}
            {[...TREND_SERIES].reverse().map((series) => (
              <path key={series.key} d={line(series.key)} fill="none" stroke={series.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {lastPoint && TREND_SERIES.map((series) => (
              <g key={series.key}>
                <circle cx={x(last)} cy={y(lastPoint[series.key])} r={4} fill={series.color} stroke="#ffffff" strokeWidth={2} />
                {endLabels && (
                  <text x={x(last) + 10} y={y(lastPoint[series.key])} dy="0.32em" className={styles.endLabel}>{series.label}</text>
                )}
              </g>
            ))}

            {activePoint && active !== null && (
              <g pointerEvents="none">
                <line x1={x(active)} x2={x(active)} y1={margin.top} y2={margin.top + innerHeight} stroke="#9aa3af" strokeWidth={1} />
                {TREND_SERIES.map((series) => (
                  <circle key={series.key} cx={x(active)} cy={y(activePoint[series.key])} r={4.5} fill={series.color} stroke="#ffffff" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}

        {activePoint && active !== null && (
          <div
            className={styles.tooltip}
            style={tipOnLeft ? { right: width - x(active) + 12, top: margin.top } : { left: x(active) + 12, top: margin.top }}
            role="status"
          >
            <p className={styles.tipTitle}>{formatDay(activePoint.date)}</p>
            {TREND_SERIES.map((series) => (
              <p key={series.key} className={styles.tipRow}>
                <span className={styles.lineKey} style={{ background: series.color }} />
                <strong>{formatCount(activePoint[series.key])}</strong>
                <span>{series.label}</span>
              </p>
            ))}
            <p className={styles.tipRow}>
              <span className={styles.lineKeyBlank} />
              <strong>{formatCount(activePoint.visitors)}</strong>
              <span>방문자 수</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 세로 막대 (시간대 · 요일)
// ---------------------------------------------------------------------------

export interface ColumnItem {
  /** 가로축에 적는 짧은 이름 */
  label: string;
  /** 말풍선에 적는 이름 */
  name: string;
  value: number;
}

interface ColumnChartProps {
  items: ColumnItem[];
  /** 가로축 이름을 몇 칸마다 적을지 */
  labelEvery?: number;
  unit: string;
  ariaLabel: string;
  /** 소수 값(평균)이면 말풍선에 한 자리까지 적는다 */
  decimals?: boolean;
}

export function ColumnChart({ items, labelEvery = 1, unit, ariaLabel, decimals = false }: ColumnChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const height = 210;
  const margin = { top: 12, right: 8, bottom: 28, left: 40 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const band = items.length > 0 ? innerWidth / items.length : 0;
  // 막대는 24px 를 넘기지 않고, 이웃 막대와는 2px 이상 띄운다
  const barWidth = Math.max(2, Math.min(24, band - 2));

  const ticks = axisTicks(Math.max(1, ...items.map((item) => item.value)));
  const top = ticks[ticks.length - 1];
  const y = (value: number) => margin.top + innerHeight - (innerHeight * value) / top;
  const valueText = (value: number) => (decimals ? (Math.round(value * 10) / 10).toLocaleString('ko-KR') : formatCount(value));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const from = active ?? 0;
    setActive(Math.min(items.length - 1, Math.max(0, from + (event.key === 'ArrowRight' ? 1 : -1))));
  };

  const activeItem = active !== null ? items[active] : null;
  const activeX = active !== null ? margin.left + band * active + band / 2 : 0;

  return (
    <div className={styles.chart}>
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel}. 좌우 화살표로 옮겨 값을 볼 수 있습니다.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? 0)}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} onPointerLeave={() => setActive(null)}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
                <text x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className={styles.axisText}>{axisLabel(tick, top)}</text>
              </g>
            ))}
            {items.map((item, index) => {
              const left = margin.left + band * index + (band - barWidth) / 2;
              const barTop = y(item.value);
              const barHeight = margin.top + innerHeight - barTop;
              const radius = Math.min(4, barWidth / 2, barHeight);
              return (
                <g key={item.name}>
                  {barHeight > 0 && (
                    <path
                      d={`M${left},${barTop + barHeight} V${barTop + radius} Q${left},${barTop} ${left + radius},${barTop} H${left + barWidth - radius} Q${left + barWidth},${barTop} ${left + barWidth},${barTop + radius} V${barTop + barHeight} Z`}
                      fill={CHART_COLORS.blue}
                      opacity={active === null || active === index ? 1 : 0.45}
                    />
                  )}
                  {index % labelEvery === 0 && (
                    <text x={margin.left + band * index + band / 2} y={height - 8} textAnchor="middle" className={styles.axisText}>{item.label}</text>
                  )}
                  {/* 막대보다 넓은 자리 전체가 마우스를 받는다 */}
                  <rect
                    x={margin.left + band * index}
                    y={margin.top}
                    width={band}
                    height={innerHeight}
                    fill="transparent"
                    onPointerMove={() => setActive(index)}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {activeItem && (
          <div
            className={styles.tooltip}
            style={activeX > width * 0.6 ? { right: width - activeX + 12, top: margin.top } : { left: activeX + 12, top: margin.top }}
            role="status"
          >
            <p className={styles.tipTitle}>{activeItem.name}</p>
            <p className={styles.tipRow}>
              <strong>{valueText(activeItem.value)}</strong>
              <span>{unit}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 전체를 몫으로 나눈 띠
// ---------------------------------------------------------------------------

export interface SharePart {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function ShareBar({ parts, unit }: { parts: SharePart[]; unit: string }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const shown = parts.filter((part) => part.value > 0);
  if (total === 0) return null;

  const summary = shown.map((part) => `${part.label} ${formatCount(part.value)}${unit} ${Math.round((part.value / total) * 100)}%`).join(', ');

  return (
    <div className={styles.share}>
      <div className={styles.shareBar} role="img" aria-label={summary}>
        {shown.map((part) => {
          const percent = (part.value / total) * 100;
          return (
            <span
              key={part.key}
              className={styles.shareBlock}
              style={{ flexGrow: part.value, background: part.color }}
              title={`${part.label}: ${formatCount(part.value)}${unit} (${Math.round(percent)}%)`}
            >
              {/* 자리가 좁으면 숫자를 적지 않는다 (아래 표에 있다) */}
              {percent >= 9 && <span className={styles.shareValue}>{Math.round(percent)}%</span>}
            </span>
          );
        })}
      </div>
      <ul className={styles.legend}>
        {shown.map((part) => (
          <li key={part.key}>
            <span className={styles.boxKey} style={{ background: part.color }} />
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
