'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type * as THREE from 'three';
import styles from './page.module.scss';
import { useAuth } from '@/contexts/AuthContext';
import OrderModal, { CustomerInfo } from '@/components/OrderModal';
import { generateOrderNumber, uploadSTLFiles, saveOrder, OrderData, KeycapOrderSpec } from '@/utils/orderUtils';
import { getMaterialColors, ColorOption, TRANSPARENT_SENTINEL } from '@/services/colorService';
import {
  processImageFile,
  maskToPolygons,
  renderQuantizedPreview,
  nearestColorIndex,
  QuantizedImage,
} from '@/utils/keycap/imageProcessing';
import {
  buildKeycapModel,
  disposeKeycapModel,
  exportSTL,
  getKeycapDimensions,
  ColorLayer,
  KeycapModel,
} from '@/utils/keycap/keycapGeometry';

const KeycapViewer = dynamic(() => import('@/components/KeycapViewer'), { ssr: false });

const MATERIAL = 'PLA';
const MAX_IMAGE_SIZE = 800;        // 긴 변 기준 픽셀 (원본이 작으면 확대하지 않음)
const SIMPLIFY_TOLERANCE = 0.02;   // mm
const COLOR_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];
const MAX_RECOMMENDED_FILAMENTS = 4;

type DetailLevel = 'fine' | 'normal' | 'simple';
const DETAIL_OPTIONS: { key: DetailLevel; label: string; minArea: number; noisePasses: number; hint: string }[] = [
  { key: 'fine', label: '세밀', minArea: 0.08, noisePasses: 1, hint: '약 0.3mm 크기의 조각까지 남깁니다. 0.4mm 노즐로는 일부가 표현되지 않을 수 있습니다.' },
  { key: 'normal', label: '보통', minArea: 0.2, noisePasses: 1, hint: '약 0.45mm보다 작은 조각은 정리합니다. 대부분의 로고에 알맞습니다.' },
  { key: 'simple', label: '단순', minArea: 0.5, noisePasses: 2, hint: '약 0.7mm보다 작은 조각과 잡티를 정리해 깔끔하게 출력합니다.' },
];
const WIDTH_OPTIONS = [
  { units: 1, label: '1u' },
  { units: 1.25, label: '1.25u' },
  { units: 1.5, label: '1.5u' },
  { units: 2, label: '2u' },
];
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/bmp';

type LayerTarget = number | 'remove';
type ProcessState = 'idle' | 'processing' | 'error';
type QuoteState = 'idle' | 'loading' | 'error';

interface Quote {
  price: number;
  printTime: string;
  modelVersion: number;
}

function sanitizeFileBase(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return base.slice(0, 24) || 'keycap';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MakeKeycapPage() {
  const router = useRouter();
  const { user, userRole } = useAuth();

  // 이미지
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 색상 처리
  const [colorCount, setColorCount] = useState(3);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('fine');
  const detail = DETAIL_OPTIONS.find((d) => d.key === detailLevel) ?? DETAIL_OPTIONS[0];
  const [quantized, setQuantized] = useState<QuantizedImage | null>(null);
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [processError, setProcessError] = useState('');
  const [layerMap, setLayerMap] = useState<LayerTarget[]>([]);
  const [filaments, setFilaments] = useState<ColorOption[]>([]);

  // 키캡 설정
  const [widthUnits, setWidthUnits] = useState(1);
  const [height, setHeight] = useState(9);
  const [embossHeight, setEmbossHeight] = useState(0.6);
  const [imageScale, setImageScale] = useState(0.9);
  const [baseColorIdx, setBaseColorIdx] = useState(0);

  // 모델
  const modelRef = useRef<KeycapModel | null>(null);
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);
  const [modelVersion, setModelVersion] = useState(0);
  const [triangleCount, setTriangleCount] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);

  // 견적 / 주문
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteState, setQuoteState] = useState<QuoteState>('idle');
  const [quoteError, setQuoteError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const params = useMemo(
    () => ({
      widthUnits,
      height,
      embossHeight,
      imageScale,
      baseColorHex: filaments[baseColorIdx]?.hex ?? '#F5F5F0',
    }),
    [widthUnits, height, embossHeight, imageScale, filaments, baseColorIdx],
  );
  const dims = useMemo(() => getKeycapDimensions(params), [params]);

  // 필라멘트 색상 로드 (PLA, 사용 가능 색상만)
  useEffect(() => {
    getMaterialColors(MATERIAL).then((colors) => {
      const usable = colors.filter((c) => c.available && c.hex !== TRANSPARENT_SENTINEL);
      setFilaments(usable);
      const whiteIdx = usable.findIndex((c) => c.name === '화이트');
      setBaseColorIdx(whiteIdx >= 0 ? whiteIdx : 0);
    });
  }, []);

  // 원본 미리보기 URL
  useEffect(() => {
    if (!imageFile) {
      setSourceUrl('');
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // 이미지 → 색상 양자화
  useEffect(() => {
    if (!imageFile) {
      setQuantized(null);
      setProcessState('idle');
      return;
    }
    let cancelled = false;
    setProcessState('processing');
    setProcessError('');
    processImageFile(imageFile, { colorCount, removeBackground, maxSize: MAX_IMAGE_SIZE, noisePasses: detail.noisePasses })
      .then((q) => {
        if (cancelled) return;
        setQuantized(q);
        setProcessState('idle');
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setQuantized(null);
        setProcessState('error');
        setProcessError(err.message || '이미지 처리 중 오류가 발생했습니다.');
      });
    return () => {
      cancelled = true;
    };
  }, [imageFile, colorCount, removeBackground, detail.noisePasses]);

  // 팔레트가 바뀌면 가장 가까운 필라멘트 색으로 자동 매핑
  useEffect(() => {
    if (!quantized || filaments.length === 0) {
      setLayerMap([]);
      return;
    }
    const hexes = filaments.map((f) => f.hex);
    setLayerMap(quantized.palette.map((p) => nearestColorIndex(p.hex, hexes)));
  }, [quantized, filaments]);

  // 3D 모델 생성 (입력 변경 후 120ms 디바운스)
  useEffect(() => {
    if (!quantized || filaments.length === 0 || layerMap.length !== quantized.palette.length) {
      return;
    }
    setIsBuilding(true);
    const timer = setTimeout(() => {
      try {
        const s = Math.min(dims.imageAreaWidth / quantized.width, dims.imageAreaHeight / quantized.height);
        const toMm = (x: number, y: number): [number, number] => [
          (x - quantized.width / 2) * s,
          (quantized.height / 2 - y) * s,
        ];
        const byFilament = new Map<number, ColorLayer>();
        quantized.palette.forEach((_, label) => {
          const target = layerMap[label];
          if (target === 'remove') return;
          const fil = filaments[target];
          if (!fil) return;
          const polygons = maskToPolygons(quantized, label, toMm, {
            tolerance: SIMPLIFY_TOLERANCE,
            minArea: detail.minArea,
            pixelSizeMm: s,
          });
          const existing = byFilament.get(target);
          if (existing) existing.polygons.push(...polygons);
          else byFilament.set(target, { name: fil.name, hex: fil.hex, polygons });
        });
        const built = buildKeycapModel(params, [...byFilament.values()]);
        disposeKeycapModel(modelRef.current);
        modelRef.current = built;
        setModelGroup(built.group);
        setTriangleCount(built.triangleCount);
        setModelVersion((v) => v + 1);
      } catch (err) {
        console.error('키캡 모델 생성 오류:', err);
      } finally {
        setIsBuilding(false);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [quantized, layerMap, filaments, params, dims, detail.minArea]);

  // 언마운트 시 지오메트리 정리
  useEffect(() => {
    return () => {
      disposeKeycapModel(modelRef.current);
      modelRef.current = null;
    };
  }, []);

  const previewUrl = useMemo(() => {
    if (!quantized || layerMap.length !== quantized.palette.length) return '';
    return renderQuantizedPreview(quantized, (label) => {
      const t = layerMap[label];
      if (t === 'remove') return null;
      return filaments[t]?.hex ?? null;
    });
  }, [quantized, layerMap, filaments]);

  const usedFilaments = useMemo(() => {
    const set = new Set<number>();
    if (filaments[baseColorIdx]) set.add(baseColorIdx);
    layerMap.forEach((t) => {
      if (t !== 'remove' && filaments[t]) set.add(t);
    });
    return [...set].map((i) => filaments[i]);
  }, [filaments, baseColorIdx, layerMap]);

  const quoteIsCurrent = quote !== null && quote.modelVersion === modelVersion;
  const totalPrice = quoteIsCurrent ? quote.price * quantity : 0;

  // -------------------------------------------------------------------------
  // 이미지 선택
  // -------------------------------------------------------------------------

  const acceptFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 사용할 수 있습니다. (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('20MB 이하의 이미지를 사용해주세요.');
      return;
    }
    setImageFile(file);
    setQuote(null);
    setLastOrderNumber('');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    setImageFile(null);
    setQuantized(null);
    setLayerMap([]);
    disposeKeycapModel(modelRef.current);
    modelRef.current = null;
    setModelGroup(null);
    setQuote(null);
    setQuantity(1);
    setLastOrderNumber('');
  };

  const setLayerTarget = (label: number, target: LayerTarget) => {
    setLayerMap((prev) => prev.map((v, i) => (i === label ? target : v)));
  };

  // -------------------------------------------------------------------------
  // 견적
  // -------------------------------------------------------------------------

  const handleQuote = async () => {
    const model = modelRef.current;
    if (!model) return;
    setQuoteState('loading');
    setQuoteError('');
    const version = modelVersion;
    try {
      const blob = await exportSTL(model.group);
      const file = new File([blob], 'keycap.stl', { type: 'application/octet-stream' });
      const formData = new FormData();
      formData.append('stlFile', file);
      formData.append('material', MATERIAL);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
      const res = await fetch(`${backendUrl}/api/upload-stl`, { method: 'POST', body: formData });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.message || result.error || '견적 계산에 실패했습니다.');
      }
      setQuote({ price: Number(result.estimatedPrice) || 0, printTime: result.printTime || '', modelVersion: version });
      setQuoteState('idle');
    } catch (err) {
      console.error('키캡 견적 오류:', err);
      setQuoteState('error');
      setQuoteError(
        err instanceof TypeError
          ? '견적 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
          : (err as Error).message,
      );
    }
  };

  // -------------------------------------------------------------------------
  // 주문
  // -------------------------------------------------------------------------

  const buildOrderFiles = async (): Promise<{ files: File[]; spec: KeycapOrderSpec }> => {
    const model = modelRef.current;
    if (!model || !imageFile) throw new Error('모델이 준비되지 않았습니다.');
    const base = `keycap_${sanitizeFileBase(imageFile.name)}`;
    const baseColor = filaments[baseColorIdx];
    const files: File[] = [];
    const asFile = (blob: Blob, name: string) => new File([blob], name, { type: 'application/octet-stream' });

    files.push(asFile(await exportSTL(model.group), `${base}_all.stl`));
    files.push(asFile(await exportSTL(model.body), `${base}_body_${baseColor.code}.stl`));

    const layers: KeycapOrderSpec['layers'] = [];
    for (let i = 0; i < model.layerMeshes.length; i++) {
      const mesh = model.layerMeshes[i];
      const hex = String(mesh.userData.hex);
      const fil = filaments.find((f) => f.hex === hex);
      const code = fil?.code ?? `C${i + 1}`;
      const fileName = `${base}_layer${i + 1}_${code}.stl`;
      files.push(asFile(await exportSTL(mesh), fileName));
      const originalHex = quantized?.palette.find((_, label) => {
        const t = layerMap[label];
        return t !== 'remove' && filaments[t]?.hex === hex;
      })?.hex ?? hex;
      layers.push({ fileName, name: fil?.name ?? hex, code, hex, originalHex });
    }

    const spec: KeycapOrderSpec = {
      sourceImageName: imageFile.name,
      widthUnits,
      height,
      embossHeight,
      imageScale,
      dimensions: {
        bottomWidth: Number(dims.bottomWidth.toFixed(2)),
        bottomDepth: Number(dims.bottomDepth.toFixed(2)),
        totalHeight: Number(dims.totalHeight.toFixed(2)),
      },
      baseColor: { name: baseColor.name, code: baseColor.code, hex: baseColor.hex },
      layers,
      filamentCount: usedFilaments.length,
    };
    return { files, spec };
  };

  const handleOrderClick = () => {
    if (!user) {
      alert('키캡 주문하기는 로그인이 필요한 서비스입니다.');
      router.push('/login');
      return;
    }
    if (!modelRef.current) {
      alert('먼저 이미지를 올려 키캡을 만들어주세요.');
      return;
    }
    if (!quoteIsCurrent) {
      alert('먼저 견적을 확인해주세요.');
      return;
    }
    setIsOrderModalOpen(true);
  };

  const handleNaverPayOrder = async (customerInfo: CustomerInfo): Promise<string> => {
    if (!quote) throw new Error('견적 정보가 없습니다.');
    const orderNumber = await generateOrderNumber();
    const { files, spec } = await buildOrderFiles();
    const fileUrls = await uploadSTLFiles(files, orderNumber);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const orderDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const orderTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const colorSummary = [
      `본체 ${spec.baseColor.name}`,
      ...spec.layers.map((l, i) => `레이어${i + 1} ${l.name}`),
    ].join(' / ');

    const orderFiles = [
      {
        fileName: files[0].name,
        material: MATERIAL,
        color: `키캡 ${WIDTH_OPTIONS.find((w) => w.units === widthUnits)?.label ?? ''} · ${colorSummary}`,
        colorHex: spec.baseColor.hex,
        quantity,
        price: quote.price,
      },
    ];

    const orderData: OrderData = {
      customerName: customerInfo.name,
      phoneNumber: customerInfo.phoneNumber,
      orderEmail: customerInfo.email,
      userEmail: user?.email || '',
      fileUrls,
      files: orderFiles,
      totalPrice: quote.price * quantity,
      paymentStatus: 'pending',
      orderDate: `${orderDate} ${orderTime}`,
      orderTime,
      workStatus: 'pending',
      orderType: 'keycap',
      keycapSpec: spec,
    };
    await saveOrder(orderNumber, orderData);

    try {
      await fetch('/api/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          customerName: customerInfo.name,
          phoneNumber: customerInfo.phoneNumber,
          email: customerInfo.email,
          totalPrice: quote.price * quantity,
          files: orderFiles,
          orderDate: `${orderDate} ${orderTime}`,
        }),
      });
    } catch (emailError) {
      console.error('이메일 발송 오류:', emailError);
    }

    setLastOrderNumber(orderNumber);
    return orderNumber;
  };

  const handleAdminDownload = async () => {
    const model = modelRef.current;
    if (!model) return;
    setIsExporting(true);
    try {
      const { files } = await buildOrderFiles();
      files.forEach((f) => downloadBlob(f, f.name));
    } catch (err) {
      console.error(err);
      alert('STL 내보내기에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  // -------------------------------------------------------------------------
  // 렌더
  // -------------------------------------------------------------------------

  const hasImage = imageFile !== null;
  const widthLabel = WIDTH_OPTIONS.find((w) => w.units === widthUnits)?.label ?? `${widthUnits}u`;

  return (
    <>
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <div className={styles.titleWrapper}>
            <h1 className={styles.title}>키캡제작</h1>
            <p className={styles.subTitle}>
              이미지 한 장을 올리면 3D 프린팅용 커스텀 키캡이 자동으로 만들어집니다.
              <br className={styles.desktopBreak} />
              색상을 고르고 미리보기를 확인한 뒤 바로 주문하세요.
            </p>
          </div>

          <div className={styles.workspace}>
            {/* ---------------- 왼쪽: 설정 ---------------- */}
            <div className={styles.leftPanel}>
              {/* STEP 1 */}
              <section className={styles.step}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>1</span>
                  <h2 className={styles.stepTitle}>이미지 올리기</h2>
                  {hasImage && (
                    <button type="button" className={styles.textBtn} onClick={handleReset}>
                      처음부터 다시
                    </button>
                  )}
                </div>

                <div
                  className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${hasImage ? styles.hasImage : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileChange}
                    className={styles.hiddenInput}
                  />
                  {hasImage ? (
                    <div className={styles.imagePair}>
                      <figure className={styles.imageBox}>
                        {sourceUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={sourceUrl} alt="원본 이미지" />
                        ) : (
                          <div className={styles.imagePlaceholder} />
                        )}
                        <figcaption>원본</figcaption>
                      </figure>
                      <span className={styles.imageArrow}>→</span>
                      <figure className={`${styles.imageBox} ${styles.checker}`}>
                        {previewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={previewUrl} alt="출력용으로 변환된 이미지" />
                        ) : (
                          <div className={styles.imagePlaceholder}>
                            {processState === 'processing' ? '변환 중…' : processState === 'error' ? '변환 실패' : ''}
                          </div>
                        )}
                        <figcaption>출력용 변환</figcaption>
                      </figure>
                    </div>
                  ) : (
                    <div className={styles.dropzoneEmpty}>
                      <div className={styles.dropIcon}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="3" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                      <p className={styles.dropTitle}>이미지를 드래그하거나 클릭해서 선택</p>
                      <p className={styles.dropHint}>PNG · JPG · SVG · WebP</p>
                      <p className={styles.dropHint}>단색 또는 투명 배경의 단순한 그림이 가장 잘 나옵니다</p>
                    </div>
                  )}
                </div>
                {hasImage && <p className={styles.fileName}>{imageFile?.name}</p>}
                {processState === 'error' && <p className={styles.errorText}>{processError}</p>}
              </section>

              {/* STEP 2 */}
              <section className={`${styles.step} ${!hasImage ? styles.stepDisabled : ''}`}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>2</span>
                  <h2 className={styles.stepTitle}>색상 정리</h2>
                </div>

                <div className={styles.optionRow}>
                  <label className={styles.optionLabel}>색상 수</label>
                  <div className={styles.chipGroup}>
                    {COLOR_COUNT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`${styles.chip} ${colorCount === n ? styles.chipActive : ''}`}
                        onClick={() => setColorCount(n)}
                        disabled={!hasImage}
                      >
                        {n}색
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.optionRow}>
                  <label className={styles.optionLabel}>세부 묘사</label>
                  <div className={styles.chipGroup}>
                    {DETAIL_OPTIONS.map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        className={`${styles.chip} ${detailLevel === d.key ? styles.chipActive : ''}`}
                        onClick={() => setDetailLevel(d.key)}
                        disabled={!hasImage}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <span className={styles.optionHint}>{detail.hint}</span>
                </div>

                <div className={styles.optionRow}>
                  <label className={styles.optionLabel}>배경 자동 제거</label>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={removeBackground}
                    className={`${styles.toggle} ${removeBackground ? styles.toggleOn : ''}`}
                    onClick={() => setRemoveBackground((v) => !v)}
                    disabled={!hasImage}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                  <span className={styles.optionHint}>테두리를 채운 색을 배경으로 보고 지웁니다</span>
                </div>

                {quantized && layerMap.length === quantized.palette.length && (
                  <div className={styles.paletteList}>
                    <p className={styles.paletteHint}>추출된 색상을 실제 출력할 필라멘트 색으로 바꿔주세요.</p>
                    {quantized.palette.map((p, label) => {
                      const target = layerMap[label];
                      const share = Math.round((p.count / quantized.labels.length) * 100);
                      return (
                        <div key={label} className={styles.paletteRow}>
                          <div className={styles.paletteSource}>
                            <span className={styles.swatchLarge} style={{ backgroundColor: p.hex }} />
                            <div className={styles.paletteMeta}>
                              <span className={styles.paletteHex}>{p.hex}</span>
                              <span className={styles.paletteShare}>{share}%</span>
                            </div>
                          </div>
                          <span className={styles.paletteArrow}>→</span>
                          <div className={styles.filamentChips}>
                            {filaments.map((f, idx) => (
                              <button
                                key={f.code}
                                type="button"
                                title={f.name}
                                aria-label={f.name}
                                className={`${styles.swatch} ${target === idx ? styles.swatchActive : ''}`}
                                style={{ backgroundColor: f.hex }}
                                onClick={() => setLayerTarget(label, idx)}
                              />
                            ))}
                            <button
                              type="button"
                              className={`${styles.removeChip} ${target === 'remove' ? styles.removeChipActive : ''}`}
                              onClick={() => setLayerTarget(label, 'remove')}
                            >
                              출력 안 함
                            </button>
                          </div>
                          <span className={styles.paletteTargetName}>
                            {target === 'remove' ? '제거됨' : filaments[target]?.name ?? ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* STEP 3 */}
              <section className={`${styles.step} ${!hasImage ? styles.stepDisabled : ''}`}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>3</span>
                  <h2 className={styles.stepTitle}>키캡 설정</h2>
                </div>

                <div className={styles.optionRow}>
                  <label className={styles.optionLabel}>키 크기</label>
                  <div className={styles.chipGroup}>
                    {WIDTH_OPTIONS.map((w) => (
                      <button
                        key={w.units}
                        type="button"
                        className={`${styles.chip} ${widthUnits === w.units ? styles.chipActive : ''}`}
                        onClick={() => setWidthUnits(w.units)}
                        disabled={!hasImage}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.optionRow}>
                  <label className={styles.optionLabel}>본체 색상</label>
                  <div className={styles.filamentChips}>
                    {filaments.map((f, idx) => (
                      <button
                        key={f.code}
                        type="button"
                        title={f.name}
                        aria-label={f.name}
                        className={`${styles.swatch} ${baseColorIdx === idx ? styles.swatchActive : ''}`}
                        style={{ backgroundColor: f.hex }}
                        onClick={() => setBaseColorIdx(idx)}
                        disabled={!hasImage}
                      />
                    ))}
                  </div>
                  <span className={styles.paletteTargetName}>{filaments[baseColorIdx]?.name ?? ''}</span>
                </div>

                <div className={styles.sliderRow}>
                  <label className={styles.optionLabel}>
                    키캡 높이 <strong>{height.toFixed(1)}mm</strong>
                  </label>
                  <input
                    type="range"
                    min={7}
                    max={11}
                    step={0.5}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    disabled={!hasImage}
                  />
                </div>

                <div className={styles.sliderRow}>
                  <label className={styles.optionLabel}>
                    그림 양각 높이 <strong>{embossHeight.toFixed(1)}mm</strong>
                  </label>
                  <input
                    type="range"
                    min={0.4}
                    max={1.2}
                    step={0.2}
                    value={embossHeight}
                    onChange={(e) => setEmbossHeight(Number(e.target.value))}
                    disabled={!hasImage}
                  />
                </div>

                <div className={styles.sliderRow}>
                  <label className={styles.optionLabel}>
                    그림 크기 <strong>{Math.round(imageScale * 100)}%</strong>
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round(imageScale * 100)}
                    onChange={(e) => setImageScale(Number(e.target.value) / 100)}
                    disabled={!hasImage}
                  />
                </div>
              </section>
            </div>

            {/* ---------------- 오른쪽: 미리보기 + 주문 ---------------- */}
            <div className={styles.rightPanel}>
              <div className={styles.viewerCard}>
                <div className={styles.viewerWrapper}>
                  <KeycapViewer model={modelGroup} className={styles.viewer} />
                  {!modelGroup && (
                    <div className={styles.viewerOverlay}>
                      {processState === 'processing' || isBuilding ? (
                        <p>키캡을 만드는 중…</p>
                      ) : (
                        <>
                          <p className={styles.viewerOverlayTitle}>3D 미리보기</p>
                          <p>이미지를 올리면 키캡이 여기에 나타납니다</p>
                        </>
                      )}
                    </div>
                  )}
                  {modelGroup && (processState === 'processing' || isBuilding) && (
                    <div className={styles.viewerBadge}>업데이트 중…</div>
                  )}
                </div>
                <p className={styles.viewerHint}>드래그로 회전 · 휠로 확대 · 우클릭 드래그로 이동</p>
              </div>

              <div className={styles.summaryCard}>
                <h3 className={styles.summaryTitle}>키캡 정보</h3>
                <dl className={styles.summaryList}>
                  <div>
                    <dt>크기</dt>
                    <dd>
                      {widthLabel} · {dims.bottomWidth.toFixed(1)} × {dims.bottomDepth.toFixed(1)} × {dims.totalHeight.toFixed(1)} mm
                    </dd>
                  </div>
                  <div>
                    <dt>소재</dt>
                    <dd>{MATERIAL} (다색 출력)</dd>
                  </div>
                  <div>
                    <dt>스템</dt>
                    <dd>MX 호환 십자 스템</dd>
                  </div>
                  <div>
                    <dt>필라멘트</dt>
                    <dd className={styles.filamentSummary}>
                      {usedFilaments.length > 0 ? (
                        <>
                          {usedFilaments.map((f) => (
                            <span key={f.code} className={styles.filamentTag}>
                              <span className={styles.swatchSmall} style={{ backgroundColor: f.hex }} />
                              {f.name}
                            </span>
                          ))}
                          <span className={styles.filamentCount}>{usedFilaments.length}색</span>
                          {usedFilaments.length > MAX_RECOMMENDED_FILAMENTS && (
                            <span className={styles.filamentWarn}>
                              {MAX_RECOMMENDED_FILAMENTS}색을 넘으면 출력 시 필라멘트 교체가 필요해 제작 기간이 늘 수 있습니다
                            </span>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  {triangleCount > 0 && (
                    <div>
                      <dt>모델</dt>
                      <dd>{triangleCount.toLocaleString()} 삼각형</dd>
                    </div>
                  )}
                </dl>

                <div className={styles.quoteSection}>
                  {quoteIsCurrent ? (
                    <div className={styles.quoteResult}>
                      <div className={styles.quoteRow}>
                        <span>개당 가격</span>
                        <strong>₩ {quote.price.toLocaleString()}</strong>
                      </div>
                      {quote.printTime && (
                        <div className={styles.quoteRowSub}>
                          <span>예상 출력 시간</span>
                          <span>{quote.printTime}</span>
                        </div>
                      )}
                      <div className={styles.quantityRow}>
                        <span>수량</span>
                        <div className={styles.quantityControl}>
                          <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="수량 줄이기">−</button>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                          />
                          <button type="button" onClick={() => setQuantity((q) => Math.min(500, q + 1))} aria-label="수량 늘리기">+</button>
                        </div>
                      </div>
                      <div className={styles.totalRow}>
                        <span>총 금액</span>
                        <strong>₩ {totalPrice.toLocaleString()}</strong>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.quoteBtn}
                      onClick={handleQuote}
                      disabled={!modelGroup || quoteState === 'loading' || isBuilding || processState === 'processing'}
                    >
                      {quoteState === 'loading' ? '견적 계산 중…' : quote ? '변경된 설정으로 견적 다시 확인' : '견적 확인하기'}
                    </button>
                  )}
                  {quoteState === 'error' && <p className={styles.errorText}>{quoteError}</p>}
                </div>

                <button
                  type="button"
                  className={`${styles.orderBtn} ${!quoteIsCurrent ? styles.orderBtnDisabled : ''}`}
                  onClick={handleOrderClick}
                >
                  키캡 주문하기
                </button>
                <p className={styles.orderHint}>
                  주문 접수 후 네이버 톡톡으로 결제 방법을 안내해 드립니다. 제작 기간은 결제 완료 후 2~4일입니다.
                </p>
                {lastOrderNumber && (
                  <p className={styles.orderDone}>
                    주문번호 <strong>{lastOrderNumber}</strong> 로 접수되었습니다.
                  </p>
                )}

                {userRole === 'admin' && modelGroup && (
                  <button type="button" className={styles.adminBtn} onClick={handleAdminDownload} disabled={isExporting}>
                    {isExporting ? '내보내는 중…' : 'STL 다운로드 (관리자)'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ---------------- 안내 ---------------- */}
          <div className={styles.guideGrid}>
            <div className={styles.guideCard}>
              <h3>이런 이미지가 잘 나와요</h3>
              <ul>
                <li>로고, 아이콘, 픽셀아트처럼 색 수가 적고 경계가 뚜렷한 그림</li>
                <li>투명 배경 PNG 또는 단색 배경 이미지</li>
                <li>사진이나 그라데이션은 색이 뭉개져 권장하지 않습니다</li>
              </ul>
            </div>
            <div className={styles.guideCard}>
              <h3>출력 규격</h3>
              <ul>
                <li>PLA 다색 FDM 출력, 0.4mm 노즐 기준</li>
                <li>약 0.4mm보다 가는 선과 작은 글씨는 실제 출력에서 표현되지 않을 수 있습니다</li>
                <li>원본 해상도를 최대 800px까지 그대로 사용해 외곽선을 따냅니다</li>
                <li>체리 MX 호환 스위치에 맞는 십자 스템 (Ø5.5mm)</li>
              </ul>
            </div>
            <div className={styles.guideCard}>
              <h3>주문 방법</h3>
              <ul>
                <li>견적 확인 → 수량 선택 → 주문 정보 입력</li>
                <li>접수 후 네이버 톡톡에서 주문번호로 결제 안내</li>
                <li>주문 제작 상품이라 결제 후 취소·환불이 제한됩니다</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSubmit={() => {}}
        onNaverPayOrder={handleNaverPayOrder}
        totalPrice={totalPrice}
        fileCount={1}
      />
    </>
  );
}
