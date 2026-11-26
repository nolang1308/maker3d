'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from './HomeSections.module.scss';
import { CAR_DETAIL, CAR_SKETCH, HAND_MODELING, HAND_RECOMMEND } from './homeArt';
import Reveal from '../Reveal';
import ScrollArrow from '../ScrollArrow';

// 다른 페이지와 함께 쓰는 것은 공용 파일에 있다. 홈 화면에서는 여기서 한꺼번에 가져다 쓴다
export { Reveal, ScrollArrow };

/**
 * 홈 화면에서 예전에 그림 파일이던 구역들을 코드로 다시 만든 것.
 * 글자는 진짜 글자로 쓰고(원본 그림에서 잰 크기 · 위치 그대로), 화면에 들어올 때 움직임을 넣었다.
 */

// ---------------------------------------------------------------------------
// 아이콘 (예전에는 작은 그림 파일을 하나씩 내려받았다)
// ---------------------------------------------------------------------------

export const StoreIcon = () => (
  <svg width="19" height="22" viewBox="0 0 19 22" fill="none" aria-hidden="true">
    <path
      d="M16.6667 5.20833H14.5833C14.5833 2.29167 12.2917 0 9.375 0C6.45833 0 4.16667 2.29167 4.16667 5.20833H2.08333C0.9375 5.20833 0 6.14583 0 7.29167V19.7917C0 20.9375 0.9375 21.875 2.08333 21.875H16.6667C17.8125 21.875 18.75 20.9375 18.75 19.7917V7.29167C18.75 6.14583 17.8125 5.20833 16.6667 5.20833ZM9.375 2.08333C11.1458 2.08333 12.5 3.4375 12.5 5.20833H6.25C6.25 3.4375 7.60417 2.08333 9.375 2.08333ZM16.6667 19.7917H2.08333V7.29167H16.6667V19.7917ZM9.375 11.4583C7.60417 11.4583 6.25 10.1042 6.25 8.33333H4.16667C4.16667 11.25 6.45833 13.5417 9.375 13.5417C12.2917 13.5417 14.5833 11.25 14.5833 8.33333H12.5C12.5 10.1042 11.1458 11.4583 9.375 11.4583Z"
      fill="white"
    />
  </svg>
);

export const QuoteIcon = () => (
  <svg width="19" height="22" viewBox="0 0 25 25" fill="none" aria-hidden="true">
    <path
      d="M19.7943 6.2526C20.0705 6.2526 20.3355 6.14286 20.5308 5.94751C20.7262 5.75216 20.8359 5.4872 20.8359 5.21094C20.8359 4.93467 20.7262 4.66972 20.5308 4.47437C20.3355 4.27902 20.0705 4.16927 19.7943 4.16927C19.518 4.16927 19.253 4.27902 19.0577 4.47437C18.8623 4.66972 18.7526 4.93467 18.7526 5.21094C18.7526 5.4872 18.8623 5.75216 19.0577 5.94751C19.253 6.14286 19.518 6.2526 19.7943 6.2526ZM19.7943 2.08594C20.6231 2.08594 21.4179 2.41518 22.004 3.00123C22.59 3.58728 22.9193 4.38214 22.9193 5.21094V11.4609H18.7526V7.29427H6.2526V11.4609H2.08594V5.21094C2.08594 4.38214 2.41518 3.58728 3.00123 3.00123C3.58728 2.41518 4.38214 2.08594 5.21094 2.08594H19.7943ZM18.7526 19.013C18.7526 19.4089 18.5339 19.7526 18.2005 19.9297L13.0964 22.7318C12.9193 22.8568 12.7214 22.9193 12.5026 22.9193C12.2839 22.9193 12.0755 22.8568 11.9089 22.7318L6.80469 19.9297C6.47135 19.7526 6.2526 19.4089 6.2526 19.013V13.5443C6.2526 13.1484 6.47135 12.8047 6.80469 12.6276L11.9089 10.0859C12.0755 9.96094 12.2839 9.89844 12.5026 9.89844C12.7214 9.89844 12.9193 9.96094 13.0964 10.0859L18.2005 12.6276C18.5339 12.8047 18.7526 13.1484 18.7526 13.5443V19.013ZM12.5026 12.138L9.41927 13.5443L12.5026 15.2109L15.5859 13.5443L12.5026 12.138ZM8.33594 18.3984L11.4609 20.0964V17.013L8.33594 15.3255V18.3984ZM16.6693 18.3984V15.3255L13.5443 17.013V20.0964L16.6693 18.3984Z"
      fill="white"
    />
  </svg>
);

// 키캡 모양 (바깥 테두리 + 손가락이 닿는 윗면. 윗면을 위로 올려 앞쪽 옆면이 보이게 한다)
export const ClickerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <rect x="1.5" y="1.5" width="19" height="19" rx="4.5" stroke="white" strokeWidth="2" />
    <rect x="5" y="4" width="12" height="10" rx="2.5" stroke="white" strokeWidth="2" />
  </svg>
);

// 네모가 아닌 모양 (쉐이프 클리커: 올린 로고의 모양대로 만들어진다는 뜻으로 별 모양을 쓴다)
export const ShapeClickerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M11 2.5 13.47 8.1l6.09.62-4.57 4.08 1.3 5.98L11 15.7l-5.29 3.08 1.3-5.98L2.44 8.72l6.09-.62L11 2.5Z"
      stroke="white"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export const KakaoIcon = () => (
  <svg width="19" height="22" viewBox="0 0 21 21" fill="none" aria-hidden="true">
    <path
      d="M10.5 0C12.3984 0 14.1543 0.399993 15.7676 1.19998C17.3809 1.99997 18.6562 3.08778 19.5938 4.46342C20.5312 5.83906 21 7.33956 21 8.96493C21 10.5903 20.5312 12.0929 19.5938 13.4728C18.6562 14.8527 17.3828 15.9426 15.7734 16.7426C14.1641 17.5426 12.4062 17.9426 10.5 17.9426C9.89844 17.9426 9.27734 17.896 8.63672 17.8029C5.85547 19.8938 4.375 20.952 4.19531 20.9774C4.10938 21.0113 4.02734 21.0071 3.94922 20.9647C3.91797 20.9393 3.89453 20.9055 3.87891 20.8631C3.86328 20.8208 3.85547 20.7827 3.85547 20.7489V20.6981C3.90234 20.3679 4.25781 18.9923 4.92188 16.5711C3.41406 15.7585 2.2168 14.6812 1.33008 13.3395C0.443359 11.9977 0 10.5395 0 8.96493C0 7.33956 0.46875 5.83906 1.40625 4.46342C2.34375 3.08778 3.61914 1.99997 5.23242 1.19998C6.8457 0.399993 8.60156 0 10.5 0Z"
      fill="#0A0A0A"
    />
  </svg>
);

export const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg width="10" height="19" viewBox="0 0 11 19" fill="none" aria-hidden="true">
    <path
      d={
        direction === 'left'
          ? 'M9.5447 0.00130087C9.70579 0.00130085 9.87064 0.0639187 9.99426 0.185524C10.2415 0.428735 10.2415 0.826739 9.99426 1.06995L1.53188 9.39819L9.87064 17.6011C10.1179 17.8443 10.1179 18.2424 9.87064 18.4856C9.6234 18.7288 9.21883 18.7288 8.97159 18.4856L0.183297 9.84042C-0.0639411 9.59721 -0.0639412 9.19922 0.183297 8.95601L9.09521 0.185579C9.21882 0.0639741 9.38362 0.00130088 9.5447 0.00130087Z'
          : 'M0.634982 18.6667C0.473898 18.6667 0.309047 18.604 0.185428 18.4824C-0.0618094 18.2392 -0.0618093 17.8412 0.185429 17.598L8.64781 9.26978L0.30905 1.06685C0.0618127 0.823623 0.0618128 0.425619 0.309051 0.182408C0.556288 -0.0608026 0.960864 -0.0608025 1.2081 0.182408L9.99639 8.82755C10.2436 9.07076 10.2436 9.46875 9.99639 9.71196L1.08448 18.4824C0.960861 18.604 0.796048 18.6666 0.634964 18.6666L0.634982 18.6667Z'
      }
      fill="#0A0A0A"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// 견적 진행 방법 영상
// ---------------------------------------------------------------------------

/**
 * 진행 방법 영상. 화면 가까이 왔을 때에야 내려받고, 화면 밖으로 나가면 멈춘다.
 * (예전에는 페이지를 열자마자 4K 영상을 받기 시작했다)
 */
export function ProcessVideo({ step }: { step: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const nearObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          nearObserver.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    const viewObserver = new IntersectionObserver((entries) => setVisible(entries.some((entry) => entry.isIntersecting)), {
      threshold: 0.15,
    });
    nearObserver.observe(el);
    viewObserver.observe(el);
    return () => {
      nearObserver.disconnect();
      viewObserver.disconnect();
    };
  }, []);

  // 화면에 보일 때만 재생한다
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !near) return;
    if (visible) video.play().catch(() => {});
    else video.pause();
  }, [visible, near, step]);

  return (
    <div ref={wrapRef} className={styles.videoWrap}>
      {near ? (
        <video
          key={step}
          ref={videoRef}
          src={`/process/step${step}.mp4`}
          className={styles.video}
          muted
          playsInline
          loop
          controls
          preload="metadata"
        />
      ) : (
        <div className={styles.videoPlaceholder} aria-hidden="true" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 스토어 배너의 배경: 잔디 위의 키보드 클리커 (예전에는 사진 public/image.png)
// ---------------------------------------------------------------------------

/** 같은 그림이 서버와 브라우저에서 똑같이 나오도록, 정해진 씨앗에서 뽑는 난수 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const GRASS_COLORS = ['#3f6a22', '#55862c', '#6b9b38', '#2a4a17', '#86a84a', '#a3bd63', '#c2b26a', '#4a7a26', '#7a9a3e', '#1f3a12'];
const GRASS_BLADES = (() => {
  const random = seeded(20241114);
  return Array.from({ length: 380 }, () => {
    const x = random() * 1434;
    const y = random() * 760;
    const length = 80 + random() * 190;
    const angle = (random() - 0.5) * 2.6;
    const bend = (random() - 0.5) * 60;
    const x2 = x + Math.sin(angle) * length;
    const y2 = y - Math.cos(angle) * length;
    return {
      d: `M${x.toFixed(0)} ${y.toFixed(0)}Q${((x + x2) / 2 + bend).toFixed(0)} ${((y + y2) / 2).toFixed(0)} ${x2.toFixed(0)} ${y2.toFixed(0)}`,
      color: GRASS_COLORS[Math.floor(random() * GRASS_COLORS.length)],
      width: 7 + random() * 13,
    };
  });
})();

const STAR = 'M0 -17L5 -6.5L16.5 -5L8 3L10.2 14.5L0 9L-10.2 14.5L-8 3L-16.5 -5L-5 -6.5Z';
const CLICKER_KEYS = [
  { color: '#2f9ae2', top: '#57b3ee' },
  { color: '#eee28a', top: '#f6eea8' },
  { color: '#f2b6cb', top: '#f8cfdc' },
  { color: '#c574d8', top: '#d697e4' },
];

export function StoreScene() {
  return (
    <svg className={styles.storeScene} viewBox="0 0 1434 701" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="1434" height="701" fill="#4b6e2a" />
      <g className={styles.sceneDrift}>
        {/* 잔디 */}
        <g fill="none" strokeLinecap="round">
          {GRASS_BLADES.map((blade, i) => (
            <path key={i} d={blade.d} stroke={blade.color} strokeWidth={blade.width} />
          ))}
        </g>

        {/* 오른쪽 위: 빨간 클리커 (화면 밖으로 반쯤 나가 있다) */}
        <g transform="translate(1140 190) rotate(63)">
          <rect x="-250" y="-92" width="500" height="184" rx="14" fill="#e3104a" />
          <rect x="-250" y="-22" width="500" height="50" fill="#f2f2f2" />
          {[-190, -70, 50, 170].map((x) => (
            <rect key={x} x={x - 48} y="34" width="96" height="70" rx="8" fill="#c80c3e" />
          ))}
        </g>

        {/* 열쇠고리 */}
        <g fill="none" stroke="#8d9395" strokeWidth="6">
          <ellipse cx="716" cy="136" rx="52" ry="44" />
          <ellipse cx="952" cy="282" rx="46" ry="52" transform="rotate(24 952 282)" />
          <ellipse cx="338" cy="566" rx="50" ry="42" />
          <ellipse cx="1090" cy="610" rx="46" ry="52" transform="rotate(-18 1090 610)" />
        </g>
        <path d="M770 170L820 290M1000 330L1180 420" stroke="#7d8385" strokeWidth="8" strokeLinecap="round" />

        {/* 가운데: 흰 케이스에 네 가지 색 키캡 */}
        <g transform="translate(528 330) rotate(-9)">
          <rect x="-296" y="-92" width="592" height="188" rx="20" fill="#f4f4f2" />
          <rect x="-270" y="-70" width="540" height="140" rx="10" fill="#dcdcd8" />
          {CLICKER_KEYS.map((key, i) => (
            <g key={key.color} className={styles.sceneKey} style={{ '--key-delay': `${i * 0.5}s` } as CSSProperties} transform={`translate(${-198 + i * 132} 0)`}>
              <rect x="-60" y="-60" width="120" height="124" rx="12" fill={key.color} />
              <rect x="-46" y="-52" width="92" height="92" rx="10" fill={key.top} />
              <path d={STAR} fill="#fff" transform="translate(0 -6) scale(1.5)" />
            </g>
          ))}
        </g>

        {/* 왼쪽 아래: 초록 별 키캡 */}
        <g transform="translate(214 690) rotate(24)">
          <rect x="-150" y="-90" width="300" height="200" rx="18" fill="#f4f4f2" />
          <rect x="-116" y="-66" width="150" height="150" rx="12" fill="#e9e9e6" />
          <path d={STAR} fill="#66d95a" transform="translate(-42 6) scale(2)" />
        </g>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Maker 3D 만의 강점 (예전에는 그림 public/mainPhoto2.svg)
// ---------------------------------------------------------------------------

const STRENGTHS = [
  {
    title: ['전문가와 진행되는', '체계적인 상담'],
    body: ['체계적인 상담을 통해 당신의 아이디어를', '신속/정확하게 만들어 드립니다.'],
  },
  {
    title: ['현역 3D프린팅 전문가', '항시 대기'],
    body: ['3D프린팅 관련 경력이 높은 전문가 보유,', '최고의 퀄리티를 제공합니다.'],
  },
  {
    title: ['기존 대비 ‘3배’ 빠른', '250mm/s 초고속 출력'],
    body: ['최신 초고속 3D프린터를 활용하여', '퀄리티 Up! 제작속도 Up!', '완벽한 결과물을 제공합니다.'],
  },
];

/** 여러 줄을 원본과 같은 자리에서 줄바꿈한다 (좁은 화면에서는 자연스럽게 이어 붙는다) */
function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <span key={i} className={styles.line}>
          {line}{' '}
        </span>
      ))}
    </>
  );
}

export function StrengthSection() {
  return (
    <section className={styles.strength}>
      <Reveal>
        <h2 className={styles.strengthTitle}>
          <span className={styles.strengthLine1}>
            일반 <strong>출력서비스</strong>와 차원이 다른
          </span>
          <span className={styles.strengthLine2}>
            <strong>Maker 3D</strong>
            <span className={styles.strengthSmall}>만의 </span>
            <strong>강점</strong>
          </span>
        </h2>
      </Reveal>
      <Reveal className={styles.vLineWrap}>
        <div className={styles.vLine} />
      </Reveal>
      <div className={styles.strengthCards}>
        {STRENGTHS.map((item, i) => (
          <Reveal key={item.title[0]} delay={i * 0.14} className={styles.strengthCardWrap}>
            <article className={styles.strengthCard}>
              <h3 className={styles.strengthCardTitle}>
                <Lines lines={item.title} />
              </h3>
              <p className={styles.strengthCardBody}>
                <Lines lines={item.body} />
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 이런 분들에게 추천드립니다 (예전에는 그림 public/mainPhoto3.svg)
// ---------------------------------------------------------------------------

export function RecommendTitle() {
  return (
    <Reveal className={styles.recommend}>
      <h2 className={styles.recommendTitle}>
        <svg className={`${styles.hand} ${styles.handRecommend}`} viewBox={HAND_RECOMMEND.viewBox} role="img" aria-label="‘3D프린터 출력서비스 할까? 말까?’">
          <path d={HAND_RECOMMEND.d} fill="#0A0A0A" />
        </svg>
        <span className={styles.recommendBig}>이런분들에게 추천드립니다!</span>
      </h2>
    </Reveal>
  );
}

// ---------------------------------------------------------------------------
// 3D 모델링 작업 (예전에는 그림 public/mainPhoto4.svg)
// ---------------------------------------------------------------------------

function CarDrawing({ car, className, stagger }: { car: { viewBox: string; paths: string[] }; className: string; stagger: number }) {
  return (
    <svg className={`${styles.car} ${className}`} viewBox={car.viewBox} fill="none" aria-hidden="true">
      {car.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          pathLength={1}
          stroke="#0A0A0A"
          strokeLinejoin="round"
          style={{ '--draw-delay': `${i * stagger}s` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

export function ModelingSection() {
  return (
    <section className={styles.modeling}>
      <Reveal>
        <h2 className={styles.modelingTitle}>
          <svg className={`${styles.hand} ${styles.handModeling}`} viewBox={HAND_MODELING.viewBox} role="img" aria-label="사진, 그림만 있어도 OK!">
            <path d={HAND_MODELING.d} fill="#0A0A0A" />
          </svg>
          <span className={styles.modelingBig}>3D모델링 작업</span>
        </h2>
      </Reveal>

      {/* 고객의 밑그림이 그려지고 → 화살표가 뜨고 → MAKER 3D 의 도면이 그려진다 */}
      <Reveal className={styles.modelingStage}>
        <div className={styles.modelingSide}>
          <p className={styles.modelingLabel}>CUSTOMER</p>
          <CarDrawing car={CAR_SKETCH} className={styles.carSketch} stagger={0.07} />
        </div>
        <div className={styles.modelingArrow}>
          <p className={styles.modelingArrowText}>상상을 현실로</p>
          <span className={styles.modelingArrowDot}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 8H13.5M9 3.2L13.8 8L9 12.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <div className={styles.modelingSide}>
          <p className={styles.modelingLabel}>MAKER 3D</p>
          <CarDrawing car={CAR_DETAIL} className={styles.carDetail} stagger={0.022} />
        </div>
      </Reveal>

      <Reveal>
        <p className={styles.modelingLead}>
          <span className={styles.line}>도면을 제작하지 못하거나, 자신이 없으시면 밑 그림이나 사진을 주셔도 됩니다. </span>
          <span className={styles.line}>보내주신 자료를 바탕으로 전문가가 직접 모델링 작업을 해드립니다.</span>
        </p>
      </Reveal>
      <Reveal>
        <ul className={styles.modelingNotes}>
          <li>모델링 작업에 시간이 소요되기에 작품 제작 기간이 늘어납니다.</li>
          <li>모델링 작업은 추가 비용이 청구됩니다.</li>
        </ul>
        <p className={styles.modelingFine}>
          간단한 수정은 무료지만, 처음부터 제작하는 경우나 수정사항이 많을 시 모델링 난이도에 따라 상담 과정에서 견적을 말씀드립니다.
        </p>
      </Reveal>
    </section>
  );
}
