'use client';

import { useRef } from 'react';
import styles from './HeroBanner.module.scss';
import { useParallax } from '../useParallax';

/**
 * 홈 화면 대표 배너. 예전에는 3200×1378 그림 한 장(public/mainPhoto.png)이었고, 같은 구성을 코드로 다시 그렸다.
 *  - 글자는 진짜 글자다 (검색 · 화면 읽기 프로그램이 읽을 수 있고, 어떤 화면에서도 또렷하다)
 *  - 기울어진 띠 세 개는 3D 프린팅의 흐름을 보여 준다:
 *    ① 헤드가 좌우로 오가며 한 층씩 쌓아 올리는 프린터  ② 줄지어 지나가는 완성된 출력물  ③ 모델이 층으로 나뉘어 만들어지는 화면
 * 그림은 모두 제 비율로 그린다 (원은 원, 정육면체는 원근을 넣은 정육면체). 띠 안에서 늘이거나 눌러서 맞추지 않는다.
 * 글자 · 띠의 치수는 원본 그림(1600×689 기준)을 재서 옮긴 값이다.
 */

// ---------------------------------------------------------------------------
// 공용 도형
// ---------------------------------------------------------------------------

/** 톱니바퀴의 바깥 윤곽 (가운데가 원점) */
function gearOutline(teeth: number, outer: number, root: number): string {
  const pitch = (Math.PI * 2) / teeth;
  const point = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    d += `${i === 0 ? 'M' : 'L'}${point(root, a + pitch * 0.22)}L${point(outer, a + pitch * 0.34)}L${point(outer, a + pitch * 0.66)}L${point(root, a + pitch * 0.78)}`;
  }
  return `${d}Z`;
}

/** 원을 경로로 (구멍을 뚫을 때 쓴다). 서버와 브라우저가 똑같은 글자를 내도록 소수 둘째 자리로 맞춘다 */
const circlePath = (cx: number, cy: number, r: number) =>
  `M${(cx - r).toFixed(2)} ${cy.toFixed(2)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

const GEAR_PART = `${gearOutline(14, 40, 32)}${circlePath(0, 0, 8)}${[0, 1, 2, 3, 4]
  .map((i) => circlePath(Math.cos((i * Math.PI * 2) / 5) * 20, Math.sin((i * Math.PI * 2) / 5) * 20, 5.5))
  .join('')}`;
const GEAR_SMALL = `${gearOutline(9, 21, 15.5)}${circlePath(0, 0, 5)}`;
const GEAR_TOOLPATH = gearOutline(12, 42, 33);

// ---------------------------------------------------------------------------
// ① 프린터: 헤드가 좌우로 오가며 한 층씩 쌓는다
// ---------------------------------------------------------------------------

/**
 * 쌓는 층: 층마다의 왼쪽 끝 · 오른쪽 끝 (출력물은 위 모서리가 둥글어서 위층일수록 조금 짧다).
 * 층 수는 스타일(HeroBanner.module.scss)의 $print-layers 와 같아야 한다
 */
const LAYER_EXTENTS: [number, number][] = [
  [214, 506],
  [214, 506],
  [214, 506],
  [214, 506],
  [214, 506],
  [215.5, 504.5],
  [218.4, 501.6],
  [224.3, 495.7],
];
/** 층의 굵기. 양 끝은 이 굵기의 절반만큼 둥글다 */
const BEAD = 5;
/**
 * 층 하나를 긋는 길: 짝수 층은 왼쪽 → 오른쪽, 홀수 층은 오른쪽 → 왼쪽.
 * 노즐도 정확히 이 시작점에서 끝점까지만 움직인다 → 층의 끝이 늘 노즐 바로 아래에 있다
 */
const LAYER_RUNS = LAYER_EXTENTS.map(([left, right], i) => {
  const from = i % 2 === 0 ? left + BEAD / 2 : right - BEAD / 2;
  const to = i % 2 === 0 ? right - BEAD / 2 : left + BEAD / 2;
  return { from, to, y: 101.5 - i * BEAD };
});
/** 헤드가 움직일 위치를 스타일에 넘긴다 (--s0, --e0, --s1, …) */
const HEAD_STOPS = Object.fromEntries(
  LAYER_RUNS.flatMap((run, i) => [
    [`--s${i}`, `${run.from}px`],
    [`--e${i}`, `${run.to}px`],
  ]),
) as React.CSSProperties;
const FAN_BLADES = [0, 1, 2, 3, 4, 5, 6];

function PrinterArt() {
  return (
    <svg className={styles.art} viewBox="0 0 720 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hero-s1-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1e22" />
          <stop offset="1" stopColor="#07080a" />
        </linearGradient>
        <pattern id="hero-s1-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#fff" strokeOpacity="0.055" strokeWidth="1" />
        </pattern>
        <linearGradient id="hero-s1-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5d61" />
          <stop offset="0.4" stopColor="#eceef0" />
          <stop offset="1" stopColor="#5f6266" />
        </linearGradient>
        <linearGradient id="hero-s1-bed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4d52" />
          <stop offset="1" stopColor="#17181b" />
        </linearGradient>
        <radialGradient id="hero-s1-hot">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#7fd0ff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#2493d8" stopOpacity="0" />
        </radialGradient>
        {/* 방금 나온 부분: 노즐에 가까울수록 뜨겁게 빛난다 (노즐 뒤로 22만큼) */}
        <linearGradient id="hero-s1-fresh" gradientUnits="userSpaceOnUse" x1="-22" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#bfe6ff" stopOpacity="0" />
          <stop offset="1" stopColor="#eaf7ff" />
        </linearGradient>
        <linearGradient id="hero-s1-glint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="hero-s1-blur" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        {/* 출력물의 옆모습: 위 모서리가 둥근 덩어리 */}
        <clipPath id="hero-s1-part">
          <path d="M214 104V86C214 72 226 64 240 64H480C494 64 506 72 506 86V104Z" />
        </clipPath>
      </defs>

      <rect width="720" height="120" fill="url(#hero-s1-bg)" />
      <rect width="720" height="120" fill="url(#hero-s1-grid)" />
      {/* 초점 밖의 작업실 조명 */}
      <g filter="url(#hero-s1-blur)" opacity="0.5">
        <circle cx="150" cy="26" r="9" fill="#fff" />
        <circle cx="610" cy="34" r="12" fill="#bfe4ff" />
        <rect x="560" y="70" width="90" height="6" fill="#fff" />
      </g>

      {/* 출력판 */}
      <rect x="0" y="104" width="720" height="16" fill="url(#hero-s1-bed)" />
      <rect x="0" y="104" width="720" height="1.2" fill="#9da1a6" />

      {/* 쌓이는 층: 노즐이 지나간 자리까지 그어진다 (끝이 둥근 한 줄씩) */}
      {LAYER_RUNS.map((run, i) => (
        <path
          key={i}
          className={styles[`layer${i}`]}
          d={`M${run.from} ${run.y}H${run.to}`}
          pathLength={1}
          fill="none"
          stroke={i % 2 ? '#bfc2c5' : '#dcdee0'}
          strokeWidth={BEAD}
          strokeLinecap="round"
        />
      ))}
      <g clipPath="url(#hero-s1-part)">
        <rect className={styles.glint} x="150" y="60" width="70" height="48" fill="url(#hero-s1-glint)" transform="skewX(-20)" />
      </g>

      {/* 한 층을 쌓을 때마다 위로 올라가는 가로대 */}
      <g className={styles.gantry}>
        <rect x="-20" y="47" width="760" height="6" rx="3" fill="url(#hero-s1-rail)" />
        <rect x="-20" y="56" width="760" height="2" fill="#3c3f43" />

        {/* 좌우로 오가는 헤드 (노즐 끝이 x = 0, y = 99. 지금 긋는 층의 가운데 높이는 y = 101.5) */}
        <g className={styles.head} style={HEAD_STOPS}>
          <path className={styles.fresh} d="M-22 101.5H0" fill="none" stroke="url(#hero-s1-fresh)" strokeWidth={BEAD} strokeLinecap="round" />
          <path d="M8 40C10 22 26 10 30 -12" fill="none" stroke="#d7dade" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="-30" y="40" width="60" height="32" rx="5" fill="#1f2226" stroke="#74797f" strokeWidth="1" />
          {/* 냉각 팬 */}
          <circle cx="-14" cy="56" r="11.5" fill="#0a0b0c" stroke="#9aa0a6" strokeWidth="1" />
          <g className={styles.fan}>
            {FAN_BLADES.map((i) => (
              <path
                key={i}
                d="M-14 52.5C-11.5 50.5 -9.5 48.5 -10.5 46.3A10 10 0 0 0 -16.2 46.2C-14.8 48 -15.2 50.4 -14 52.5Z"
                fill={i % 2 ? '#6d7379' : '#8b9198'}
                transform={`rotate(${(360 / FAN_BLADES.length) * i} -14 56)`}
              />
            ))}
          </g>
          <circle cx="-14" cy="56" r="3.4" fill="#2a2d31" stroke="#8d939a" strokeWidth="0.8" />
          {/* 방열판 */}
          <rect x="4" y="44" width="20" height="24" rx="2" fill="#34373b" />
          <path d="M4 48.5H24M4 53H24M4 57.5H24M4 62H24" stroke="#7b8087" strokeWidth="1.4" />
          {/* 출력물 식히는 바람길 */}
          <path d="M-22 67H-8L-4.5 90L-9 93Z" fill="#292c30" stroke="#5c6167" strokeWidth="0.8" />
          {/* 히터 블록과 노즐 */}
          <rect x="-3" y="72" width="6" height="5" fill="#7d8288" />
          <rect x="-8" y="76" width="16" height="12" rx="2" fill="#a3a8ae" />
          <path d="M-6 88H6L1.8 99H-1.8Z" fill="#d6c08a" />
          <circle className={styles.hot} cx="0" cy="100" r="7" fill="url(#hero-s1-hot)" />
        </g>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ② 완성된 출력물이 줄지어 지나간다
// ---------------------------------------------------------------------------

/** 출력물 한 줄의 길이. 같은 줄을 두 번 이어 붙여 끊김 없이 흘려보낸다 (스타일의 $parade-width 와 같아야 한다) */
const PARADE_WIDTH = 1400;

/** 바닥에 놓인 출력물 하나: 밑 가운데가 원점이고 위쪽이 -y */
function Part({ x, shadow = 34, children }: { x: number; shadow?: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} 102)`}>
      <ellipse cx="4" cy="3" rx={shadow} ry="5" fill="#000" opacity="0.2" filter="url(#hero-s2-soft)" />
      {children}
    </g>
  );
}

function PartsRow() {
  return (
    <>
      {/* 꽃병 */}
      <Part x={80} shadow={26}>
        <path d="M-20 0C-36 -18 -31 -45 -14 -58C-8 -64 -10 -75 -16 -86H16C10 -75 8 -64 14 -58C31 -45 36 -18 20 0Z" fill="url(#hero-s2-layers-b)" />
        <path d="M-20 0C-36 -18 -31 -45 -14 -58C-8 -64 -10 -75 -16 -86H16C10 -75 8 -64 14 -58C31 -45 36 -18 20 0Z" fill="url(#hero-s2-round)" />
        <ellipse cx="0" cy="-86" rx="16" ry="2.6" fill="#4d4d4d" />
      </Part>

      {/* 맞물려 도는 톱니바퀴 두 개 */}
      <Part x={240} shadow={58}>
        <g transform="translate(-14 -40)">
          <path className={styles.gearSpin} d={GEAR_PART} fill="#767676" fillRule="evenodd" stroke="#565656" strokeWidth="1" />
        </g>
        <g transform="translate(47 -21)">
          <path className={styles.gearSpinBack} d={GEAR_SMALL} fill="#9a9a9a" fillRule="evenodd" stroke="#6e6e6e" strokeWidth="1" />
        </g>
      </Part>

      {/* 로켓 */}
      <Part x={400} shadow={24}>
        <path d="M-13 -30L-30 -4L-12 -10Z" fill="url(#hero-s2-layers-a)" />
        <path d="M13 -30L30 -4L12 -10Z" fill="url(#hero-s2-layers-a)" />
        <path d="M0 -92C17 -74 19 -40 13 -12H-13C-19 -40 -17 -74 0 -92Z" fill="url(#hero-s2-layers-c)" />
        <path d="M0 -92C17 -74 19 -40 13 -12H-13C-19 -40 -17 -74 0 -92Z" fill="url(#hero-s2-round)" />
        <circle cx="0" cy="-56" r="6.5" fill="#444" stroke="#e4e4e4" strokeWidth="2" />
        <path d="M-9 -12H9L13 0H-13Z" fill="#595959" />
      </Part>

      {/* 정육면체 (등각 투영: 세 면이 모두 같은 비율로 보인다) */}
      <Part x={560} shadow={42}>
        <path d="M0 -46L-39.8 -69L0 -92L39.8 -69Z" fill="#b4b4b4" />
        <path d="M0 0L-39.8 -23V-69L0 -46Z" fill="#858585" />
        <path d="M0 0L39.8 -23V-69L0 -46Z" fill="#636363" />
        <path d="M0 0L-39.8 -23M0 -46V0M0 0L39.8 -23" stroke="#4c4c4c" strokeWidth="0.8" fill="none" />
        <text className={styles.partText} transform="matrix(0.866 -0.5 0 1 6 -12)" fontSize="23" fontWeight="800" fill="#d8d8d8">
          3D
        </text>
      </Part>

      {/* 체스 룩 */}
      <Part x={710} shadow={28}>
        <path d="M-24 0V-8H24V0Z" fill="url(#hero-s2-layers-a)" />
        <path d="M-17 -8L-12 -62H12L17 -8Z" fill="url(#hero-s2-layers-b)" />
        <path d="M-17 -8L-12 -62H12L17 -8Z" fill="url(#hero-s2-round)" />
        <path d="M-19 -62H19V-70H-19Z" fill="url(#hero-s2-layers-a)" />
        <path d="M-21 -70V-88H-11V-80H-5V-88H5V-80H11V-88H21V-70Z" fill="url(#hero-s2-layers-b)" />
      </Part>

      {/* 키보드 클리커 */}
      <Part x={880} shadow={62}>
        <circle cx="-70" cy="-22" r="9" fill="none" stroke="#8a8a8a" strokeWidth="3" />
        <rect x="-60" y="-34" width="120" height="34" rx="7" fill="url(#hero-s2-layers-c)" />
        {[-37, 0, 37].map((kx, i) => (
          <g key={kx} className={styles.clickKey} style={{ '--key-delay': `${i * 0.35}s` } as React.CSSProperties}>
            <path d={`M${kx - 16} -34L${kx - 12.5} -58H${kx + 12.5}L${kx + 16} -34Z`} fill={['#5a5a5a', '#747474', '#5a5a5a'][i]} />
            <rect x={kx - 12.5} y="-60" width="25" height="4" rx="2" fill={['#7d7d7d', '#9b9b9b', '#7d7d7d'][i]} />
          </g>
        ))}
      </Part>

      {/* 볼트 */}
      <Part x={1040} shadow={22}>
        <rect x="-9" y="-70" width="18" height="70" fill="url(#hero-s2-thread)" />
        <path d="M-9 0L-6 4H6L9 0Z" fill="#5e5e5e" transform="translate(0 -4)" />
        <rect x="-21" y="-88" width="42" height="18" rx="3" fill="#8c8c8c" />
        <path d="M-10.5 -88V-70M10.5 -88V-70" stroke="#6a6a6a" strokeWidth="1" />
        <rect x="-21" y="-88" width="42" height="4" rx="2" fill="#b0b0b0" />
      </Part>

      {/* 보석 모양 */}
      <Part x={1170} shadow={24}>
        <path d="M0 -92L-26 -62L-18 0H0Z" fill="#a2a2a2" />
        <path d="M0 -92L26 -62L18 0H0Z" fill="#6c6c6c" />
        <path d="M0 -92L-9 -60L0 0L9 -60Z" fill="#888" />
        <path d="M-26 -62L-9 -60L9 -60L26 -62" fill="none" stroke="#555" strokeWidth="0.8" />
      </Part>

      {/* 배 */}
      <Part x={1310} shadow={54}>
        <path d="M-56 -30Q-54 0 -32 0H34Q54 -4 60 -34Z" fill="url(#hero-s2-layers-b)" />
        <rect x="-22" y="-62" width="40" height="32" fill="url(#hero-s2-layers-c)" />
        <path d="M-15 -34V-48A6 6 0 0 1 -3 -48V-34ZM2 -34V-48A6 6 0 0 1 14 -48V-34Z" fill="#4f4f4f" />
        <rect x="-28" y="-68" width="52" height="7" rx="2" fill="#6b6b6b" />
        <rect x="6" y="-88" width="12" height="20" rx="2" fill="url(#hero-s2-layers-a)" />
      </Part>
    </>
  );
}

function ParadeArt() {
  return (
    <svg className={styles.art} viewBox="0 0 1220 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hero-s2-bed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f1f1" />
          <stop offset="0.78" stopColor="#dedede" />
          <stop offset="1" stopColor="#c4c4c4" />
        </linearGradient>
        <pattern id="hero-s2-dots" width="20" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-36)">
          <rect x="3" y="4" width="7" height="1.6" rx="0.8" fill="#b9b9b9" />
        </pattern>
        {/* 층층이 쌓인 결: 4px 마다 가는 줄 */}
        {[
          ['a', '#7b7b7b', '#6a6a6a'],
          ['b', '#939393', '#808080'],
          ['c', '#b3b3b3', '#9f9f9f'],
        ].map(([id, base, line]) => (
          <pattern key={id} id={`hero-s2-layers-${id}`} width="8" height="4" patternUnits="userSpaceOnUse">
            <rect width="8" height="4" fill={base} />
            <rect y="3" width="8" height="1" fill={line} />
          </pattern>
        ))}
        <pattern id="hero-s2-thread" width="6" height="5" patternUnits="userSpaceOnUse" patternTransform="skewY(-14)">
          <rect width="6" height="5" fill="#8a8a8a" />
          <rect y="3" width="6" height="2" fill="#636363" />
        </pattern>
        {/* 둥근 몸통의 밝고 어두운 부분 */}
        <linearGradient id="hero-s2-round" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.32" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id="hero-s2-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="hero-s2-soft" x="-30%" y="-150%" width="160%" height="400%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <rect width="1220" height="120" fill="url(#hero-s2-bed)" />
      <g className={styles.parade}>
        <rect x="0" y="0" width={PARADE_WIDTH * 2 + 40} height="120" fill="url(#hero-s2-dots)" opacity="0.8" />
        <PartsRow />
        <g transform={`translate(${PARADE_WIDTH} 0)`}>
          <PartsRow />
        </g>
      </g>
      {/* 진열대 위를 훑고 지나가는 빛 */}
      <rect className={styles.sweep} x="-260" y="0" width="240" height="120" fill="url(#hero-s2-sweep)" transform="skewX(-36)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ③ 모델이 층으로 나뉘어 만들어지는 화면
// ---------------------------------------------------------------------------

const CUBE_SIDES = ['front', 'right', 'back', 'left'] as const;

function SlicerArt() {
  return (
    <>
      <svg className={styles.art} viewBox="0 0 882 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="hero-s3-bg" cx="0.56" cy="0.5" r="0.7">
            <stop offset="0" stopColor="#14181d" />
            <stop offset="1" stopColor="#040506" />
          </radialGradient>
          <pattern id="hero-s3-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth="1" />
          </pattern>
          <pattern id="hero-s3-infill" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0V7" stroke="#8fd2ff" strokeOpacity="0.5" strokeWidth="1" />
          </pattern>
          <filter id="hero-s3-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <clipPath id="hero-s3-ring">
            <path d={`${GEAR_TOOLPATH}${circlePath(0, 0, 14)}`} clipRule="evenodd" />
          </clipPath>
        </defs>
        <rect width="882" height="120" fill="url(#hero-s3-bg)" />
        <rect width="882" height="120" fill="url(#hero-s3-grid)" />

        {/* 위에서 본 한 층의 경로: 노즐이 윤곽을 따라 돌고, 안쪽이 채워진다 */}
        <g transform="translate(206 60)">
          <path d="M-74 0H74M0 -56V56" stroke="#fff" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 5" />
          <rect className={styles.infill} x="-46" y="-46" width="92" height="92" fill="url(#hero-s3-infill)" clipPath="url(#hero-s3-ring)" />
          <path id="hero-s3-path" className={styles.toolpath} d={GEAR_TOOLPATH} pathLength={1} fill="none" stroke="#f2f6f9" strokeWidth="1.8" strokeLinejoin="round" />
          <circle className={styles.toolpathInner} r="14" pathLength={1} fill="none" stroke="#aeb7bf" strokeWidth="1.4" />
          <g className={styles.nozzleDot}>
            <circle r="5" fill="#59c2ff" filter="url(#hero-s3-glow)" />
            <circle r="2.2" fill="#fff" />
            {/* 윤곽을 그리는 시간에 맞춰 같은 길을 따라간다 (스타일의 $slice-cycle 과 같은 길이) */}
            <animateMotion dur="8s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.5;1" calcMode="linear">
              <mpath href="#hero-s3-path" />
            </animateMotion>
          </g>
        </g>
      </svg>

      {/* 원근이 들어간 정육면체: 선으로만 된 모델이 아래에서부터 채워진다 */}
      <div className={styles.cubeStage} aria-hidden="true">
        <div className={styles.cube}>
          {CUBE_SIDES.map((side) => (
            <span key={`wire-${side}`} className={`${styles.cubeFace} ${styles.cubeWire} ${styles[`cube_${side}`]}`} />
          ))}
          <span className={`${styles.cubeFace} ${styles.cubeWire} ${styles.cube_top}`} />
          <span className={`${styles.cubeFace} ${styles.cubeWire} ${styles.cube_bottom}`} />
          {CUBE_SIDES.map((side) => (
            <span key={`solid-${side}`} className={`${styles.cubeFace} ${styles.cubeSolid} ${styles[`cube_${side}`]}`} />
          ))}
          <span className={`${styles.cubeFace} ${styles.cubeSlice}`} />
        </div>
      </div>

      {/* 진행 상황 */}
      <div className={styles.hud} aria-hidden="true">
        <span className={styles.hudLabel}>LAYER</span>
        <span className={styles.hudCount}>
          <span className={styles.hudNow} />
          <span className={styles.hudTotal}>/ 128</span>
        </span>
        <span className={styles.hudBar}>
          <span className={styles.hudBarFill} />
        </span>
        <span className={styles.hudSpec}>0.2 mm · 250 mm/s</span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 배너
// ---------------------------------------------------------------------------

export default function HeroBanner() {
  const heroRef = useRef<HTMLElement>(null);
  useParallax(heroRef);

  return (
    <section ref={heroRef} className={styles.hero} aria-label="MAKER3D 3D 프린팅 전문 서비스">
      <div className={styles.canvas}>
        <div className={styles.glow} aria-hidden="true" />

        <p className={styles.headline}>
          <span className={`${styles.word} ${styles.w1}`}>정확하고</span>
          <span className={`${styles.word} ${styles.w2}`}>빠르게,</span>
          <span className={`${styles.word} ${styles.w3}`}>전문가의</span>
          <span className={`${styles.word} ${styles.w4}`}>3D 프린팅</span>
        </p>

        <div className={`${styles.strip} ${styles.strip1}`}>
          <PrinterArt />
        </div>
        <div className={`${styles.strip} ${styles.strip2}`}>
          <ParadeArt />
        </div>
        <div className={`${styles.strip} ${styles.strip3}`}>
          <SlicerArt />
        </div>
      </div>

      <p className={styles.lead}>
        <strong>업계 최고급 출력 장비</strong>와 <strong>경험</strong>으로 <strong>완성도 높은 결과물</strong>을 제공합니다.
      </p>
    </section>
  );
}
