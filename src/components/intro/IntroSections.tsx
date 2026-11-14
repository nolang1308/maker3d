'use client';

import { useRef } from 'react';
import type { CSSProperties } from 'react';
import styles from './IntroSections.module.scss';
import Reveal from '../Reveal';
import { useParallax } from '../useParallax';
import { BITTECH_LOGO, COMPANY_LABEL, HERO_LETTERS, HERO_MARK, MAKER_LOGO, SERVICE_LABEL, SERVICE_TITLE } from './introArt';

/**
 * 회사 소개 페이지에서 예전에 그림 파일이던 구역들을 코드로 다시 만든 것.
 *  - 대표 로고 (public/introLogo.svg)
 *  - 성장 그래프와 강점 카드 (public/graph.svg, graphInfo.svg)
 *  - 회사 구조 · 서비스 도식 · 목표 (public/introPhoto3.svg)
 * 글자는 진짜 글자로 썼고(원본 그림에서 잰 크기 · 위치 그대로), 화면에 들어올 때의 움직임을 넣었다.
 * 도형의 좌표는 원본 그림의 좌표를 그대로 쓴다: 그래프는 1991 × 905, 도식은 가로 1920 기준.
 */

// ---------------------------------------------------------------------------
// 대표 로고: WE'RE MAKER 3D
// ---------------------------------------------------------------------------

export function IntroHero() {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);

  return (
    <div ref={ref} className={styles.hero}>
      <svg className={styles.heroSvg} viewBox="0 0 1364 650" role="img" aria-label="WE'RE MAKER 3D">
        <defs>
          <linearGradient id="intro-hero-grad" x1="358" y1="325" x2="1077.6" y2="325" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1480F9" />
            <stop offset="1" stopColor="#6CEA42" />
            {/* 파랑에서 초록으로 가는 색이 천천히 좌우로 흐른다 */}
            <animateTransform attributeName="gradientTransform" type="translate" values="-170 0; 170 0; -170 0" dur="9s" repeatCount="indefinite" />
          </linearGradient>
        </defs>
        {/* 물방울 표시: 마우스 반대쪽으로 조금 움직이고(깊이감), 천천히 떠 있다 */}
        <g className={styles.heroMarkDepth}>
          <g className={styles.heroMarkFloat}>
            <path className={styles.heroMark} d={HERO_MARK} fill="url(#intro-hero-grad)" />
          </g>
        </g>
        {/* 픽셀 글씨: 한 글자씩 떨어져 내려앉고, 이따금 물결치듯 튀어 오른다 */}
        <g className={styles.heroTextDepth}>
          {HERO_LETTERS.map((letter, i) => (
            <g key={letter.x} className={styles.heroLetterHop} style={{ '--i': i } as CSSProperties}>
              <path className={styles.heroLetter} d={letter.d} fill="#28313A" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 성장 그래프 + 강점 카드
// ---------------------------------------------------------------------------

const GRAPH_CURVE = 'M26 862.409C1058.03 870.89 1322.15 155.202 1976 121.91';
const GRAPH_AREA = 'M1989 117.91C1315.89 151.663 1062.37 872.024 23.5 863.409V904.91H1989C1989 904.91 1989 498.377 1989 117.91Z';

/** 강점 카드: [앞 글, 형광펜으로 칠한 글, 뒤 글] 한 줄씩 */
const GROWTH_CARDS: [string, string, string][][] = [
  [
    ['최대출력 사이즈 ', '360*360*360(mm)', ''],
    ['(초과사이즈는 분할 출력 가능)', '', ''],
  ],
  [
    ['', '적층제조에 최적화된', ' 설계 및 솔루션으로'],
    ['높은 품질의 3D프린팅 서비스', '', ''],
  ],
  [
    ['', '자동견적시스템', '을 통한 24시간 실시간 견적과'],
    ['2시간 이내 받을 수 있는 확정 견적', '', ''],
  ],
  [
    ['', '편리한 맞춤형 상담', '을 통해'],
    ['3D프린팅 초보자도 쉽게 문의 가능', '', ''],
    ['(공휴일 문의 가능)', '', ''],
  ],
];

export function GrowthSection() {
  return (
    <section className={styles.growth}>
      {/* 그래프: 곡선이 왼쪽에서 오른쪽으로 그어지고, 점이 곡선을 타고 올라가 Maker 3D 자리에 선다 */}
      <Reveal plain className={styles.graph}>
        <svg className={styles.graphSvg} viewBox="0 0 1991 905" aria-hidden="true">
          <defs>
            <linearGradient id="intro-graph-area" x1="0" y1="14.5" x2="0" y2="893.9" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2493D8" />
              <stop offset="1" stopColor="#2493D8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="intro-graph-line" x1="44.5" y1="0" x2="1996" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#222222" />
              <stop offset="0.79" stopColor="#2493D8" />
            </linearGradient>
            <filter id="intro-graph-shadow" x="0" y="100" width="1991" height="805" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="11.7" stdDeviation="5.9" floodColor="#000" floodOpacity="0.25" />
            </filter>
            <filter id="intro-graph-pill" x="1520" y="-10" width="430" height="170" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="4.6" stdDeviation="5.76" floodColor="#5d76ea" floodOpacity="0.5" />
            </filter>
            {/* 곡선 아래 면: 곡선이 그어진 데까지만 보인다 */}
            <clipPath id="intro-graph-reveal">
              <rect className={styles.graphRevealRect} x="0" y="0" width="1991" height="905" />
            </clipPath>
          </defs>

          <g clipPath="url(#intro-graph-reveal)">
            <path d={GRAPH_AREA} fill="url(#intro-graph-area)" fillOpacity="0.3" />
          </g>
          <g filter="url(#intro-graph-shadow)">
            <path className={styles.graphCurve} d={GRAPH_CURVE} pathLength={1} fill="none" stroke="url(#intro-graph-line)" strokeWidth="5" strokeLinecap="round" />
          </g>

          {/* 다른 곳 */}
          <g className={styles.graphOthers}>
            <rect x="133" y="745.91" width="174.73" height="59.37" rx="29.68" fill="#929292" />
            <path d="M222.17 815.45C221.45 816.98 219.28 816.98 218.56 815.45L213.92 805.64C213.29 804.31 214.26 802.78 215.73 802.78H225C226.47 802.78 227.43 804.31 226.81 805.64L222.17 815.45Z" fill="#929292" />
            <text className={styles.graphText} x="220.4" y="786" textAnchor="middle" fontSize="29.2" fontWeight="400" fill="#fff">
              others
            </text>
            <circle cx="220.855" cy="852.816" r="23.48" fill="#fff" stroke="#929292" strokeWidth="5.87" />
          </g>

          {/* 곡선을 타고 올라가는 점 */}
          <circle className={styles.graphTraveler} r="15" fill="#2493D8" stroke="#fff" strokeWidth="5" />

          {/* Maker 3D */}
          <circle className={styles.graphRipple} cx="1733.86" cy="164.97" r="23.48" fill="none" stroke="#2493D8" strokeWidth="4" />
          <circle className={styles.graphMakerDot} cx="1733.86" cy="164.97" r="23.48" fill="#2493D8" stroke="#fff" strokeWidth="5.87" />
          <g className={styles.graphMakerPill}>
            <g filter="url(#intro-graph-pill)">
              <rect x="1547" y="6.91" width="371.32" height="100.2" rx="50.1" fill="#fff" />
              <path d="M1735.72 124.3C1734.5 126.88 1730.83 126.88 1729.61 124.3L1721.77 107.71C1720.71 105.46 1722.35 102.88 1724.83 102.88H1740.5C1742.98 102.88 1744.62 105.46 1743.56 107.71L1735.72 124.3Z" fill="#fff" />
            </g>
            <text className={styles.graphText} x="1732.7" y="74.5" textAnchor="middle" fontSize="48.3" fontWeight="700" fill="#2493D8">
              Maker 3D
            </text>
          </g>
        </svg>
      </Reveal>

      <div className={styles.growthInfo}>
        <Reveal>
          <h2 className={styles.growthTitle}>
            <span>당신의 상상력을 통해 메이커3D는 형상을 만들어냅니다. </span>
            <span>3D프린팅 전문가와 함께 만들어 나가는 공간 </span>
            <span>MAKER 3D가 함께합니다.</span>
          </h2>
        </Reveal>
        <div className={styles.growthCards}>
          {GROWTH_CARDS.map((lines, i) => (
            <Reveal key={i} delay={0.12 + i * 0.12} className={styles.growthCardSlot}>
              <article className={styles.growthCard}>
                <p>
                  {lines.map(([before, marked, after], j) => (
                    <span key={j} className={styles.growthLine}>
                      {before}
                      {marked && <mark className={styles.marker}>{marked}</mark>}
                      {after}{' '}
                    </span>
                  ))}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 회사 구조 · 서비스 · 목표 (가로 1920 기준 도식)
// ---------------------------------------------------------------------------

const MODEL_CIRCLES = [
  { key: 'maker', lines: ['3D프린팅 제품 생산', '3D설계', '제품디자인', '아이디어 상품 제작', '3D프린팅 교육 및 체험'] },
  { key: 'bit', lines: ['자동화생산라인 설비', '3D프린팅 소재 개발', '친환경 필라멘트 제조', '(업사이클링)'] },
  { key: 'cafe', lines: ['3D프린팅 카페', '오픈예정'] },
];

const VISION_LINES = [
  '메이커3D는 3D프린팅이 누구나 쉽게 활용될 수 있는 바램으로',
  '매년 3D프린팅 전시회와 스토어에서 제작된 상품을 전시 및 판매하여',
  '일반인들이 3D프린팅 기술과 아이디어 상품을 통해 새로운 아이디어를 끌어내고',
  '우리의 일상 속에서 더욱 친숙하고 의미 있게 다가가도록 하는 것이 목표입니다.',
];

/** 목표 문단 둘레에 흩어진 점: [x, y, 반지름] (원본 좌표, y 는 문단 구역의 위쪽 기준) */
const VISION_DOTS: [number, number, number][] = [
  [471.74, 301.56, 9.13],
  [1603, 296.09, 3.65],
  [199.65, 230.35, 3.65],
  [1119.09, 314.35, 3.65],
  [1721.69, 145.44, 1.83],
  [652.52, 260.48, 1.83],
  [1017.74, 67.83, 1.83],
];

function ArtLabel({ art, className }: { art: { viewBox: string; d: string }; className: string }) {
  return (
    <svg className={className} viewBox={art.viewBox} aria-hidden="true">
      <path d={art.d} fill="#0A0A0A" />
    </svg>
  );
}

export function CompanyModel() {
  return (
    <Reveal plain className={`${styles.block} ${styles.model}`}>
      <div className={styles.modelGlow} aria-hidden="true" />
      <h2 className={styles.modelLabel}>
        <span className={styles.srOnly}>company model</span>
        <ArtLabel art={COMPANY_LABEL} className={styles.labelArt} />
      </h2>

      <div className={styles.bitCircle}>
        <svg className={styles.bitLogo} viewBox={BITTECH_LOGO.viewBox} role="img" aria-label="BIT TECH">
          {BITTECH_LOGO.letters.map((d, i) => (
            <path key={i} d={d} fill="#151515" />
          ))}
          <g dangerouslySetInnerHTML={{ __html: BITTECH_LOGO.markMarkup }} />
        </svg>
      </div>

      <svg className={styles.makerLogo} viewBox={MAKER_LOGO.viewBox} role="img" aria-label="MAKER 3D">
        <defs>
          <linearGradient id="intro-maker-mark" x1="263" y1="466.29" x2="318.87" y2="466.29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1480F9" />
            <stop offset="1" stopColor="#6CEA42" />
          </linearGradient>
        </defs>
        <path d={MAKER_LOGO.mark} fill="url(#intro-maker-mark)" />
        {MAKER_LOGO.letters.map((d, i) => (
          <path key={i} d={d} fill="#000" />
        ))}
      </svg>

      {MODEL_CIRCLES.map((circle, i) => (
        <div key={circle.key} className={`${styles.modelCircle} ${styles[`modelCircle_${circle.key}`]}`} style={{ '--n': i } as CSSProperties}>
          <svg className={styles.modelArrow} viewBox="0 0 44 50" aria-hidden="true">
            <path d="M22 1V43M0.5 26.5L22 48L43.5 26.5" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="square" />
          </svg>
          <p className={styles.modelText}>
            {circle.lines.map((line, j) => (
              <span key={line} style={{ '--l': j } as CSSProperties}>
                {line}
              </span>
            ))}
          </p>
        </div>
      ))}
    </Reveal>
  );
}

export function ServiceSection() {
  return (
    <Reveal plain className={`${styles.block} ${styles.service}`}>
      <h2 className={styles.serviceHead}>
        <span className={styles.srOnly}>service — Make Your Idea Product. With 3D Printing</span>
        <ArtLabel art={SERVICE_LABEL} className={styles.serviceLabel} />
        <ArtLabel art={SERVICE_TITLE} className={styles.serviceTitle} />
      </h2>
      <p className={styles.serviceLead}>3D프린팅 기술을 활용하여 대중화를 목표로 하며, 다양한 산업과 협업을 통한 아이디어 상품 제작합니다.</p>

      {/* 결과물에서 바깥으로 번져 나가는 고리 */}
      <div className={styles.rings} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`${styles.ring} ${styles[`ring${i}`]}`} />
        ))}
      </div>

      <svg className={styles.dotted} viewBox="0 0 1312 470" aria-hidden="true">
        <rect x="0.75" y="0.75" width="1310.5" height="468.5" rx="234.25" fill="none" stroke="#0A0A0A" strokeWidth="1.5" strokeDasharray="5 5" />
      </svg>
      <div className={styles.dottedMobile} aria-hidden="true" />
      <p className={styles.dottedLabel}>Maker 3D</p>

      <div className={`${styles.ideaCircle} ${styles.ideaCircle_left}`}>IDEA PRODUCT</div>
      <div className={`${styles.ideaCircle} ${styles.ideaCircle_right}`}>3D PRINTING</div>
      <div className={styles.equals} aria-hidden="true">
        <span />
        <span />
      </div>
      <div className={styles.resultCircle}>
        <p>
          <span>3D프린팅을 이용한</span>
          <span>아이디어 상품 제작</span>
        </p>
      </div>
    </Reveal>
  );
}

export function VisionSection() {
  return (
    <Reveal plain className={`${styles.block} ${styles.vision}`}>
      <div className={styles.visionGlow} aria-hidden="true" />
      <p className={styles.visionText}>
        {VISION_LINES.map((line, i) => (
          <span key={i} style={{ '--l': i } as CSSProperties}>
            {line}{' '}
          </span>
        ))}
      </p>
      {VISION_DOTS.map(([x, y, r], i) => (
        <span
          key={i}
          className={styles.visionDot}
          aria-hidden="true"
          style={{ '--x': x, '--y': y, '--r': r, '--i': i } as CSSProperties}
        />
      ))}
    </Reveal>
  );
}

/** 회사 구조 · 서비스 · 목표를 한 장의 도식(가로 1920 기준)으로 묶는다 */
export function IntroDiagram() {
  return (
    <div className={styles.diagram}>
      <CompanyModel />
      <ServiceSection />
      <VisionSection />
    </div>
  );
}

/** 오른쪽 화살표 (예전에는 그림 파일 /arrow-right.svg) */
export const ArrowRightIcon = () => (
  <svg className={styles.arrowRight} width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path
      d="M24.4678 9.22168C24.7578 8.93168 25.2373 8.93168 25.5273 9.22168L31.7773 15.4717C32.0672 15.7617 32.0673 16.2413 31.7773 16.5312L25.5273 22.7812C25.3774 22.9312 25.187 23.001 24.9971 23.001C24.8073 23.0009 24.6176 22.931 24.4678 22.7812C24.1778 22.4913 24.1779 22.0117 24.4678 21.7217L29.4385 16.75H4.75C4.34006 16.75 4.00011 16.4099 4 16C4 15.59 4.34 15.25 4.75 15.25H29.4365L24.4678 10.2812C24.1778 9.99128 24.1779 9.51169 24.4678 9.22168Z"
      fill="#0A0A0A"
    />
  </svg>
);
