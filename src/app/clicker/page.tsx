'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import { useAuth } from '@/contexts/AuthContext';
import { clearAfterLogin, setAfterLogin } from '@/utils/afterLogin';
import { loadDraft, saveDraft } from '@/utils/clicker/draftStore';
import { placeClickerOrder } from '@/utils/clicker/order';
import OrderModal, { CustomerInfo } from '@/components/OrderModal';
import LoginDialog, { type LoginDialogContent, type LoginDialogKind } from '@/components/clicker/LoginDialog';
import ClickerEditor, { PHOTO_DRAG_TYPE } from '@/components/ClickerEditor';
import type { ClickerViewerApi } from '@/components/ClickerViewer';
import {
  CLICKER_LAYOUT_LIST,
  CUSTOM_GRID,
  ClickerLayout,
  PRINT_FACE,
  PhotoMode,
  faceRect,
  findLayoutForGrid,
  getClickerSize,
  inGridRange,
  regionFor,
} from '@/utils/clicker/layouts';
import {
  MAX_FILE_SIZE,
  PhotoAsset,
  Placement,
  ZOOM_MAX,
  ZOOM_MIN,
  containZoom,
  createPlacement,
  disposePhoto,
  isImageFile,
  loadPhotoFile,
  renderFaceCanvas,
  rotatePlacement,
  zoomPlacement,
} from '@/utils/clicker/placement';
import {
  DesignState,
  MAX_PHOTOS,
  canUsePhoto,
  designReducer,
  getLayout,
  getMode,
  getPlacement,
  initialDesign,
  willPlaceUpload,
} from '@/utils/clicker/design';
import { loadCaseMesh } from '@/utils/clicker/caseMesh';
import { exportKeyFaces } from '@/utils/clicker/exportFaces';

const ClickerViewer = dynamic(() => import('@/components/ClickerViewer'), {
  ssr: false,
  loading: () => <div className={styles.viewerLoading}>3D 미리보기를 준비하는 중…</div>,
});

// ---------------------------------------------------------------------------
// 단계
// ---------------------------------------------------------------------------

const STEPS = [
  {
    id: 'type',
    label: '종류',
    title: '어떤 클리커를 만들까요?',
    description: '키 개수와 모양을 골라 주세요. 나중에 다시 바꿔도 올린 사진은 그대로 남아 있어요.',
  },
  {
    id: 'photos',
    label: '사진 넣기',
    title: '키캡에 넣을 사진을 올려 주세요',
    description: '여러 장을 한꺼번에 올리면 빈 키에 차례로 들어갑니다. 키를 누르면 그 키의 사진만 바꿀 수 있어요.',
  },
  {
    id: 'adjust',
    label: '위치 맞추기',
    title: '사진이 잘 보이게 맞춰 주세요',
    description: '사진을 끌어서 옮기고, 휠이나 두 손가락으로 크기를 조절하세요.',
  },
  {
    id: 'finish',
    label: '색상 · 완성',
    title: '색상을 고르고 완성된 모습을 확인하세요',
    description: '3D 화면을 돌려 보고 키캡도 눌러 보세요. 마음에 들면 이미지로 저장할 수 있어요.',
  },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const isStepId = (value: string | null): value is StepId => STEPS.some((s) => s.id === value);

/** 키에 들어간 사진이 하나라도 있는지 */
function hasPlacedPhoto(state: DesignState): boolean {
  if (getMode(state) === 'span') return state.span !== null;
  return getLayout(state).keys.some((key) => state.slots[key.index]);
}

/** 위치 맞추기부터는 사진이 한 장 이상 들어가 있어야 한다 */
function canEnterStep(id: StepId, state: DesignState): boolean {
  return id === 'type' || id === 'photos' || hasPlacedPhoto(state);
}

// ---------------------------------------------------------------------------
// 선택지
// ---------------------------------------------------------------------------

interface ColorChoice {
  name: string;
  hex: string;
}

const CASE_COLORS: ColorChoice[] = [
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

const KEYCAP_COLORS: ColorChoice[] = [
  { name: '화이트', hex: '#F6F6F3' },
  { name: '블랙', hex: '#27282C' },
  { name: '크림', hex: '#EFE6D3' },
  { name: '그레이', hex: '#B4B8BD' },
  { name: '스카이블루', hex: '#A9D3F0' },
  { name: '핑크', hex: '#F7C6D2' },
  { name: '민트', hex: '#B9E5D3' },
  { name: '라벤더', hex: '#D0C5EE' },
];

const MODE_OPTIONS: { key: PhotoMode; label: string; hint: string }[] = [
  { key: 'each', label: '키마다 한 장씩', hint: '키마다 서로 다른 사진을 넣습니다.' },
  {
    key: 'span',
    label: '한 장을 이어서',
    hint: '사진 한 장이 모든 키에 걸쳐 이어집니다. 키 사이 틈에 해당하는 부분은 보이지 않아요.',
  },
];

/** 3D 미리보기에서 키 하나에 쓰는 텍스처 크기 (px). 키가 많으면 메모리를 아끼려고 줄인다 */
const faceTextureSize = (keyCount: number) =>
  keyCount <= 4 ? 1024 : keyCount <= 6 ? 768 : keyCount <= 12 ? 640 : keyCount <= 36 ? 512 : 384;

/** 사진을 많이 올리면 한 장당 작업 해상도(긴 변, px)를 낮춘다. undefined 면 기본값 */
const workingSideFor = (photoCount: number) => (photoCount <= 12 ? undefined : photoCount <= 20 ? 1280 : 1024);
const NO_FACES: readonly (HTMLCanvasElement | null)[] = [];
const ZOOM_SLIDER_MIN = Math.log2(ZOOM_MIN);
const ZOOM_SLIDER_MAX = Math.log2(ZOOM_MAX);

/**
 * 종류 고르기 화면의 묶음. 여러 키가 한 줄로 늘어선 것과 그 밖의 것(1구, 두 줄 이상)으로 나눈다.
 * 지금 있는 모델은 두 묶음이 여섯 장씩이라, 한 줄에 여섯 장을 놓으면 빈칸 없이 줄이 맞는다
 */
const TYPE_GROUPS = [
  {
    id: 'row',
    title: '일자형',
    hint: '키가 한 줄로 나란히',
    layouts: CLICKER_LAYOUT_LIST.filter((l) => l.rows === 1 && l.cols > 1),
  },
  {
    id: 'grid',
    title: '사각형',
    hint: '1구 · 키가 두 줄 이상',
    layouts: CLICKER_LAYOUT_LIST.filter((l) => l.rows > 1 || l.cols === 1),
  },
].filter((group) => group.layouts.length > 0);

/** 종류 카드의 그림 칸 (mm 기준 최소 크기). 작은 모델은 이 축척 그대로, 큰 모델은 칸에 맞게 줄여 그린다 */
const ICON_BOX = { w: 88, h: 46 };

function LayoutIcon({ layout }: { layout: ClickerLayout }) {
  const scale = Math.max(1, (layout.caseWidth + 10) / ICON_BOX.w, (layout.caseDepth + 10) / ICON_BOX.h);
  const w = ICON_BOX.w * scale;
  const h = ICON_BOX.h * scale;
  const { lug } = layout;
  return (
    <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} className={styles.typeIcon} aria-hidden="true">
      {lug && (
        <rect
          x={lug.x + (lug.dx < 0 ? -lug.length : lug.dx > 0 ? 0 : -lug.thickness / 2) - (lug.dx === 0 ? 0.6 : 0)}
          y={lug.y + (lug.dy < 0 ? -lug.length : lug.dy > 0 ? 0 : -lug.thickness / 2) - (lug.dy === 0 ? 0.6 : 0)}
          width={(lug.dx === 0 ? lug.thickness : lug.length) + (lug.dx === 0 ? 1.2 : 0)}
          height={(lug.dy === 0 ? lug.thickness : lug.length) + (lug.dy === 0 ? 1.2 : 0)}
          rx={0.8}
          className={styles.typeIconCase}
        />
      )}
      <rect
        x={-layout.caseWidth / 2}
        y={-layout.caseDepth / 2}
        width={layout.caseWidth}
        height={layout.caseDepth}
        rx={layout.cornerRadius}
        className={styles.typeIconCase}
      />
      {layout.keys.map((key) => (
        <rect key={key.index} x={key.cx - 7.6} y={key.cy - 7.6} width={15.2} height={15.2} rx={2.6} className={styles.typeIconKey} />
      ))}
    </svg>
  );
}

/** 단계가 바뀔 때 화면이 넘어가는 시간 (ms). 이 동안은 이전 화면이 사라지는 모습도 함께 그린다. 스타일의 길이와 맞춘다 */
const STEP_MOTION_MS = 720;

/** 3D 화면이 나오는 단계 (나머지 단계는 위에서 본 2D 편집 화면) */
const isViewerStep = (id: StepId) => id === 'type' || id === 'finish';
/** 오른쪽 패널이 있는 단계 (위치 맞추기는 편집 화면만 크게 쓴다) */
const hasSidePanel = (id: StepId) => id !== 'adjust';

/**
 * 안의 내용 높이가 바뀌면 그 높이까지 부드럽게 늘어나거나 줄어드는 상자.
 * 단계마다 내용이 달라지는 자리(편집 화면 아래 도구 줄 등)가 뚝 끊기듯 바뀌지 않게 한다
 */
function SmoothHeight({ className, children }: { className?: string; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`${styles.smoothHeight} ${className ?? ''}`} style={height === null ? undefined : { height }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ArrowIcon = ({ back = false }: { back?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

// ---------------------------------------------------------------------------
// 로그인 안내 창
// ---------------------------------------------------------------------------

/**
 * entry : 로그인하지 않고 들어왔을 때. 로그인하거나, 그냥 만들어 보거나
 * order : 로그인하지 않고 주문하기를 눌렀을 때
 * (로그인한 사람이 주문하기를 누르면 이 창이 아니라 주문 정보 입력 창이 뜬다)
 */
type DialogKind = LoginDialogKind;

const DIALOGS: Record<DialogKind, LoginDialogContent> = {
  entry: {
    title: '로그인하고 시작할까요?',
    lines: [
      <>
        키보드 클리커를 만들고 <strong>주문까지 완료하려면 로그인이 필요해요.</strong>
      </>,
      '로그인하지 않아도 클리커를 만들어 볼 수는 있어요. 만들던 내용은 이 기기에 보관되니, 나중에 로그인해도 이어서 할 수 있어요.',
    ],
    primary: '로그인',
    secondary: '그냥 할래요',
  },
  order: {
    title: '주문하려면 로그인이 필요해요',
    lines: [
      '지금까지 만든 클리커는 이 기기에 그대로 보관돼요.',
      '로그인(또는 회원가입)하고 돌아오면 이어서 주문할 수 있어요.',
    ],
    primary: '로그인하러 가기',
    secondary: '계속 만들기',
  },
};

export default function ClickerPage() {
  const [design, dispatch] = useReducer(designReducer, initialDesign);
  const [step, setStep] = useState<StepId>('type');
  const [caseColor, setCaseColor] = useState<ColorChoice>(CASE_COLORS[3]);
  const [keycapColor, setKeycapColor] = useState<ColorChoice>(KEYCAP_COLORS[0]);
  const [showRing, setShowRing] = useState(true);
  const [isPanelDragging, setIsPanelDragging] = useState(false);
  const [loadingCount, setLoadingCount] = useState(0);
  const [isExportingFaces, setIsExportingFaces] = useState(false);
  /** 방금 떠난 단계와 넘어가는 방향. 화면이 넘어가는 동안(STEP_MOTION_MS)에만 값이 있다 */
  const [leaving, setLeaving] = useState<{ step: StepId; forward: boolean } | null>(null);
  const leaveTimer = useRef<number | null>(null);
  /** 단계를 한 번이라도 넘겼는지. 처음 열었을 때는 내용을 바로 보여 주고, 그 뒤로 넘어갈 때만 나타나는 움직임을 쓴다 */
  const [hasMoved, setHasMoved] = useState(false);
  /** 사진 넣기 단계에서, 고른 키로 편집 화면을 확대해 두었는지 (키를 직접 눌렀을 때만 켠다) */
  const [zoomed, setZoomed] = useState(false);
  /** 직접 입력: 가로 · 세로 칸에 넣은 숫자(한 글자, 비어 있을 수 있음)와 안내 문구 */
  const [grid, setGrid] = useState({ cols: '', rows: '' });
  const [gridError, setGridError] = useState<string | null>(null);
  const gridRowsRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 다음 파일 선택 결과를 넣을 키 (null 이면 빈 키부터 차례로) */
  const uploadTargetRef = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const viewerApiRef = useRef<ClickerViewerApi | null>(null);
  const photoCountRef = useRef(0);
  const knownPhotosRef = useRef<PhotoAsset[]>([]);

  // 로그인 여부와 안내 창
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  /** 들어올 때의 안내 창은 한 번만 띄운다 ("그냥 할래요"를 고른 뒤 다시 뜨지 않게) */
  const entryAsked = useRef(false);
  const [leavingToLogin, setLeavingToLogin] = useState(false);
  /** 주문 정보 입력 창 (로그인한 사람이 주문하기를 눌렀을 때) */
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  // 만들던 내용을 이 기기에 보관하기 (utils/clicker/draftStore)
  /** 보관해 둔 사진을 다시 불러오는 동안 */
  const [restoring, setRestoring] = useState(false);
  /** 보관해 둔 내용을 다 읽은 뒤에만 보관을 시작한다 (읽기 전에 빈 상태로 덮어쓰지 않게) */
  const persistReady = useRef(false);
  /** 사진 id → 올린 파일. 보관함에 넣을 때 쓴다 */
  const photoFiles = useRef(new Map<string, Blob>());
  /** 보관함에 이미 들어간 사진 id */
  const persistedIds = useRef(new Set<string>());
  /** 보관 작업을 한 줄로 세운다 (앞의 것이 끝난 뒤 다음 것) */
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const saveFailedOnce = useRef(false);

  const layout = getLayout(design);
  const mode = getMode(design);
  const keyCount = layout.keys.length;
  const selected = design.selected;
  // 선택이 풀리면 확대도 끝난다. 그래야 사진을 올려서 키가 저절로 선택될 때 갑자기 확대되지 않는다
  if (zoomed && selected === null) setZoomed(false);
  const photoMap = useMemo(() => new Map(design.photos.map((p) => [p.id, p])), [design.photos]);

  const activePlacement = selected !== null ? getPlacement(design, selected) : null;
  const activePhoto = activePlacement ? (photoMap.get(activePlacement.photoId) ?? null) : null;
  const activeRegion = useMemo(
    () => (selected !== null ? regionFor(layout, mode, selected) : null),
    [layout, mode, selected],
  );

  /** 사진이 들어간 키 (키마다 넣는 방식일 때) */
  const filledKeys = layout.keys.filter((key) => design.slots[key.index]);
  const filledCount = mode === 'span' ? (design.span ? keyCount : 0) : filledKeys.length;
  const hasPhotos = design.photos.length > 0;
  const hasPlaced = hasPlacedPhoto(design);

  /** 사진이 쓰이는 곳 표시 (사진 목록의 배지) */
  const usage = useMemo(() => {
    const map = new Map<string, string>();
    if (mode === 'span') {
      if (design.span) map.set(design.span.photoId, '전체');
      return map;
    }
    const numbers = new Map<string, number[]>();
    for (const key of layout.keys) {
      const slot = design.slots[key.index];
      if (!slot) continue;
      numbers.set(slot.photoId, [...(numbers.get(slot.photoId) ?? []), key.index + 1]);
    }
    numbers.forEach((list, id) => map.set(id, keyCount > 1 ? list.join('·') : '사용 중'));
    return map;
  }, [design.slots, design.span, layout, mode, keyCount]);

  // -------------------------------------------------------------------------
  // 알림
  // -------------------------------------------------------------------------

  const notify = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  // -------------------------------------------------------------------------
  // 단계 이동
  // -------------------------------------------------------------------------

  /** 단계에 들어설 때의 선택 상태를 정하고 화면을 바꾼다 */
  const enterStep = (next: StepId) => {
    if (next === 'adjust') {
      // 바로 맞출 수 있게 사진이 들어간 첫 키를 골라 둔다 (여기서부터 "다음 키"로 차례로 넘어간다)
      dispatch({ type: 'select', index: mode === 'span' ? 0 : (filledKeys[0]?.index ?? null) });
    } else {
      dispatch({ type: 'select', index: null });
    }
    // 이전 단계에서 띄운 안내가 새 화면에 남아 있지 않게 한다
    setNotice(null);
    if (next !== step) {
      setHasMoved(true);
      // 이전 화면을 잠깐 남겨 두고 사라지는 모습을 그린다 (그동안 새 화면이 나타난다)
      setLeaving({
        step,
        forward: STEPS.findIndex((s) => s.id === next) > STEPS.findIndex((s) => s.id === step),
      });
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
      leaveTimer.current = window.setTimeout(() => {
        leaveTimer.current = null;
        setLeaving(null);
      }, STEP_MOTION_MS);
    }
    setStep(next);
  };

  const goTo = (next: StepId) => {
    if (next === step) return;
    if (!canEnterStep(next, design)) {
      notify('사진을 한 장 이상 넣으면 다음 단계로 넘어갈 수 있어요.');
      return;
    }
    enterStep(next);
    // 단계마다 주소를 남겨 브라우저의 뒤로 가기로도 이전 단계로 돌아갈 수 있게 한다
    window.history.pushState(null, '', next === 'type' ? window.location.pathname : `?step=${next}`);
    // 아래로 내려가 있었다면 화면이 바뀌는 동안 맨 위로 부드럽게 올라간다
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  };

  /** 뒤로/앞으로 가기로 주소가 바뀌었을 때 */
  const syncFromHistory = () => {
    const id = new URLSearchParams(window.location.search).get('step');
    const target: StepId = isStepId(id) ? id : 'type';
    enterStep(canEnterStep(target, design) ? target : 'photos');
  };

  // 비동기 작업이나 창 이벤트에서 최신 상태를 보기 위한 참조
  const latest = useRef({ design, step, syncFromHistory });
  useEffect(() => {
    latest.current = { design, step, syncFromHistory };
  });

  useEffect(() => {
    // 첫 단계에서 시작한다. 보관해 둔 내용이 있으면 아래에서 되살린 뒤 하던 단계로 옮겨 간다
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    const onPopState = () => latest.current.syncFromHistory();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // -------------------------------------------------------------------------
  // 만들던 내용 보관 · 되살리기 (로그인 · 회원가입을 하고 돌아와도 이어서 만들 수 있게)
  // -------------------------------------------------------------------------

  // 보관할 때 가장 최근 상태를 보기 위한 참조
  const persistSource = useRef({ design, step, caseColor, keycapColor, showRing, grid });
  useEffect(() => {
    persistSource.current = { design, step, caseColor, keycapColor, showRing, grid };
  });

  /** 지금 상태를 이 기기에 보관한다. 새로 올린 사진은 넣고, 지운 사진은 뺀다 */
  const persistNow = useCallback((): Promise<void> => {
    if (!persistReady.current) return Promise.resolve();
    saveChain.current = saveChain.current.then(async () => {
      const now = persistSource.current;
      const files = photoFiles.current;
      const stored = persistedIds.current;
      const photos = now.design.photos.filter((photo) => files.has(photo.id));
      const keep = new Set(photos.map((photo) => photo.id));
      const added = photos
        .filter((photo) => !stored.has(photo.id))
        .map((photo) => ({ id: photo.id, name: photo.name, blob: files.get(photo.id)! }));
      const removed = [...stored].filter((id) => !keep.has(id));
      try {
        await saveDraft(
          {
            step: now.step,
            layoutId: now.design.layoutId,
            mode: now.design.mode,
            slots: now.design.slots,
            span: now.design.span,
            photos: photos.map((photo) => ({ id: photo.id, name: photo.name })),
            caseColor: now.caseColor.hex,
            keycapColor: now.keycapColor.hex,
            showRing: now.showRing,
            grid: now.grid,
          },
          added,
          removed,
        );
        for (const photo of added) stored.add(photo.id);
        for (const id of removed) {
          stored.delete(id);
          files.delete(id);
        }
      } catch (err) {
        console.warn('만들던 내용을 보관하지 못했습니다:', err);
        if (!saveFailedOnce.current) {
          saveFailedOnce.current = true;
          setNotice({
            id: Date.now(),
            text: '이 기기의 저장 공간이 부족해 만들던 내용을 보관하지 못했어요. 페이지를 떠나면 사라질 수 있어요.',
          });
        }
      }
    });
    return saveChain.current;
  }, []);

  // 들어왔을 때: 보관해 둔 내용이 있으면 되살린다
  useEffect(() => {
    // 로그인하고 돌아왔으면(또는 그냥 돌아왔으면) "로그인 뒤 돌아올 곳" 기록은 더 필요 없다
    clearAfterLogin();
    let cancelled = false;

    (async () => {
      const saved = await loadDraft();
      if (cancelled) return;
      if (!saved) {
        persistReady.current = true;
        return;
      }
      const { draft, files } = saved;
      const wanted = draft.photos.filter((item) => files.has(item.id));
      if (wanted.length > 0) setRestoring(true);

      const sideLimit = workingSideFor(wanted.length);
      const photos: PhotoAsset[] = [];
      const restoredFiles = new Map<string, Blob>();
      for (const item of wanted) {
        const blob = files.get(item.id)!;
        try {
          const asset = await loadPhotoFile(new File([blob], item.name, { type: blob.type }), sideLimit);
          if (cancelled) {
            disposePhoto(asset);
            break;
          }
          // 배치가 가리키는 id 를 그대로 쓴다
          photos.push({ ...asset, id: item.id });
          restoredFiles.set(item.id, blob);
        } catch (err) {
          console.warn('보관해 둔 사진을 다시 열지 못했습니다:', item.name, err);
        }
      }
      if (cancelled) {
        photos.forEach(disposePhoto);
        return;
      }

      const restore = {
        type: 'restore' as const,
        layoutId: draft.layoutId,
        mode: draft.mode,
        photos,
        slots: draft.slots,
        span: draft.span,
      };
      const restored = designReducer(initialDesign, restore);
      photoFiles.current = restoredFiles;
      persistedIds.current = new Set(files.keys());
      photoCountRef.current = photos.length;
      dispatch(restore);

      setCaseColor(CASE_COLORS.find((color) => color.hex === draft.caseColor) ?? CASE_COLORS[3]);
      setKeycapColor(KEYCAP_COLORS.find((color) => color.hex === draft.keycapColor) ?? KEYCAP_COLORS[0]);
      setShowRing(draft.showRing);
      setGrid(draft.grid);

      // 하던 단계로 돌아간다 (사진이 있어야 들어갈 수 있는 단계인데 사진을 되살리지 못했으면 사진 넣기로)
      const wantedStep: StepId = isStepId(draft.step) ? draft.step : 'type';
      const target: StepId = canEnterStep(wantedStep, restored) ? wantedStep : 'photos';
      if (target === 'adjust') {
        const firstFilled = getLayout(restored).keys.find((key) => restored.slots[key.index]);
        dispatch({ type: 'select', index: getMode(restored) === 'span' ? 0 : (firstFilled?.index ?? null) });
      }
      setStep(target);
      window.history.replaceState(null, '', target === 'type' ? window.location.pathname : `?step=${target}`);

      persistReady.current = true;
      setRestoring(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 바뀔 때마다 조금 뒤에 보관한다 (끌어서 옮기는 동안 매번 쓰지 않게)
  useEffect(() => {
    if (!persistReady.current) return;
    const timer = window.setTimeout(() => void persistNow(), 400);
    return () => window.clearTimeout(timer);
  }, [design.layoutId, design.mode, design.photos, design.slots, design.span, step, caseColor, keycapColor, showRing, grid, persistNow]);

  // 페이지를 떠나거나 탭을 닫을 때는 기다리지 않고 바로 보관한다
  useEffect(() => {
    const flush = () => void persistNow();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [persistNow]);

  // -------------------------------------------------------------------------
  // 로그인 안내
  // -------------------------------------------------------------------------

  // 로그인하지 않고 들어왔으면 안내 창을 띄운다. 로그인 여부를 확인하는 동안에는 띄우지 않는다
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      // 다른 탭에서 로그인한 경우 등: 로그인을 권하던 창은 닫는다
      setDialog(null);
      return;
    }
    if (!entryAsked.current) {
      entryAsked.current = true;
      setDialog('entry');
    }
  }, [authLoading, user]);

  /** 로그인 페이지로 보낸다. 만들던 내용을 먼저 보관하고, 로그인하면 이 페이지로 돌아오게 적어 둔다 */
  const goToLogin = async () => {
    if (leavingToLogin) return;
    setLeavingToLogin(true);
    await persistNow();
    setAfterLogin('/clicker');
    router.push('/login');
  };

  const handleOrder = () => {
    // 로그인 여부를 아직 확인하는 중이면 잠깐 기다리게 한다
    if (authLoading) {
      notify('로그인 상태를 확인하고 있어요. 잠시 후 다시 눌러 주세요.');
      return;
    }
    if (user) setIsOrderOpen(true);
    else setDialog('order');
  };

  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  // 단계가 바뀌면 제목으로 초점을 옮겨 화면이 바뀐 것을 알린다 (처음 들어왔을 때는 제외)
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  // 마지막 단계가 바로 뜨도록 고른 종류의 케이스 모델을 미리 받아 둔다 (직접 입력한 크기는 파일이 없다)
  useEffect(() => {
    if (layout.meshUrl) loadCaseMesh(layout.meshUrl).catch(() => {});
  }, [layout.meshUrl]);

  // -------------------------------------------------------------------------
  // 사진 불러오기 (모두 브라우저 안에서 처리)
  // -------------------------------------------------------------------------

  // 목록에서 빠진 사진은 캔버스 메모리를 바로 돌려준다
  useEffect(() => {
    for (const old of knownPhotosRef.current) {
      if (!design.photos.includes(old)) disposePhoto(old);
    }
    knownPhotosRef.current = design.photos;
    photoCountRef.current = design.photos.length;
  }, [design.photos]);

  const addFiles = useCallback(
    async (files: File[], target: number | null) => {
      const images = files.filter(isImageFile);
      if (images.length === 0) {
        if (files.length > 0) notify('이미지 파일만 올릴 수 있어요. (JPG · PNG · WebP 등)');
        return;
      }
      const room = MAX_PHOTOS - photoCountRef.current;
      if (room <= 0) {
        notify(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요. 쓰지 않는 사진을 지운 뒤 다시 올려 주세요.`);
        return;
      }
      const accepted = images.slice(0, room);
      photoCountRef.current += accepted.length;
      const sideLimit = workingSideFor(photoCountRef.current);

      setLoadingCount((c) => c + 1);
      const loaded: PhotoAsset[] = [];
      let tooLarge = 0;
      let failed = 0;
      for (const file of accepted) {
        if (file.size > MAX_FILE_SIZE) {
          tooLarge += 1;
          continue;
        }
        try {
          const asset = await loadPhotoFile(file, sideLimit);
          // 올린 파일을 기억해 둔다 (만들던 내용을 이 기기에 보관할 때 쓴다)
          photoFiles.current.set(asset.id, file);
          loaded.push(asset);
        } catch (err) {
          console.error('사진을 불러오지 못했습니다:', file.name, err);
          failed += 1;
        }
      }
      setLoadingCount((c) => c - 1);
      photoCountRef.current -= accepted.length - loaded.length;

      let keptInList = false;
      if (loaded.length > 0) {
        keptInList = !willPlaceUpload(latest.current.design, target);
        dispatch({ type: 'addPhotos', photos: loaded, target });
        // 사진 넣기 단계에서는 전체가 보이도록 선택을 풀어 둔다 (위치는 다음 단계에서 맞춘다)
        if (latest.current.step === 'photos') dispatch({ type: 'select', index: null });
      }

      if (failed > 0) {
        notify(`${failed}장은 열 수 없는 형식이에요. JPG · PNG · WebP 사진으로 올려 주세요.`);
      } else if (tooLarge > 0) {
        notify(`30MB가 넘는 사진 ${tooLarge}장은 제외했어요.`);
      } else if (images.length > accepted.length) {
        notify(`사진은 최대 ${MAX_PHOTOS}장까지라 ${accepted.length}장만 추가했어요.`);
      } else if (keptInList) {
        notify('사진 목록에 추가했어요. 바꿀 키를 누른 다음 사진을 골라 주세요.');
      }
    },
    [notify],
  );

  const openFilePicker = useCallback((target: number | null) => {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const target = uploadTargetRef.current;
    uploadTargetRef.current = null;
    void addFiles(files, target);
  };

  // 사이트 공통 스타일의 body { overflow-x: hidden } 은 body 를 스크롤 컨테이너로 만들어
  // position: sticky 가 듣지 않게 한다. 이 페이지에 있는 동안만 같은 모양의 clip 으로 바꿔
  // 편집 화면과 아래쪽 이동 버튼이 화면에 붙어 있게 한다. (clip 을 모르는 브라우저는 값을 무시하고 그대로 둔다)
  useEffect(() => {
    const { body } = document;
    const previous = body.style.overflowX;
    body.style.overflowX = 'clip';
    return () => {
      body.style.overflowX = previous;
    };
  }, []);

  // 드롭 영역을 살짝 벗어나 놓았을 때 브라우저가 사진 파일을 열어 작업이 날아가는 것을 막는다
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

  // -------------------------------------------------------------------------
  // 편집기 콜백
  // -------------------------------------------------------------------------

  // 편집 화면에서 사진이 든 키를 직접 누른 경우: 그 키를 고르고 그 키로 확대한다 (빈 곳 · "전체 보기"는 null 로 온다)
  const handleSelect = useCallback((index: number | null) => {
    dispatch({ type: 'select', index });
    setZoomed(index !== null);
  }, []);
  const handlePlace = useCallback(
    (index: number, placement: Placement) => dispatch({ type: 'place', index, placement }),
    [],
  );
  const handleRequestPhoto = useCallback(
    (index: number) => {
      dispatch({ type: 'select', index });
      // 올려 둔 사진이 없으면 바로 파일 선택 창을 연다. 있으면 아래에서 고른다
      if (photoCountRef.current === 0) openFilePicker(index);
    },
    [openFilePicker],
  );
  const handleDropPhoto = useCallback(
    (photoId: string, index: number) => dispatch({ type: 'usePhoto', photoId, target: index }),
    [],
  );
  const handleRemove = useCallback((index: number) => dispatch({ type: 'clear', index }), []);

  const handleUsePhoto = (photoId: string) => {
    if (!canUsePhoto(design)) {
      notify('모든 키에 사진이 들어 있어요. 바꿀 키를 먼저 눌러 선택해 주세요.');
      return;
    }
    dispatch({ type: 'usePhoto', photoId, target: null });
  };

  /** 직접 입력한 가로 × 세로를 고른다. 같은 배열의 준비된 모델이 있으면 그 모델이 선택된다 */
  const applyGrid = (cols: string, rows: string) => {
    if (cols === '' || rows === '') return;
    dispatch({ type: 'setLayout', layoutId: findLayoutForGrid(Number(cols), Number(rows)).id });
  };

  /** 숫자만 받는다. 칸에는 한 글자만 두고, 두 칸이 모두 차면 바로 적용한다 */
  const handleGridInput = (axis: 'cols' | 'rows', raw: string) => {
    const digits = raw.replace(/\D/g, '');
    // 숫자가 아닌 글자만 들어온 경우: 무시하고 원래 값을 그대로 둔다 (지운 경우에는 raw 가 빈 글자다)
    if (raw !== '' && digits === '') return;
    const digit = digits.slice(-1); // 마지막에 친 숫자 한 글자
    if (digit !== '' && !inGridRange(Number(digit))) {
      setGridError(`${CUSTOM_GRID.min}부터 ${CUSTOM_GRID.max}까지의 숫자만 넣을 수 있어요.`);
      return;
    }
    setGridError(null);
    const next = { ...grid, [axis]: digit };
    setGrid(next);
    applyGrid(next.cols, next.rows);
    // 가로를 넣으면 바로 세로 칸으로 넘어가 "5 5" 를 이어서 칠 수 있게 한다
    if (axis === 'cols' && digit !== '') {
      gridRowsRef.current?.focus();
      gridRowsRef.current?.select();
    }
  };

  /**
   * 키보드로 칠 때는 여기서 직접 처리한다: 글자 키는 막고, 숫자 키는 값이 같아도 반영한다.
   * (같은 숫자를 다시 치면 값이 바뀌지 않아 onChange 가 오지 않으므로 다음 칸으로 넘어가지 못한다.)
   * 화면 키보드처럼 어떤 키인지 알 수 없는 입력은 onChange 쪽에서 걸러진다.
   */
  const handleGridKeyDown = (axis: 'cols' | 'rows', e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return; // 방향키 · 지우기 · 단축키는 그대로
    e.preventDefault();
    if (/\d/.test(e.key)) handleGridInput(axis, e.key);
  };

  const handleClearPhotos = () => {
    if (!hasPhotos) return;
    if (!window.confirm('올린 사진과 배치를 모두 지울까요?')) return;
    dispatch({ type: 'reset' });
  };

  const handleRestart = () => {
    if (!window.confirm('지금까지 만든 내용을 지우고 처음부터 다시 시작할까요?')) return;
    dispatch({ type: 'reset' });
    goTo('type');
  };

  // -------------------------------------------------------------------------
  // 선택한 사진 조정
  // -------------------------------------------------------------------------

  const place = (next: Placement) => {
    if (selected !== null) dispatch({ type: 'place', index: selected, placement: next });
  };

  const setZoom = (zoom: number) => {
    if (!activePlacement) return;
    place(zoomPlacement(activePlacement, Math.abs(zoom - 1) < 0.03 ? 1 : zoom));
  };

  const setRotation = (deg: number) => {
    if (!activePlacement || !activePhoto || !activeRegion) return;
    const snapped = Math.round(deg / 90) * 90;
    place(rotatePlacement(activePlacement, activePhoto, activeRegion, Math.abs(deg - snapped) <= 3 ? snapped : deg));
  };

  /** 사진이 들어간 키들 사이를 차례로 옮겨 다닌다 */
  const filledPosition = filledKeys.findIndex((key) => key.index === selected);
  const stepKey = (delta: number) => {
    if (filledKeys.length === 0) return;
    const from = filledPosition < 0 ? (delta > 0 ? -1 : 0) : filledPosition;
    const next = filledKeys[(from + delta + filledKeys.length) % filledKeys.length];
    dispatch({ type: 'select', index: next.index });
  };

  // -------------------------------------------------------------------------
  // 3D 미리보기
  // -------------------------------------------------------------------------

  const viewerShown = isViewerStep(step);
  const editorShown = !viewerShown;
  // 떠나는 화면은 다 사라질 때까지 그대로 그린다
  const viewerMounted = viewerShown || (leaving !== null && isViewerStep(leaving.step));
  const editorMounted = editorShown || (leaving !== null && !isViewerStep(leaving.step));

  const faces = useMemo(() => {
    // 3D 화면이 보이는 동안(종류 고르기, 완성, 그리고 사라지는 중)에만 만든다
    if (!viewerMounted) return NO_FACES;
    return layout.keys.map((key) => {
      const placement = mode === 'span' ? design.span : (design.slots[key.index] ?? null);
      const photo = placement ? photoMap.get(placement.photoId) : undefined;
      if (!placement || !photo) return null;
      return renderFaceCanvas(
        faceTextureSize(layout.keys.length),
        faceRect(key),
        regionFor(layout, mode, key.index),
        photo,
        placement,
        keycapColor.hex,
      );
    });
  }, [viewerMounted, layout, mode, design.span, design.slots, photoMap, keycapColor.hex]);

  const handleViewerApi = useCallback((api: ClickerViewerApi | null) => {
    viewerApiRef.current = api;
  }, []);

  const download = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveImage = () => {
    const url = viewerApiRef.current?.capture();
    if (!url) {
      notify('미리보기 이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    download(url, `maker3d-clicker-${layout.label}.png`);
  };

  /**
   * 주문을 넣는다 (주문 정보 입력 창에서 이름 · 연락처를 받은 뒤).
   * 키캡 사진과 미리보기를 주문 폴더에 올리고 주문 문서를 만든다. 관리자 주문관리에 바로 나타난다.
   * 알림 메일은 보내지 않는다.
   */
  const submitOrder = async (customer: CustomerInfo): Promise<string> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    return placeClickerOrder({
      layout,
      mode,
      slots: design.slots,
      span: design.span,
      photos: photoMap,
      caseColor,
      keycapColor,
      showRing,
      previewDataUrl: viewerApiRef.current?.capture() ?? null,
      customer,
      userEmail: user.email ?? '',
    });
  };

  /** 키캡 윗면에 올라가는 사진만, 맞춰 둔 그대로 인쇄면 크기로 잘라 저장한다 */
  const handleSaveFaces = async () => {
    if (isExportingFaces) return;
    setIsExportingFaces(true);
    try {
      const result = await exportKeyFaces(layout, mode, design.slots, design.span, photoMap);
      if (!result) {
        notify('저장할 사진이 없어요. 먼저 키에 사진을 넣어 주세요.');
        return;
      }
      const url = URL.createObjectURL(result.blob);
      download(url, result.fileName);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify(
        result.count === 1 && keyCount === 1
          ? '키캡 사진을 저장했어요.'
          : `키캡 사진 ${result.count}장을 한 파일(ZIP)로 묶어 저장했어요.`,
      );
    } catch (err) {
      console.error('키캡 사진을 저장하지 못했습니다:', err);
      notify('키캡 사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsExportingFaces(false);
    }
  };

  // -------------------------------------------------------------------------
  // 화면 조각
  // -------------------------------------------------------------------------

  const size = getClickerSize(layout);
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[stepIndex];
  const previous = STEPS[stepIndex - 1];
  const next = STEPS[stepIndex + 1];
  const nextBlocked = next ? !canEnterStep(next.id, design) : false;
  const emptyCount = keyCount - filledCount;
  const selectionLabel = mode === 'span' ? '전체 사진' : keyCount > 1 ? `${(selected ?? 0) + 1}번 키` : '키 사진';
  const modeHint = MODE_OPTIONS.find((m) => m.key === design.mode)?.hint ?? '';

  // 위치 맞추기 단계에서는 고른 키를 늘 확대해 보여 주고, 사진 넣기 단계에서는 키를 직접 눌렀을 때만 확대한다
  const renderEditor = () => (
    <ClickerEditor
      layout={layout}
      mode={mode}
      photos={photoMap}
      slots={design.slots}
      span={design.span}
      selected={selected}
      caseColor={caseColor.hex}
      keycapColor={keycapColor.hex}
      focusSelected={step === 'adjust' || zoomed}
      onSelect={handleSelect}
      onPlacementChange={handlePlace}
      onRequestPhoto={handleRequestPhoto}
      onDropFiles={addFiles}
      onDropPhoto={handleDropPhoto}
      onRemove={handleRemove}
    />
  );

  const renderViewer = () => (
    <ClickerViewer
      layout={layout}
      caseColor={caseColor.hex}
      keycapColor={keycapColor.hex}
      showRing={showRing}
      faces={faces}
      className={styles.viewer}
      onApi={handleViewerApi}
    />
  );

  // ----- 1단계: 종류 -----
  // 모든 카드가 같은 짜임이다: 그림, 이름, 크기
  const renderTypeCard = (option: ClickerLayout) => {
    const active = option.id === layout.id;
    const size = `${Math.round(option.caseWidth)} × ${Math.round(option.caseDepth)} mm`;
    return (
      <button
        key={option.id}
        type="button"
        role="radio"
        aria-checked={active}
        // 카드에는 짧게 적고 모양은 그림으로 보여 주므로, 읽어 주는 이름과 풍선 도움말에는 전체 설명을 넣는다
        aria-label={`${option.label} ${option.description} ${size}`}
        title={`${option.label} · ${option.description}`}
        className={`${styles.typeCard} ${active ? styles.typeCardActive : ''}`}
        onClick={() => dispatch({ type: 'setLayout', layoutId: option.id })}
      >
        <span className={styles.typeIconBox}>
          <LayoutIcon layout={option} />
        </span>
        <span className={styles.typeLabel}>{option.label}</span>
        <span className={styles.typeSize}>{size}</span>
      </button>
    );
  };

  // 직접 입력 칸의 상태: 두 칸이 다 찼는지, 지금 고른 종류가 그 크기인지
  const gridFilled = grid.cols !== '' && grid.rows !== '';
  const gridActive = gridFilled && layout.cols === Number(grid.cols) && layout.rows === Number(grid.rows);

  const renderTypeSide = () => (
      <div className={styles.typePanel}>
        {/* 직접 입력: 가로 × 세로 숫자만 넣는다 */}
        <section className={`${styles.gridBox} ${gridActive ? styles.gridBoxActive : ''}`} aria-label="크기 직접 입력">
          <div className={styles.gridHead}>
            <h3 className={styles.gridTitle}>크기 직접 입력</h3>
            <span className={styles.gridHint}>
              가로 × 세로 · 각 {CUSTOM_GRID.min}~{CUSTOM_GRID.max}
            </span>
          </div>
          <div className={styles.gridFields}>
            {/* 빈 칸의 안내 글자는 placeholder 대신 직접 겹쳐 놓는다.
                placeholder 는 숫자용 큰 글자 줄에 맞춰져서, 작게 쓰면 칸 가운데보다 아래로 내려간다 */}
            <span className={styles.gridCell}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={styles.gridInput}
                value={grid.cols}
                aria-label="가로 키 수"
                autoComplete="off"
                onFocus={(e) => e.target.select()}
                onBlur={() => setGridError(null)}
                onKeyDown={(e) => handleGridKeyDown('cols', e)}
                onChange={(e) => handleGridInput('cols', e.target.value)}
              />
              {grid.cols === '' && (
                <span className={styles.gridGhost} aria-hidden="true">
                  가로
                </span>
              )}
            </span>
            <span className={styles.gridTimes} aria-hidden="true">
              ×
            </span>
            <span className={styles.gridCell}>
              <input
                ref={gridRowsRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className={styles.gridInput}
                value={grid.rows}
                aria-label="세로 키 수"
                autoComplete="off"
                onFocus={(e) => e.target.select()}
                onBlur={() => setGridError(null)}
                onKeyDown={(e) => handleGridKeyDown('rows', e)}
                onChange={(e) => handleGridInput('rows', e.target.value)}
              />
              {grid.rows === '' && (
                <span className={styles.gridGhost} aria-hidden="true">
                  세로
                </span>
              )}
            </span>
          </div>
          <div className={styles.gridResult}>
            {gridError ? (
              <span className={styles.gridError} role="alert">
                {gridError}
              </span>
            ) : gridActive ? (
              <>
                <span>
                  <strong>{layout.label}</strong>
                  {layout.description} · {Math.round(layout.caseWidth)} × {Math.round(layout.caseDepth)} mm
                </span>
                <span className={styles.gridNote}>
                  {layout.custom ? '준비된 모델에 없는 크기 · 같은 규격의 예상 모양' : '같은 크기의 준비된 모델로 골랐어요'}
                </span>
              </>
            ) : gridFilled ? (
              <button type="button" className={styles.gridApply} onClick={() => applyGrid(grid.cols, grid.rows)}>
                {grid.cols} × {grid.rows} 다시 고르기
              </button>
            ) : (
              <span>숫자를 넣으면 바로 3D 로 보여 드려요</span>
            )}
          </div>
        </section>

        <div className={styles.typeGroups} role="radiogroup" aria-label="클리커 종류">
          {TYPE_GROUPS.map((group) => (
            <section key={group.id} className={styles.typeGroup} aria-label={group.title}>
              <div className={styles.typeGroupHead}>
                <h3 className={styles.typeGroupTitle}>{group.title}</h3>
                <span className={styles.typeGroupHint}>{group.hint}</span>
              </div>
              <div className={styles.typeGrid}>{group.layouts.map(renderTypeCard)}</div>
            </section>
          ))}
        </div>
      </div>
  );

  // ----- 2단계: 사진 넣기 -----
  const renderPhotoPicker = () => {
    if (selected === null) {
      return (
        <p className={styles.footerHint}>
          {hasPlaced
            ? '사진이 들어간 키를 누르면 그 키가 크게 확대돼요. 끌어서 위치를 맞추고, 사진을 바꾸거나 뺄 수도 있어요.'
            : '키를 누르거나 사진을 끌어다 놓아 시작해 보세요. 여러 장을 한꺼번에 놓으면 빈 키에 차례로 들어갑니다.'}
        </p>
      );
    }
    return (
      <div className={styles.picker}>
        <div className={styles.pickerHead}>
          <p className={styles.pickerTitle}>
            {mode === 'span' ? '모든 키에 이어 붙일 사진' : `${selectionLabel}에 넣을 사진`}
          </p>
          {activePlacement && (
            <button
              type="button"
              className={`${styles.ghostBtn} ${styles.dangerBtn}`}
              onClick={() => dispatch({ type: 'clear', index: selected })}
            >
              사진 빼기
            </button>
          )}
        </div>
        <div className={styles.pickerList}>
          {design.photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className={`${styles.pickerThumb} ${activePlacement?.photoId === photo.id ? styles.pickerThumbActive : ''}`}
              title={photo.name}
              aria-label={`${photo.name} 넣기`}
              aria-pressed={activePlacement?.photoId === photo.id}
              onClick={() => dispatch({ type: 'usePhoto', photoId: photo.id, target: selected })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.thumbUrl} alt="" />
            </button>
          ))}
          <button type="button" className={styles.pickerAdd} onClick={() => openFilePicker(selected)}>
            <PlusIcon />
            새 사진 올리기
          </button>
        </div>
      </div>
    );
  };

  const renderPhotoSide = () => (
      <div className={styles.sidePanel}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>사진 올리기</h3>
            {hasPhotos && (
              <span className={styles.cardMeta}>
                {design.photos.length}/{MAX_PHOTOS}
              </span>
            )}
            {hasPhotos && (
              <button type="button" className={styles.textBtn} onClick={handleClearPhotos}>
                모두 지우기
              </button>
            )}
          </div>

          <div
            className={`${styles.dropzone} ${isPanelDragging ? styles.dragging : ''} ${hasPhotos ? styles.compact : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => openFilePicker(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFilePicker(null);
              }
            }}
            onDragOver={(e) => {
              if (!Array.from(e.dataTransfer.types).includes('Files')) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              setIsPanelDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsPanelDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsPanelDragging(false);
              void addFiles(Array.from(e.dataTransfer.files), null);
            }}
          >
            <div className={styles.dropIcon}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <div className={styles.dropText}>
              <p className={styles.dropTitle}>{hasPhotos ? '사진 더 올리기' : '사진을 끌어다 놓거나 눌러서 선택'}</p>
              <p className={styles.dropHint}>JPG · PNG · WebP · 여러 장을 한꺼번에 올릴 수 있어요</p>
            </div>
          </div>

          {hasPhotos && (
            <>
              <ul className={styles.tray}>
                {design.photos.map((photo) => {
                  const badge = usage.get(photo.id);
                  return (
                    <li key={photo.id} className={styles.trayItem}>
                      {/* button 요소는 일부 브라우저에서 끌기가 되지 않아 div 로 만든다 */}
                      <div
                        role="button"
                        tabIndex={0}
                        className={`${styles.trayThumb} ${badge ? styles.trayThumbUsed : ''}`}
                        title={photo.name}
                        aria-label={`${photo.name} 넣기`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(PHOTO_DRAG_TYPE, photo.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleUsePhoto(photo.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleUsePhoto(photo.id);
                          }
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.thumbUrl} alt="" draggable={false} />
                        {badge && <span className={styles.trayBadge}>{badge}</span>}
                      </div>
                      <button
                        type="button"
                        className={styles.trayRemove}
                        aria-label={`${photo.name} 삭제`}
                        onClick={() => dispatch({ type: 'deletePhoto', photoId: photo.id })}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className={styles.cardNote}>
                사진을 누르면 선택한 키(없으면 빈 키)에 들어갑니다. 키 위로 끌어다 놓아도 돼요.
              </p>
            </>
          )}
        </section>

        {keyCount > 1 && (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>사진 넣는 방식</h3>
            </div>
            <div className={styles.chipGroup}>
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={design.mode === option.key}
                  className={`${styles.chip} ${design.mode === option.key ? styles.chipActive : ''}`}
                  onClick={() => dispatch({ type: 'setMode', mode: option.key })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className={styles.cardNote}>{modeHint}</p>
          </section>
        )}

        <section className={styles.tips}>
          <h3>이런 사진이 잘 어울려요</h3>
          <ul>
            <li>얼굴이나 캐릭터처럼 주인공이 가운데 있는 사진</li>
            <li>키캡 윗면은 모서리가 둥근 정사각형이에요. 사진도 그 모양대로 잘리니, 주변에 여유가 있는 사진이 맞추기 쉽습니다</li>
            <li>배경이 투명한 PNG 로고는 키캡 색 위에 그대로 올라갑니다</li>
          </ul>
        </section>
      </div>
  );

  // ----- 3단계: 위치 맞추기 -----
  const renderAdjustToolbar = () => {
    if (selected === null || !activePlacement || !activePhoto || !activeRegion) {
      return <p className={styles.footerHint}>사진이 들어간 키를 누르면 위치 · 크기 · 회전을 맞출 수 있어요.</p>;
    }
    const zoomValue = Math.log2(activePlacement.zoom);
    const showKeyNav = mode === 'each' && filledKeys.length > 1;
    return (
      <div className={styles.adjust}>
        <div className={styles.adjustHead}>
          {showKeyNav && (
            <button type="button" className={styles.iconBtn} aria-label="이전 키" onClick={() => stepKey(-1)}>
              <ArrowIcon back />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activePhoto.thumbUrl} alt="" className={styles.adjustThumb} />
          <div className={styles.adjustTitle}>
            <strong>
              {selectionLabel}
              {showKeyNav && filledPosition >= 0 && (
                <em>
                  {filledPosition + 1} / {filledKeys.length}
                </em>
              )}
            </strong>
            <span>드래그로 옮기고 휠 · 두 손가락으로 크기 조절</span>
          </div>
          {showKeyNav && (
            <button type="button" className={styles.iconBtn} aria-label="다음 키" onClick={() => stepKey(1)}>
              <ArrowIcon />
            </button>
          )}
          <div className={styles.quickRow}>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => place({ ...activePlacement, zoom: 1, x: 0, y: 0 })}
            >
              가득 채우기
            </button>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() =>
                place({
                  ...activePlacement,
                  zoom: containZoom(activePhoto, activeRegion, activePlacement.rotation),
                  x: 0,
                  y: 0,
                })
              }
            >
              전체 보이기
            </button>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => place(createPlacement(activePlacement.photoId))}
            >
              처음 상태로
            </button>
          </div>
        </div>

        <div className={styles.sliders}>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>크기</span>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="작게"
              onClick={() => setZoom(activePlacement.zoom / 1.1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14" />
              </svg>
            </button>
            <input
              type="range"
              aria-label="사진 크기"
              min={ZOOM_SLIDER_MIN}
              max={ZOOM_SLIDER_MAX}
              step={0.01}
              value={zoomValue}
              onChange={(e) => setZoom(Math.pow(2, Number(e.target.value)))}
            />
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="크게"
              onClick={() => setZoom(activePlacement.zoom * 1.1)}
            >
              <PlusIcon />
            </button>
            <span className={styles.sliderValue}>{Math.round(activePlacement.zoom * 100)}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>회전</span>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="왼쪽으로 90도 회전"
              onClick={() => setRotation(activePlacement.rotation - 90)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
            <input
              type="range"
              aria-label="사진 회전"
              min={-179}
              max={180}
              step={1}
              value={activePlacement.rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="오른쪽으로 90도 회전"
              onClick={() => setRotation(activePlacement.rotation + 90)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 4v5h-5" />
              </svg>
            </button>
            <span className={styles.sliderValue}>{Math.round(activePlacement.rotation)}°</span>
          </div>
        </div>
      </div>
    );
  };

  // ----- 4단계: 색상 · 완성 -----
  const renderFinishSide = () => (
      <div className={styles.sidePanel}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>색상 고르기</h3>
          </div>

          <div className={styles.colorRow}>
            <div className={styles.colorHead}>
              <span className={styles.optionLabel}>케이스</span>
              <span className={styles.colorName}>{caseColor.name}</span>
            </div>
            <div className={styles.swatches}>
              {CASE_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  title={color.name}
                  aria-label={`케이스 ${color.name}`}
                  aria-pressed={caseColor.hex === color.hex}
                  className={`${styles.swatch} ${caseColor.hex === color.hex ? styles.swatchActive : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => setCaseColor(color)}
                />
              ))}
            </div>
          </div>

          <div className={styles.colorRow}>
            <div className={styles.colorHead}>
              <span className={styles.optionLabel}>키캡</span>
              <span className={styles.colorName}>{keycapColor.name}</span>
            </div>
            <div className={styles.swatches}>
              {KEYCAP_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  title={color.name}
                  aria-label={`키캡 ${color.name}`}
                  aria-pressed={keycapColor.hex === color.hex}
                  className={`${styles.swatch} ${keycapColor.hex === color.hex ? styles.swatchActive : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => setKeycapColor(color)}
                />
              ))}
            </div>
          </div>

          <div className={styles.toggleRow}>
            <div>
              <span className={styles.optionLabel}>키링 고리</span>
              <span className={styles.optionHint}>금속 링을 함께 보여줍니다</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showRing}
              aria-label="키링 고리"
              className={`${styles.toggle} ${showRing ? styles.toggleOn : ''}`}
              onClick={() => setShowRing((v) => !v)}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>내 클리커</h3>
          </div>
          <dl className={styles.summaryList}>
            <div>
              <dt>종류</dt>
              <dd>
                {layout.label} · {layout.description}
              </dd>
            </div>
            <div>
              <dt>크기</dt>
              <dd>
                약 {size.width.toFixed(1)} × {size.depth.toFixed(1)} × {size.height.toFixed(1)} mm
              </dd>
            </div>
            <div>
              <dt>사진</dt>
              <dd>
                {mode === 'span' ? `한 장을 ${keyCount}개 키에 이어서` : `${keyCount}개 키 중 ${filledCount}개에 넣음`}
              </dd>
            </div>
            <div>
              <dt>인쇄면</dt>
              <dd>
                키마다 {PRINT_FACE.toFixed(1)} × {PRINT_FACE.toFixed(1)} mm
              </dd>
            </div>
            <div>
              <dt>색상</dt>
              <dd className={styles.summaryColors}>
                <span className={styles.colorTag}>
                  <span className={styles.swatchSmall} style={{ backgroundColor: caseColor.hex }} />
                  케이스 {caseColor.name}
                </span>
                <span className={styles.colorTag}>
                  <span className={styles.swatchSmall} style={{ backgroundColor: keycapColor.hex }} />
                  키캡 {keycapColor.name}
                </span>
              </dd>
            </div>
          </dl>
          <button type="button" className={styles.outlineBtn} onClick={handleSaveImage}>
            미리보기 이미지 저장
          </button>
          <button type="button" className={styles.outlineBtn} onClick={handleSaveFaces} disabled={isExportingFaces}>
            {isExportingFaces ? '사진을 자르는 중…' : '키캡 사진만 잘라서 저장'}
          </button>
          <p className={styles.cardNote}>
            맞춰 둔 그대로, 키캡 윗면 크기({PRINT_FACE.toFixed(1)} × {PRINT_FACE.toFixed(1)} mm)에 딱 맞게 키마다 한 장씩
            잘라 줍니다.
          </p>
          <button type="button" className={`${styles.textBtn} ${styles.restartBtn}`} onClick={handleRestart}>
            처음부터 다시 만들기
          </button>
        </section>

        <section className={styles.tips}>
          <h3>안내</h3>
          <ul>
            <li>주문하기 전까지는 올린 사진이 서버로 전송되지 않습니다</li>
            <li>주문하면 키캡에 들어갈 사진과 미리보기 이미지가 제작을 위해 MAKER3D로 전송됩니다</li>
            <li>
              만들던 내용은 이 기기(브라우저)에만 하루 동안 보관됩니다. 로그인하고 돌아오거나 새로 고쳐도 이어서 만들 수
              있어요
            </li>
          </ul>
        </section>
      </div>
  );

  // ----- 네 단계가 함께 쓰는 작업 화면 -----
  // 왼쪽 무대(3D 또는 편집 화면)는 계속 남아 있고 폭만 바뀐다. 오른쪽 패널과 무대 아래 줄은 단계에 맞는 내용으로 바뀐다

  const renderSide = (id: StepId) => {
    if (id === 'type') return renderTypeSide();
    if (id === 'photos') return renderPhotoSide();
    if (id === 'finish') return renderFinishSide();
    return null;
  };

  /** 무대 아래 줄: 안내 한 줄, 사진 고르기, 조정 도구 중 하나. 종류가 바뀔 때마다 새로 나타난다 */
  const stageFooter = ((): { kind: string; node: ReactNode } => {
    if (step === 'type') {
      return {
        kind: 'type',
        node: (
          <p className={styles.footerHint}>
            {layout.custom
              ? '직접 입력한 크기는 준비된 모델과 같은 규격으로 만든 예상 모양입니다. 드래그로 돌려 볼 수 있어요.'
              : '고른 클리커의 실제 모양입니다. 드래그로 돌려 보고, 휠이나 두 손가락으로 확대하세요.'}
          </p>
        ),
      };
    }
    if (step === 'photos') return { kind: selected === null ? 'photos-hint' : 'photos-picker', node: renderPhotoPicker() };
    if (step === 'adjust') {
      const ready = selected !== null && activePlacement && activePhoto && activeRegion;
      return { kind: ready ? 'adjust-tools' : 'adjust-hint', node: renderAdjustToolbar() };
    }
    return {
      kind: 'finish',
      node: (
        <p className={styles.footerHint}>
          드래그로 돌려 보고, 휠이나 두 손가락으로 확대하세요. <strong>키캡을 누르면 눌러 볼 수 있어요.</strong>
        </p>
      ),
    };
  })();

  const sideSteps = STEPS.map((s) => s.id).filter(
    (id) => hasSidePanel(id) && (id === step || id === leaving?.step),
  );
  const renderWorkspace = () => (
    <>
      <div
        className={`${styles.workspace} ${styles[`ws_${step}`]} ${leaving ? styles.wsMoving : ''}`}
        data-direction={leaving ? (leaving.forward ? 'forward' : 'back') : undefined}
      >
        <section className={styles.stageCard}>
          <div className={styles.stageBody}>
            {viewerMounted && (
              <div
                key="viewer"
                className={`${styles.stageLayer} ${viewerShown ? styles.layerIn : styles.layerOut}`}
                inert={!viewerShown}
              >
                {renderViewer()}
                {step === 'type' && (
                  <div className={styles.viewerLabel}>
                    {layout.label} · {layout.description}
                  </div>
                )}
                {step === 'finish' && (
                  <div className={styles.viewerActions}>
                    <button type="button" className={styles.ghostBtn} onClick={() => viewerApiRef.current?.resetView()}>
                      시점 초기화
                    </button>
                  </div>
                )}
              </div>
            )}
            {editorMounted && (
              <div
                key="editor"
                className={`${styles.stageLayer} ${editorShown ? styles.layerIn : styles.layerOut}`}
                inert={!editorShown}
              >
                {renderEditor()}
                {step === 'photos' && loadingCount > 0 && <div className={styles.stageBadge}>사진을 불러오는 중…</div>}
              </div>
            )}
          </div>
          <SmoothHeight>
            <div key={stageFooter.kind} className={`${styles.stageFooter} ${styles.swapIn}`}>
              {stageFooter.node}
            </div>
          </SmoothHeight>
        </section>

        <div className={styles.side}>
          {sideSteps.map((id) => (
            <div
              key={id}
              data-side={id}
              className={`${styles.sideContent} ${id === 'type' ? styles.side_type : ''} ${
                id === step ? styles.sideIn : styles.sideOut
              }`}
              inert={id !== step}
            >
              {renderSide(id)}
            </div>
          ))}
        </div>
      </div>

      {/* 위치 맞추기 단계에서만 편집 화면 아래에 펼쳐지는 안내 */}
      <SmoothHeight className={styles.belowStage}>
        {step === 'adjust' && (
          <section className={`${styles.tips} ${styles.tipsRow} ${styles.swapIn}`}>
            <h3>맞추는 방법</h3>
            <ul>
              <li>키를 누르면 선택되고, 드래그로 사진 위치를 옮깁니다</li>
              <li>마우스 휠 · 두 손가락 벌리기 · 슬라이더로 크기를 조절합니다</li>
              <li>키보드 방향키로 조금씩 움직일 수 있어요</li>
            </ul>
          </section>
        )}
      </SmoothHeight>
    </>
  );

  // -------------------------------------------------------------------------
  // 렌더
  // -------------------------------------------------------------------------

  const navInfo = (() => {
    if (step === 'type') return `${layout.label} · ${layout.description} · 약 ${Math.round(size.width)} × ${Math.round(size.depth)} mm`;
    if (step === 'photos') {
      if (!hasPlaced) return '사진을 한 장 이상 넣어 주세요';
      if (mode === 'each' && emptyCount > 0) return `빈 키 ${emptyCount}개는 키캡 색 그대로 둡니다`;
    }
    const photoInfo = mode === 'span' ? '사진 한 장을 이어서' : `사진 ${filledCount}/${keyCount}`;
    return `${layout.label} · ${layout.description} · ${photoInfo}`;
  })();

  return (
    <div className={styles.container}>
      <div className={`${styles.innerContainer} ${hasMoved ? styles.motionOn : ''}`} inert={restoring}>
        <div className={styles.topBar}>
          {/* 좁은 화면에서는 첫 단계가 지나면 제목을 접어 편집 화면에 자리를 내준다 */}
          <h1 className={`${styles.title} ${step === 'type' ? '' : styles.titleCompact}`}>
            키보드 클리커 만들기 <span className={styles.beta}>BETA</span>
          </h1>

          <nav aria-label="만들기 단계">
            <ol className={styles.stepper}>
              {STEPS.map((item, index) => {
                const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo';
                const reachable = canEnterStep(item.id, design);
                return (
                  <li key={item.id} className={`${styles.stepperItem} ${styles[`stepper_${state}`]}`}>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      aria-current={state === 'current' ? 'step' : undefined}
                      disabled={!reachable}
                      onClick={() => goTo(item.id)}
                    >
                      <span className={styles.stepperDot}>
                        {state === 'done' ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className={styles.stepperLabel}>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div key={step} className={`${styles.stepHead} ${styles.swapIn}`}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
            <span className={styles.stepCount}>
              {stepIndex + 1}/{STEPS.length}
            </span>
            {current.title}
          </h2>
          <p className={styles.stepDesc}>{current.description}</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.hiddenInput}
          onChange={handleFileInput}
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className={styles.stepBody}>{renderWorkspace()}</div>

        {/* ---------------- 이전 / 다음 ---------------- */}
        <div className={styles.wizardNav}>
          <button
            type="button"
            className={styles.navBack}
            onClick={() => previous && goTo(previous.id)}
            disabled={!previous}
          >
            <ArrowIcon back />
            이전
          </button>
          <p key={navInfo} className={`${styles.navInfo} ${styles.fadeIn}`}>
            {navInfo}
          </p>
          {next ? (
            <button
              type="button"
              className={`${styles.navNext} ${nextBlocked ? styles.navNextBlocked : ''}`}
              aria-disabled={nextBlocked}
              onClick={() => goTo(next.id)}
            >
              <span className={styles.navNextPrefix}>다음</span>
              {next.label}
              <ArrowIcon />
            </button>
          ) : (
            <button type="button" className={`${styles.navNext} ${styles.navDone}`} onClick={handleOrder}>
              주문하기
            </button>
          )}
        </div>
      </div>

      {/* 보관해 둔 사진을 다시 불러오는 동안: 잠깐 가려 두고 기다리게 한다 */}
      {restoring && (
        <div className={styles.restoreVeil} role="status">
          <span className={styles.restoreSpinner} aria-hidden="true" />
          만들던 클리커를 불러오는 중…
        </div>
      )}

      {notice && (
        <div key={notice.id} className={styles.toast} role="status">
          {notice.text}
        </div>
      )}

      {dialog && (
        <LoginDialog
          kind={dialog}
          content={DIALOGS[dialog]}
          busy={leavingToLogin}
          onPrimary={goToLogin}
          onClose={() => setDialog(null)}
        />
      )}

      {/* 주문 정보 입력 (실시간 견적 · 키캡제작과 같은 창). 가격은 아직 정해져 있지 않아 상담 후 안내한다 */}
      <OrderModal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        onSubmit={() => {}}
        onNaverPayOrder={submitOrder}
        totalPrice={0}
        fileCount={filledCount}
        summaryItems={[
          { label: '상품', value: `키보드 클리커 ${layout.label}` },
          { label: '색상', value: `케이스 ${caseColor.name} · 키캡 ${keycapColor.name}` },
          { label: '금액', value: '상담 후 안내' },
        ]}
        submitLabel="주문하기"
        successTitle="주문 접수 완료"
        successMessage="키보드 클리커 주문이 접수되었습니다."
      />
    </div>
  );
}
