'use client';

/**
 * 쉐이프 클리커 만들기 (체험 페이지)
 *
 * 로고 그림을 올리면 그 모양대로 몸체 · 스위치 자리 · 누르는 곳을 만들어 3D 로 보여준다.
 * 계산은 전부 브라우저 안에서 하고, 올린 그림은 어디에도 보내지 않는다.
 * 화면 구성과 모양새는 /cliker 와 같게 맞춘다 (스타일도 그쪽 것을 함께 쓴다).
 */

import dynamic from 'next/dynamic';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import base from '../cliker/page.module.scss';
import styles from './page.module.scss';
import { useAuth } from '@/contexts/AuthContext';
import type { ShapeClickerViewerApi } from '@/components/ShapeClickerViewer';
import {
  computeShape,
  loopBounds,
  SHAPE_SPEC,
  ShapeError,
  type Loop,
  type ShapeDesign,
  type ShapeParams,
} from '@/utils/shapeClicker/shape';
import {
  loadLogoFile,
  makeSample,
  RECOMMENDED_LOGO_PIXELS,
  SAMPLES,
  SHARP_LOGO_PIXELS,
  type LogoAsset,
  type SampleId,
} from '@/utils/shapeClicker/logo';

const ShapeClickerViewer = dynamic(() => import('@/components/ShapeClickerViewer'), {
  ssr: false,
  loading: () => <div className={base.viewerLoading}>3D 미리보기를 불러오는 중…</div>,
});

// ---------------------------------------------------------------------------
// 단계
// ---------------------------------------------------------------------------

const STEPS = [
  {
    id: 'logo',
    label: '로고 올리기',
    title: '클리커로 만들 로고를 올려 주세요',
    description: '그림의 모양을 따라 몸체와 누르는 곳이 만들어집니다. 먼저 예시 모양으로 살펴봐도 좋아요.',
  },
  {
    id: 'shape',
    label: '모양 다듬기',
    title: '크기와 모양을 다듬어 주세요',
    description: '크기와 여백을 바꾸면 바로 반영됩니다. 스위치가 들어갈 자리도 옮길 수 있어요.',
  },
  {
    id: 'finish',
    label: '색상 · 완성',
    title: '색을 고르고 완성된 모습을 확인하세요',
    description: '돌려 보고, 눌러 보고, 분해해서 안쪽까지 확인해 보세요.',
  },
] as const;

type StepId = (typeof STEPS)[number]['id'];
const isStepId = (value: string | null): value is StepId => STEPS.some((s) => s.id === value);

// ---------------------------------------------------------------------------
// 선택지 (색은 /cliker 와 같은 목록)
// ---------------------------------------------------------------------------

interface ColorChoice {
  name: string;
  hex: string;
}

const BODY_COLORS: ColorChoice[] = [
  { name: '화이트', hex: '#F3F3EF' },
  { name: '블랙', hex: '#232427' },
  { name: '그레이', hex: '#A3A8AE' },
  { name: '스카이블루', hex: '#8EC5EA' },
  { name: '핑크', hex: '#F4B6C6' },
  { name: '민트', hex: '#A5DCC6' },
  { name: '레몬', hex: '#F4DB7A' },
  { name: '라벤더', hex: '#C2B4E6' },
  { name: '메이커 블루', hex: '#2493D8' },
];

const CAP_COLORS: ColorChoice[] = [
  { name: '화이트', hex: '#F6F6F3' },
  { name: '블랙', hex: '#27282C' },
  { name: '크림', hex: '#EFE6D3' },
  { name: '그레이', hex: '#B4B8BD' },
  { name: '스카이블루', hex: '#A9D3F0' },
  { name: '핑크', hex: '#F7C6D2' },
  { name: '민트', hex: '#B9E5D3' },
  { name: '라벤더', hex: '#D0C5EE' },
];

const BACKGROUND_NOTE: Record<LogoAsset['background'], string> = {
  transparent: '투명한 배경을 뺀 부분을 로고로 썼어요.',
  removed: '배경색을 지우고 남은 부분을 로고로 썼어요.',
  kept: '배경을 가려내기 어려워 그림 전체를 썼어요. 배경이 투명한 PNG 를 올리면 로고 모양대로 만들어집니다.',
};

const noSubscribe = () => () => {};

const ArrowIcon = ({ back = false }: { back?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

const loopPath = (loop: Loop) =>
  `${loop.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join('')}Z`;

// ---------------------------------------------------------------------------
// 위에서 본 모습: 부품이 어떻게 겹치는지 보여주고, 스위치 자리를 끌어서 옮긴다
// ---------------------------------------------------------------------------

interface TopViewProps {
  design: ShapeDesign;
  bodyColor: string;
  capColor: string;
  artUrl: string;
  /** 그림(artUrl)이 원본의 어느 부분인지 */
  artRect: LogoAsset['artRect'];
  onMoveSwitch: (u: number, v: number) => void;
  /** 지금 자리에서 그림 기준으로 (du, dv) 만큼 옮긴다 */
  onNudgeSwitch: (du: number, dv: number) => void;
  onDragChange: (dragging: boolean) => void;
}

function TopView({
  design,
  bodyColor,
  capColor,
  artUrl,
  artRect,
  onMoveSwitch,
  onNudgeSwitch,
  onDragChange,
}: TopViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const S = SHAPE_SPEC;

  const bounds = loopBounds(design.body);
  const pad = 5;
  const view = {
    x: bounds.minX - pad,
    y: bounds.minY - pad,
    w: bounds.maxX - bounds.minX + pad * 2,
    h: bounds.maxY - bounds.minY + pad * 2,
  };
  const rect = design.imageRect;
  const half = S.switchHole / 2;
  const { lug } = design;

  /** 화면 위의 점 → 그림 기준 좌표(0 ~ 1) */
  const moveTo = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    onMoveSwitch((point.x - rect.x) / rect.w, (point.y - rect.y) / rect.h);
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    onDragChange(true);
    moveTo(e.clientX, e.clientY);
  };
  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragging.current) moveTo(e.clientX, e.clientY);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onDragChange(false);
  };
  const handleKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 2 : 0.5;
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = move[e.key];
    if (!delta) return;
    e.preventDefault();
    onNudgeSwitch(delta[0] / rect.w, delta[1] / rect.h);
  };

  return (
    <svg
      ref={svgRef}
      className={styles.topView}
      viewBox={`${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`}
      role="application"
      aria-label="위에서 본 모습. 끌거나 방향키로 스위치 자리를 옮길 수 있습니다"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
    >
      <defs>
        <clipPath id="shape-cap-clip">
          <path d={loopPath(design.cap)} />
        </clipPath>
      </defs>
      {lug && (
        <circle
          cx={lug.x + lug.dx * lug.hole.offset}
          cy={lug.y + lug.dy * lug.hole.offset}
          r={lug.length - lug.hole.offset}
          fill={bodyColor}
          className={styles.topBody}
        />
      )}
      <path d={loopPath(design.body)} fill={bodyColor} className={styles.topBody} />
      {lug && <circle cx={lug.x + lug.dx * lug.hole.offset} cy={lug.y + lug.dy * lug.hole.offset} r={lug.hole.radius} className={styles.topHole} />}
      <path d={loopPath(design.well)} className={styles.topGap} />
      <path d={loopPath(design.cap)} fill={capColor} />
      <image
        href={artUrl}
        x={rect.x + artRect.x * rect.w}
        y={rect.y + artRect.y * rect.h}
        width={artRect.w * rect.w}
        height={artRect.h * rect.h}
        preserveAspectRatio="none"
        clipPath="url(#shape-cap-clip)"
        className={styles.topArt}
      />
      <rect
        x={design.switchAt.x - half}
        y={design.switchAt.y - half}
        width={half * 2}
        height={half * 2}
        rx={0.8}
        className={styles.topSwitch}
      />
      <path
        d={`M${design.switchAt.x - 2.2} ${design.switchAt.y}h4.4M${design.switchAt.x} ${design.switchAt.y - 2.2}v4.4`}
        className={styles.topSwitchMark}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 페이지
// ---------------------------------------------------------------------------

export default function ShapeClickerPage() {
  const { userRole } = useAuth();
  // 예시 모양은 캔버스로 그리므로 브라우저에서만 만든다 (서버에서 그릴 때는 비워 둔다)
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const [sampleId, setSampleId] = useState<SampleId>('heart');
  const sample = useMemo(() => (mounted ? makeSample(sampleId) : null), [mounted, sampleId]);
  const [uploaded, setUploaded] = useState<LogoAsset | null>(null);
  const logo = uploaded ?? sample;

  const [step, setStep] = useState<StepId>('logo');
  const [hasMoved, setHasMoved] = useState(false);
  const [forward, setForward] = useState(true);

  const [sizeMm, setSizeMm] = useState<number>(SHAPE_SPEC.size.initial);
  const [marginMm, setMarginMm] = useState<number>(SHAPE_SPEC.margin.initial);
  const [switchAt, setSwitchAt] = useState<{ u: number; v: number } | null>(null);
  const [showRing, setShowRing] = useState(true);
  const [lugAngle, setLugAngle] = useState<number | null>(null);
  /** 슬라이더나 스위치 자리를 끌고 있는 동안: 빨리 계산해서 따라오게 한다 */
  const [adjusting, setAdjusting] = useState(false);

  const [bodyColor, setBodyColor] = useState<ColorChoice>(BODY_COLORS[3]);
  const [capColor, setCapColor] = useState<ColorChoice>(CAP_COLORS[0]);
  const [exploded, setExploded] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerApiRef = useRef<ShapeClickerViewerApi | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const notify = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5200);
    return () => clearTimeout(timer);
  }, [notice]);

  // globals.css 의 body { overflow-x: hidden } 은 position: sticky 가 듣지 않게 한다.
  // 이 페이지에 있는 동안만 같은 모양의 clip 으로 바꿔 3D 화면과 아래쪽 이동 버튼이 화면에 붙어 있게 한다
  useEffect(() => {
    const { body } = document;
    const previous = body.style.overflowX;
    body.style.overflowX = 'clip';
    return () => {
      body.style.overflowX = previous;
    };
  }, []);

  // 드롭 영역을 살짝 벗어나 놓았을 때 브라우저가 그림 파일을 열어 작업이 날아가는 것을 막는다
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  // 끄는 중(빠른 계산) 표시는 손을 떼면 반드시 꺼진다: 슬라이더 밖에서 손을 떼도 놓치지 않게 창 전체에서 듣는다
  useEffect(() => {
    if (!adjusting) return;
    const stop = () => setAdjusting(false);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [adjusting]);

  // 뒤로 · 앞으로 가기로 단계를 오간다. 새로 고치면 작업이 사라지므로 주소에 남은 단계는 지운다
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    const onPop = () => {
      const wanted = new URLSearchParams(window.location.search).get('step');
      setHasMoved(true);
      setForward(false);
      setStep(isStepId(wanted) ? wanted : 'logo');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[stepIndex];
  const previous = stepIndex > 0 ? STEPS[stepIndex - 1] : null;
  const next = stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1] : null;

  const goTo = (id: StepId) => {
    if (id === step) return;
    setHasMoved(true);
    setForward(STEPS.findIndex((s) => s.id === id) > stepIndex);
    setStep(id);
    window.history.pushState(null, '', id === 'logo' ? window.location.pathname : `?step=${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 화면 낭독기가 바뀐 단계의 제목부터 읽도록
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  // ----- 모양 계산 -----

  const params = useMemo<ShapeParams>(
    () => ({ sizeMm, marginMm, switchAt, lug: showRing, lugAngle, draft: adjusting }),
    [sizeMm, marginMm, switchAt, showRing, lugAngle, adjusting],
  );
  // 계산이 끝나기를 기다리지 않고 슬라이더가 먼저 움직이게 한다
  const settled = useDeferredValue(params);
  const shape = useMemo<{ design: ShapeDesign | null; error: string | null }>(() => {
    if (!logo) return { design: null, error: null };
    try {
      return { design: computeShape(logo.source, settled), error: null };
    } catch (err) {
      return {
        design: null,
        error: err instanceof ShapeError ? err.message : '모양을 만들지 못했습니다. 다른 그림으로 시도해 주세요.',
      };
    }
  }, [logo, settled]);
  const { design } = shape;

  /** 뚜껑 윗면에 올릴 그림: 뚜껑 색 위에 로고를 그린다 */
  const face = useMemo(() => {
    if (!logo) return null;
    const canvas = document.createElement('canvas');
    canvas.width = logo.art.width;
    canvas.height = logo.art.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = capColor.hex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(logo.art, 0, 0);
    return canvas;
  }, [logo, capColor.hex]);

  /** 작은 미리보기 그림 (위에서 본 모습 · 올린 로고 표시용). 3D 윗면에는 줄이지 않은 그림을 쓴다 */
  const artUrl = useMemo(() => {
    if (!logo) return '';
    const scale = Math.min(1, 512 / Math.max(logo.art.width, logo.art.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(logo.art.width * scale));
    canvas.height = Math.max(1, Math.round(logo.art.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(logo.art, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }, [logo]);

  /** 올린 그림이 작아서 윗면 그림이 흐려 보일 수 있는지 */
  const lowResolution = uploaded !== null && uploaded.logoPixels < SHARP_LOGO_PIXELS;

  /** 스위치 자리를 옮긴다. 그림 밖으로는 나가지 않게 한다 (모양 밖을 고르면 가장 가까운 안쪽으로 붙는다) */
  const moveSwitch = (u: number, v: number) =>
    setSwitchAt({ u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) });

  // ----- 로고 올리기 -----

  const resetPlacement = () => {
    setSwitchAt(null);
    setLugAngle(null);
  };

  const addFile = async (file: File | undefined) => {
    if (!file || isLoading) return;
    setIsLoading(true);
    try {
      const asset = await loadLogoFile(file);
      // 올린 그림으로 실제로 모양이 만들어지는지 먼저 확인한다 (빈 그림 등)
      computeShape(asset.source, { sizeMm, marginMm, switchAt: null, lug: showRing, lugAngle: null, draft: true });
      setUploaded(asset);
      resetPlacement();
      notify(
        asset.logoPixels < SHARP_LOGO_PIXELS
          ? `그림이 작아서(로고 긴 쪽 약 ${Math.round(asset.logoPixels)}px) 윗면 그림이 흐리게 보일 수 있어요.`
          : BACKGROUND_NOTE[asset.background],
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : '그림을 처리하지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    void addFile(file);
  };

  const handleDrop = (e: ReactDragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void addFile(e.dataTransfer.files[0]);
  };

  const pickSample = (id: SampleId) => {
    setUploaded(null);
    setSampleId(id);
    resetPlacement();
  };

  // ----- 저장 -----

  const download = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const fileBase = `maker3d-shape-clicker-${(logo?.name ?? 'logo').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)}`;

  const handleSaveImage = () => {
    const url = viewerApiRef.current?.capture();
    if (!url) {
      notify('미리보기 이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    download(url, `${fileBase}.png`);
  };

  /** 출력용 파일(STL): 몸체와 누르는 곳을 따로 저장한다. 관리자에게만 보인다 */
  const handleSaveStl = async () => {
    if (!logo || isExporting) return;
    setIsExporting(true);
    try {
      const [{ buildPrintParts }, { exportSTL }] = await Promise.all([
        import('@/utils/shapeClicker/model'),
        import('@/utils/keycap/keycapGeometry'),
      ]);
      // 화면에 보이는 것이 빠른 계산(끄는 중)일 수 있으므로 저장할 때는 정밀하게 다시 계산한다
      const precise = computeShape(logo.source, { ...params, draft: false });
      const parts = buildPrintParts(precise);
      try {
        for (const [part, name] of [
          [parts.body, 'body'],
          [parts.cap, 'cap'],
        ] as const) {
          const url = URL.createObjectURL(await exportSTL(part));
          download(url, `${fileBase}-${name}.stl`);
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }
      } finally {
        parts.dispose();
      }
    } catch (err) {
      console.error(err);
      notify('출력용 파일을 만들지 못했어요.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewerApi = useCallback((api: ShapeClickerViewerApi | null) => {
    viewerApiRef.current = api;
  }, []);

  // 슬라이더를 끄는 동안에는 빨리 계산하고, 손을 떼면 정밀하게 다시 계산한다
  const sliderProps = {
    onPointerDown: () => setAdjusting(true),
    onPointerUp: () => setAdjusting(false),
    onPointerCancel: () => setAdjusting(false),
    onBlur: () => setAdjusting(false),
  };

  // -------------------------------------------------------------------------
  // 오른쪽 패널
  // -------------------------------------------------------------------------

  const renderLogoSide = () => (
    <div className={base.sidePanel}>
      <section className={base.card}>
        <div className={base.cardHeader}>
          <h3 className={base.cardTitle}>로고 그림</h3>
        </div>
        <div
          className={`${base.dropzone} ${isDragging ? base.dragging : ''}`}
          role="button"
          tabIndex={0}
          aria-label="로고 그림 올리기"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className={base.dropIcon}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4" />
              <path d="M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
          </div>
          <div className={base.dropText}>
            <p className={base.dropTitle}>
              {isLoading ? '그림을 읽는 중…' : uploaded ? '다른 로고로 바꾸기' : '로고를 끌어다 놓거나 눌러서 선택'}
            </p>
            <p className={base.dropHint}>PNG · JPG · SVG · 배경이 투명하거나 한 가지 색인 그림이 가장 좋아요</p>
          </div>
        </div>

        {uploaded && (
          <div className={styles.logoRow}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 방금 올린 그림을 그 자리에서 보여준다 (주소가 data: 라 최적화 대상이 아니다) */}
            <img className={styles.logoThumb} src={artUrl} alt="" />
            <div className={styles.logoText}>
              <p className={styles.logoName}>{uploaded.name}</p>
              <p className={base.optionHint}>{BACKGROUND_NOTE[uploaded.background]}</p>
            </div>
          </div>
        )}
        {lowResolution && uploaded && (
          <p className={styles.caution}>
            그림이 작아서(로고 긴 쪽 약 {Math.round(uploaded.logoPixels)}px) 윗면 그림이 흐리게 보일 수 있어요. 긴 쪽이{' '}
            {RECOMMENDED_LOGO_PIXELS}px 이상인 그림이나 SVG 파일을 올리면 또렷하게 나옵니다. 모양은 그대로 만들어집니다.
          </p>
        )}

        <div className={styles.sampleRow}>
          <span className={base.optionLabel}>예시 모양</span>
          <div className={base.chipGroup} role="group" aria-label="예시 모양">
            {SAMPLES.map((item) => {
              const active = !uploaded && sampleId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  className={`${base.chip} ${active ? base.chipActive : ''}`}
                  onClick={() => pickSample(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={base.tips}>
        <h3>이런 그림이 잘 나와요</h3>
        <ul>
          <li>윤곽이 뚜렷하고 한 덩어리로 이어진 모양 (심볼, 캐릭터, 아이콘)</li>
          <li>큰 그림일수록 윗면이 또렷합니다 (긴 쪽 {RECOMMENDED_LOGO_PIXELS}px 이상 또는 SVG 권장)</li>
          <li>글자만 있는 로고처럼 조각이 떨어져 있으면 자동으로 이어 붙입니다</li>
          <li>올린 그림은 어디에도 전송되거나 저장되지 않습니다</li>
        </ul>
      </section>
    </div>
  );

  const renderShapeSide = () => (
    <div className={base.sidePanel}>
      <section className={base.card}>
        <div className={base.cardHeader}>
          <h3 className={base.cardTitle}>크기와 여백</h3>
          {design && (
            <span className={base.cardMeta}>
              {design.size.width.toFixed(1)} × {design.size.depth.toFixed(1)} × {design.size.height.toFixed(1)} mm
            </span>
          )}
        </div>
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={base.optionLabel}>크기</span>
              <span className={styles.fieldValue}>{sizeMm} mm</span>
            </span>
            <input
              type="range"
              aria-label="크기 (긴 쪽 길이)"
              min={SHAPE_SPEC.size.min}
              max={SHAPE_SPEC.size.max}
              step={1}
              value={sizeMm}
              onChange={(e) => setSizeMm(Number(e.target.value))}
              {...sliderProps}
            />
            <span className={base.optionHint}>완성품의 긴 쪽 길이입니다. 클수록 로고 모양이 그대로 살아납니다.</span>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={base.optionLabel}>여백</span>
              <span className={styles.fieldValue}>{marginMm.toFixed(1)} mm</span>
            </span>
            <input
              type="range"
              aria-label="로고 둘레 여백"
              min={SHAPE_SPEC.margin.min}
              max={SHAPE_SPEC.margin.max}
              step={0.5}
              value={marginMm}
              onChange={(e) => setMarginMm(Number(e.target.value))}
              {...sliderProps}
            />
            <span className={base.optionHint}>로고 둘레에 두르는 띠입니다. 가는 부분이 많으면 늘려 주세요.</span>
          </label>
        </div>
      </section>

      <section className={base.card}>
        <div className={base.cardHeader}>
          <h3 className={base.cardTitle}>위에서 본 모습</h3>
          <button
            type="button"
            className={base.textBtn}
            disabled={switchAt === null}
            onClick={() => setSwitchAt(null)}
          >
            스위치 자리 자동
          </button>
        </div>
        {design ? (
          <TopView
            design={design}
            bodyColor={bodyColor.hex}
            capColor={capColor.hex}
            artUrl={artUrl}
            artRect={logo?.artRect ?? { x: 0, y: 0, w: 1, h: 1 }}
            onMoveSwitch={moveSwitch}
            onNudgeSwitch={(du, dv) => moveSwitch((switchAt ?? design.switchUV).u + du, (switchAt ?? design.switchUV).v + dv)}
            onDragChange={setAdjusting}
          />
        ) : (
          <p className={styles.topEmpty}>{shape.error ?? '모양을 만드는 중…'}</p>
        )}
        <ul className={styles.legend}>
          <li>
            <span className={styles.legendDot} style={{ backgroundColor: bodyColor.hex }} />
            몸체
          </li>
          <li>
            <span className={styles.legendDot} style={{ backgroundColor: capColor.hex }} />
            누르는 곳
          </li>
          <li>
            <span className={`${styles.legendDot} ${styles.legendSwitch}`} />
            스위치 자리 (끌어서 옮기기)
          </li>
        </ul>
        {design && (design.notes.seatAdded || design.notes.joined) && (
          <ul className={styles.notes}>
            {design.notes.seatAdded && (
              <li>스위치가 들어갈 자리가 모자라 그 부분을 넓혔어요. 크기를 키우면 로고 모양이 더 살아납니다.</li>
            )}
            {design.notes.joined && <li>떨어져 있는 조각을 다리로 이어 한 덩어리로 만들었어요.</li>}
          </ul>
        )}
      </section>

      <section className={base.card}>
        <div className={base.toggleRow}>
          <div>
            <span className={base.optionLabel}>키링 고리</span>
            <span className={base.optionHint}>몸체 옆에 고리를 달고 금속 링을 함께 보여줍니다</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showRing}
            aria-label="키링 고리"
            className={`${base.toggle} ${showRing ? base.toggleOn : ''}`}
            onClick={() => setShowRing((v) => !v)}
          >
            <span className={base.toggleKnob} />
          </button>
        </div>
        {showRing && (
          <div className={`${styles.field} ${styles.fieldTop}`}>
            <div className={styles.fieldHead}>
              <span className={base.optionLabel}>고리 위치</span>
              <button
                type="button"
                className={base.textBtn}
                disabled={lugAngle === null}
                onClick={() => setLugAngle(null)}
              >
                맨 위로
              </button>
            </div>
            <input
              type="range"
              aria-label="고리 위치"
              min={0}
              max={359}
              step={1}
              value={Math.round(lugAngle ?? design?.lugAngle ?? 0) % 360}
              onChange={(e) => setLugAngle(Number(e.target.value))}
              {...sliderProps}
            />
          </div>
        )}
      </section>
    </div>
  );

  const renderFinishSide = () => (
    <div className={base.sidePanel}>
      <section className={base.card}>
        <div className={base.cardHeader}>
          <h3 className={base.cardTitle}>색상 고르기</h3>
        </div>
        <div className={base.colorRow}>
          <div className={base.colorHead}>
            <span className={base.optionLabel}>몸체</span>
            <span className={base.colorName}>{bodyColor.name}</span>
          </div>
          <div className={base.swatches}>
            {BODY_COLORS.map((color) => (
              <button
                key={color.hex}
                type="button"
                title={color.name}
                aria-label={`몸체 ${color.name}`}
                aria-pressed={bodyColor.hex === color.hex}
                className={`${base.swatch} ${bodyColor.hex === color.hex ? base.swatchActive : ''}`}
                style={{ backgroundColor: color.hex }}
                onClick={() => setBodyColor(color)}
              />
            ))}
          </div>
        </div>
        <div className={base.colorRow}>
          <div className={base.colorHead}>
            <span className={base.optionLabel}>누르는 곳</span>
            <span className={base.colorName}>{capColor.name}</span>
          </div>
          <div className={base.swatches}>
            {CAP_COLORS.map((color) => (
              <button
                key={color.hex}
                type="button"
                title={color.name}
                aria-label={`누르는 곳 ${color.name}`}
                aria-pressed={capColor.hex === color.hex}
                className={`${base.swatch} ${capColor.hex === color.hex ? base.swatchActive : ''}`}
                style={{ backgroundColor: color.hex }}
                onClick={() => setCapColor(color)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={base.card}>
        <div className={base.cardHeader}>
          <h3 className={base.cardTitle}>내 쉐이프 클리커</h3>
        </div>
        <dl className={base.summaryList}>
          <div>
            <dt>로고</dt>
            <dd>{uploaded ? uploaded.name : `예시 모양 (${logo?.name ?? ''})`}</dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>
              {design
                ? `약 ${design.size.width.toFixed(1)} × ${design.size.depth.toFixed(1)} × ${design.size.height.toFixed(1)} mm`
                : '-'}
            </dd>
          </div>
          <div>
            <dt>구성</dt>
            <dd>몸체 · 키보드 스위치 1개 · 누르는 곳{showRing ? ' · 키링' : ''}</dd>
          </div>
          <div>
            <dt>스위치</dt>
            <dd>
              MX 규격, 구멍 {SHAPE_SPEC.switchHole} × {SHAPE_SPEC.switchHole} mm
            </dd>
          </div>
          <div>
            <dt>색상</dt>
            <dd className={base.summaryColors}>
              <span className={base.colorTag}>
                <span className={base.swatchSmall} style={{ backgroundColor: bodyColor.hex }} />
                몸체 {bodyColor.name}
              </span>
              <span className={base.colorTag}>
                <span className={base.swatchSmall} style={{ backgroundColor: capColor.hex }} />
                누르는 곳 {capColor.name}
              </span>
            </dd>
          </div>
        </dl>
        {userRole === 'admin' && (
          <>
            <button type="button" className={base.outlineBtn} onClick={handleSaveStl} disabled={isExporting || !design}>
              {isExporting ? '출력용 파일을 만드는 중…' : '출력용 파일(STL) 저장 · 관리자'}
            </button>
            <p className={base.cardNote}>
              몸체와 누르는 곳을 따로 저장합니다. 이 버튼은 관리자 계정으로 로그인했을 때만 보입니다.
            </p>
          </>
        )}
        <button type="button" className={`${base.textBtn} ${base.restartBtn}`} onClick={() => goTo('logo')}>
          다른 로고로 다시 만들기
        </button>
      </section>

      <section className={base.tips}>
        <h3>체험 페이지 안내</h3>
        <ul>
          <li>지금은 모양 만들기와 3D 미리보기만 해 볼 수 있는 체험 버전입니다</li>
          <li>올린 그림은 어디에도 전송되거나 저장되지 않습니다</li>
          <li>페이지를 새로 고치면 작업한 내용이 사라지니, 마음에 들면 이미지를 저장해 두세요</li>
        </ul>
      </section>
    </div>
  );

  // -------------------------------------------------------------------------
  // 렌더
  // -------------------------------------------------------------------------

  const footerHint =
    step === 'logo' ? (
      uploaded ? (
        <>올린 로고 모양대로 만든 클리커입니다. 드래그로 돌려 보고, 휠이나 두 손가락으로 확대하세요.</>
      ) : (
        <>지금은 예시 모양이 보이고 있어요. 로고를 올리면 그 모양대로 바뀝니다.</>
      )
    ) : step === 'shape' ? (
      <>
        <strong>분해해서 보기</strong>를 누르면 스위치가 들어가는 자리와 누르는 곳의 안쪽을 볼 수 있어요.
      </>
    ) : (
      <>
        드래그로 돌려 보고, 휠이나 두 손가락으로 확대하세요. <strong>누르는 곳을 누르면 눌러 볼 수 있어요.</strong>
      </>
    );

  const navInfo = design
    ? `${uploaded ? uploaded.name : `예시 · ${logo?.name ?? ''}`} · 약 ${Math.round(design.size.width)} × ${Math.round(design.size.depth)} mm`
    : (shape.error ?? '');

  return (
    <div className={base.container}>
      <div className={`${base.innerContainer} ${hasMoved ? base.motionOn : ''}`}>
        <div className={base.topBar}>
          {/* 좁은 화면에서는 첫 단계가 지나면 제목을 접어 3D 화면에 자리를 내준다 */}
          <h1 className={`${base.title} ${step === 'logo' ? '' : base.titleCompact}`}>
            쉐이프 클리커 만들기 <span className={base.beta}>BETA</span>
          </h1>

          <nav aria-label="만들기 단계">
            <ol className={base.stepper}>
              {STEPS.map((item, index) => {
                const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo';
                return (
                  <li key={item.id} className={`${base.stepperItem} ${base[`stepper_${state}`]}`}>
                    <button
                      type="button"
                      className={base.stepperBtn}
                      aria-current={state === 'current' ? 'step' : undefined}
                      onClick={() => goTo(item.id)}
                    >
                      <span className={base.stepperDot}>
                        {state === 'done' ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className={base.stepperLabel}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div key={step} className={`${base.stepHead} ${base.swapIn}`}>
          <h2 ref={headingRef} tabIndex={-1} className={base.stepTitle}>
            <span className={base.stepCount}>
              {stepIndex + 1}/{STEPS.length}
            </span>
            {current.title}
          </h2>
          <p className={base.stepDesc}>{current.description}</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.svg"
          className={base.hiddenInput}
          onChange={handleFileInput}
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className={base.stepBody}>
          <div className={base.workspace} data-direction={forward ? 'forward' : 'back'}>
            <section
              className={`${base.stageCard} ${step === 'shape' ? styles.stageSticky : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className={`${base.stageBody} ${step === 'shape' ? styles.stageCompact : ''}`}>
                <div className={base.stageLayer}>
                  <div className={base.viewer}>
                    <ShapeClickerViewer
                      design={design}
                      logoId={logo?.id ?? ''}
                      bodyColor={bodyColor.hex}
                      capColor={capColor.hex}
                      showRing={showRing}
                      face={face}
                      artRect={logo?.artRect}
                      exploded={exploded}
                      onApi={handleViewerApi}
                    />
                  </div>
                  <div className={base.viewerActions}>
                    <button
                      type="button"
                      className={`${base.ghostBtn} ${exploded ? styles.ghostOn : ''}`}
                      aria-pressed={exploded}
                      onClick={() => setExploded((v) => !v)}
                    >
                      {exploded ? '다시 조립하기' : '분해해서 보기'}
                    </button>
                    <button type="button" className={base.ghostBtn} onClick={() => viewerApiRef.current?.resetView()}>
                      시점 초기화
                    </button>
                  </div>
                  {isLoading && <div className={base.stageBadge}>그림을 읽는 중…</div>}
                  {shape.error && <div className={base.stageBadge}>{shape.error}</div>}
                </div>
              </div>
              <div className={`${base.stageFooter} ${step === 'shape' ? styles.footerHideNarrow : ''}`}>
                <p key={step} className={`${base.footerHint} ${base.swapIn}`}>
                  {footerHint}
                </p>
              </div>
            </section>

            <div className={base.side}>
              <div key={step} className={`${base.sideContent} ${base.sideIn}`}>
                {step === 'logo' ? renderLogoSide() : step === 'shape' ? renderShapeSide() : renderFinishSide()}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- 이전 / 다음 ---------------- */}
        <div className={base.wizardNav}>
          <button
            type="button"
            className={base.navBack}
            onClick={() => previous && goTo(previous.id)}
            disabled={!previous}
          >
            <ArrowIcon back />
            이전
          </button>
          <p key={navInfo} className={`${base.navInfo} ${base.fadeIn}`}>
            {navInfo}
          </p>
          {next ? (
            <button type="button" className={base.navNext} onClick={() => goTo(next.id)}>
              <span className={base.navNextPrefix}>다음</span>
              {next.label}
              <ArrowIcon />
            </button>
          ) : (
            <button type="button" className={`${base.navNext} ${base.navDone}`} onClick={handleSaveImage}>
              미리보기 이미지 저장
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div key={notice.id} className={base.toast} role="status">
          {notice.text}
        </div>
      )}
    </div>
  );
}
