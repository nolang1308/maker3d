'use client';

import styles from './page.module.scss';
import Image from "next/image";
import {useState, useEffect, useRef} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/contexts/AuthContext';
import STLViewer from '../../components/STLViewer';
import OrderModal, { CustomerInfo } from '@/components/OrderModal';
import { generateOrderNumber, uploadSTLFiles, saveOrder, OrderData } from '@/utils/orderUtils';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAllMaterialColors, ColorOption, TRANSPARENT_SENTINEL } from '@/services/colorService';
import { recordQuoteStep } from '@/utils/visitStats/tracker';
import MaterialSelect from './MaterialSelect';
import QuoteDialog from './QuoteDialog';
import {
    MATERIAL_OPTIONS,
    MATERIAL_GUIDE_URL,
    FILE_SIZE_LIMIT_MB,
    PRINT_SIZE_LIMIT_MM,
    formatPrintTime,
    formatFileSize,
    fileExtension,
} from './quoteOptions';

interface FileItem {
    id: number;
    fileName: string;
    material: string;
    color: string;
    colorHex: string;
    quantity: number;
    price: number;
    file: File | null;
    savedFilePath?: string; // 백엔드에 저장된 파일 경로
}

// 화면 안에서 알려 주는 안내(예전의 alert 자리). where 는 안내를 보여 줄 구역
type HintWhere = 'upload' | 'option' | 'list';
interface Hint {
    where: HintWhere;
    text: string;
}

const TALK_URL = 'https://talk.naver.com/ct/w4e4gt?frm=psf';

const STEPS = [
    { id: 'upload', label: '파일 올리기', target: 'quote-upload' },
    { id: 'option', label: '소재 · 색상 고르기', target: 'quote-options' },
    { id: 'estimate', label: '견적 확인', target: 'quote-result' },
    { id: 'order', label: '저장하고 문의', target: 'quote-list' },
] as const;

// 화면에서 쓰는 작은 그림들 (선 굵기를 맞추려고 그림 파일 대신 직접 그린다)
function IconCheck({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    );
}

function IconDownload() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14" />
        </svg>
    );
}

function IconUpload() {
    return (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.8 1.02A3.75 3.75 0 0 1 17.5 18.5" />
            <path d="M12 19.5V12M9 14.5l3-3 3 3" />
        </svg>
    );
}

function IconCube() {
    return (
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
            <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
        </svg>
    );
}

function IconTrash() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />
        </svg>
    );
}

function IconCopy() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
            <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
        </svg>
    );
}

export default function QuotePage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [quantity, setQuantity] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [material, setMaterial] = useState('');
    const [color, setColor] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [fileItems, setFileItems] = useState<FileItem[]>([]);
    const [currentPreviewFile, setCurrentPreviewFile] = useState<File | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [estimatedPrice, setEstimatedPrice] = useState(0);
    const [printTime, setPrintTime] = useState<string>('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isProcessingOrder, setIsProcessingOrder] = useState(false);
    const [hasCalculatedEstimate, setHasCalculatedEstimate] = useState(false); // 견적 계산 완료 상태
    const [isFileSizeModalOpen, setIsFileSizeModalOpen] = useState(false); // 파일 용량 초과 모달
    const [emailCopied, setEmailCopied] = useState(false); // 이메일 복사 상태
    const [isEstimateErrorModalOpen, setIsEstimateErrorModalOpen] = useState(false); // 견적 오류 모달
    const [isPrintSizeModalOpen, setIsPrintSizeModalOpen] = useState(false); // 출력 크기 초과 모달
    const [isPrintSizeExceeded, setIsPrintSizeExceeded] = useState(false); // 출력 크기 초과 여부 (버튼 차단)
    const [overSizeDimensions, setOverSizeDimensions] = useState<{ x: number; y: number; z: number } | null>(null); // 초과된 치수
    const [isTermsExpanded, setIsTermsExpanded] = useState(false); // 이용약관 확장 상태
    const [isPaymentInfoExpanded, setIsPaymentInfoExpanded] = useState(false); // 상품결제정보 확장 상태
    const [isPrivacyPolicyExpanded, setIsPrivacyPolicyExpanded] = useState(false); // 개인정보처리방침 확장 상태
    const [isShippingPolicyExpanded, setIsShippingPolicyExpanded] = useState(false); // 배송 및 환불 정책 확장 상태
    const [activeShoppingGuideTab, setActiveShoppingGuideTab] = useState('상품결제정보'); // 쇼핑가이드 탭 상태
    const [materialColors, setMaterialColors] = useState<Record<string, ColorOption[]>>({});
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done'>('idle'); // 저장 오버레이 상태
    const [colorsLoaded, setColorsLoaded] = useState(false); // 소재별 색상을 받아 왔는지
    const [modelDims, setModelDims] = useState<{ x: number; y: number; z: number } | null>(null); // 미리보기 중인 모델의 크기(mm)
    const [hint, setHint] = useState<Hint | null>(null); // 화면 안 안내
    const [loginPrompt, setLoginPrompt] = useState<'save' | 'order' | null>(null); // 로그인 안내 창
    const materialButtonRef = useRef<HTMLButtonElement>(null);
    const colorGridRef = useRef<HTMLDivElement>(null);

    // 로그인 체크 제거 - 견적 계산은 로그인 없이 가능

    // Firebase에서 저장된 견적 불러오기
    useEffect(() => {
        const loadSavedQuotes = async () => {
            if (user) {
                try {
                    const quotesRef = doc(db, 'savedQuotes', user.uid);
                    const quotesSnap = await getDoc(quotesRef);

                    if (quotesSnap.exists()) {
                        const data = quotesSnap.data();
                        const savedQuotes = data.quotes || [];

                        // Firebase 데이터를 FileItem 형식으로 변환 (savedFilePath 포함)
                        const loadedItems: FileItem[] = savedQuotes.map((quote: any) => ({
                            id: quote.id,
                            fileName: quote.fileName,
                            material: quote.material,
                            color: quote.color,
                            colorHex: quote.colorHex ?? '',
                            quantity: quote.quantity,
                            price: quote.price,
                            file: null,
                            savedFilePath: quote.savedFilePath
                        }));

                        setFileItems(loadedItems);
                    }
                } catch (error) {
                    console.error('견적 불러오기 오류:', error);
                }
            }
        };

        if (!loading && user) {
            loadSavedQuotes();
        }
    }, [user, loading]);

    // 소재별 색상 Firestore에서 로드
    useEffect(() => {
        getAllMaterialColors().then((colors) => {
            setMaterialColors(colors);
            setColorsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (!material) { setColor(''); return; }
        const available = materialColors[material] ?? [];
        if (!available.some((c) => c.name === color && c.available)) {
            setColor('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [material, materialColors]);

    const increaseQuantity = () => {
        setQuantity(prev => prev + 1);
    };

    const decreaseQuantity = () => {
        setQuantity(prev => prev > 1 ? prev - 1 : 1);
    };

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value) || 1;
        setQuantity(value > 0 ? value : 1);
    };

    const handleQuantityClick = () => {
        setIsEditing(true);
    };

    const handleQuantityBlur = () => {
        setIsEditing(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
        }
    };

    const FILE_SIZE_LIMIT = FILE_SIZE_LIMIT_MB * 1024 * 1024; // 64MB
    const PRINT_SIZE_LIMIT = PRINT_SIZE_LIMIT_MM; // 최대 출력 크기 (mm)

    // 안내를 보여 주고 그 구역이 화면에 들어오게 한다
    const showHint = (where: HintWhere, text: string, focusTarget?: HTMLElement | null) => {
        setHint({ where, text });
        const sectionId = where === 'upload' ? 'quote-upload' : where === 'option' ? 'quote-options' : 'quote-list';
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (focusTarget) {
            focusTarget.focus({ preventScroll: true });
            focusTarget.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        } else {
            document.getElementById(sectionId)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
        }
    };

    const scrollToSection = (targetId: string) => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById(targetId)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    };

    // 소재가 바뀌면 금액도 달라지므로 이전 견적은 지운다 (다른 소재의 금액으로 저장되지 않게)
    const handleMaterialChange = (value: string) => {
        if (value === material) return;
        setMaterial(value);
        setEstimatedPrice(0);
        setPrintTime('');
        setHasCalculatedEstimate(false);
        setHint(null);
    };

    const handleColorSelect = (name: string) => {
        setColor(name);
        setHint((current) => (current?.where === 'option' ? null : current));
    };

    // 올린 파일을 지운다 (저장한 견적 목록은 그대로 둔다)
    const clearUploadedFile = () => {
        setUploadedFiles([]);
        setCurrentPreviewFile(null);
        setEstimatedPrice(0);
        setPrintTime('');
        setHasCalculatedEstimate(false);
        setIsPrintSizeExceeded(false);
        setOverSizeDimensions(null);
        setModelDims(null);
        setHint(null);
        const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
        if (fileInput) fileInput.value = '';
    };

    const handleDimensions = (dims: { x: number; y: number; z: number }) => {
        setModelDims(dims);
        if (dims.x > PRINT_SIZE_LIMIT || dims.y > PRINT_SIZE_LIMIT || dims.z > PRINT_SIZE_LIMIT) {
            setOverSizeDimensions(dims);
            setIsPrintSizeExceeded(true);
            setIsPrintSizeModalOpen(true);
        } else {
            setIsPrintSizeExceeded(false);
            setOverSizeDimensions(null);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            const oversized = files.some(file => file.size > FILE_SIZE_LIMIT);
            if (oversized) {
                setIsFileSizeModalOpen(true);
                e.target.value = '';
                return;
            }

            setUploadedFiles(files);
            setCurrentPreviewFile(files[0]);

            // 새 파일 업로드 시 기존 저장된 견적 초기화
            setFileItems([]);
            setEstimatedPrice(0);
            setPrintTime('');
            setHasCalculatedEstimate(false); // 견적 계산 상태 초기화
            setIsPrintSizeExceeded(false);
            setOverSizeDimensions(null);
            setModelDims(null);
            setHint(null);
            recordQuoteStep('upload'); // 방문 통계: 견적 흐름
        }
    };

    const calculateEstimate = async () => {
        // 유효성 검사
        if (uploadedFiles.length === 0) {
            showHint('upload', 'STL 파일을 먼저 업로드해주세요.');
            return;
        }
        if (!material) {
            showHint('option', '소재를 선택해주세요.', materialButtonRef.current);
            return;
        }
        if (!color) {
            showHint('option', '색상을 선택해주세요.', colorGridRef.current?.querySelector<HTMLElement>('button:not([aria-disabled="true"])'));
            return;
        }

        setHint(null);
        setIsCalculating(true);
        setEstimatedPrice(0);
        setPrintTime('');

        try {
            const file = uploadedFiles[0];

            // PrusaSlicer 백엔드 API 호출 (소재, 색상만 포함)
            const formData = new FormData();
            formData.append('stlFile', file);
            formData.append('material', material);
            formData.append('color', color);

            // 직접 백엔드로 호출 (Vercel 제한 우회)
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
            const response = await fetch(`${backendUrl}/api/upload-stl`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                setPrintTime(result.printTime);
                setEstimatedPrice(result.estimatedPrice);
                setHasCalculatedEstimate(true); // 견적 계산 완료 표시
                recordQuoteStep('estimate'); // 방문 통계: 견적 흐름
            } else if (result.error === '출력 크기 초과') {
                const dim = result.dimensions;
                setOverSizeDimensions({
                    x: parseFloat(dim.x),
                    y: parseFloat(dim.y),
                    z: parseFloat(dim.z),
                });
                setIsPrintSizeExceeded(true);
                setIsPrintSizeModalOpen(true);
            } else {
                console.error('견적 계산 오류:', result.error);
                setIsEstimateErrorModalOpen(true);
            }
        } catch (error) {
            console.error('네트워크 오류:', error);
            showHint('option', '견적 계산 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsCalculating(false);
        }
    };

    // 시간 문자열을 시간으로 변환하는 헬퍼 함수
    const parseTimeToHours = (timeString: string): number => {
        // "2h 30m 15s" 형태의 문자열을 시간으로 변환
        const hours = timeString.match(/(\d+)h/)?.[1] || '0';
        const minutes = timeString.match(/(\d+)m/)?.[1] || '0';
        const seconds = timeString.match(/(\d+)s/)?.[1] || '0';

        return parseInt(hours) + parseInt(minutes) / 60 + parseInt(seconds) / 3600;
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // 구역 안의 다른 요소 위로 옮겨 간 것은 나간 것이 아니다 (테두리가 깜빡이지 않게)
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const ALLOWED_EXT = ['.stl', '.obj', '.stp', '.step'];
        const stlFiles = files.filter(file =>
            ALLOWED_EXT.some(ext => file.name.toLowerCase().endsWith(ext))
        );

        if (stlFiles.length > 0) {
            const oversized = stlFiles.some(file => file.size > FILE_SIZE_LIMIT);
            if (oversized) {
                setIsFileSizeModalOpen(true);
                return;
            }

            setUploadedFiles(stlFiles);
            setCurrentPreviewFile(stlFiles[0]);
            // 드래그 앤 드롭 시에도 견적 상태 초기화
            setFileItems([]);
            setEstimatedPrice(0);
            setPrintTime('');
            setHasCalculatedEstimate(false);
            setIsPrintSizeExceeded(false);
            setOverSizeDimensions(null);
            setModelDims(null);
            setHint(null);
            recordQuoteStep('upload'); // 방문 통계: 견적 흐름
        } else {
            showHint('upload', 'STL, OBJ, STP 파일만 업로드 가능합니다.');
        }
    };

    const handleSave = async () => {
        if (saveStatus !== 'idle') return; // 저장 중 중복 클릭 방지

        // 로그인 체크
        if (!user) {
            setLoginPrompt('save');
            return;
        }

        // 견적 계산 완료 확인
        if (!hasCalculatedEstimate || estimatedPrice <= 0) {
            showHint('option', '견적내기를 먼저 진행해주세요.');
            return;
        }

        if (uploadedFiles.length > 0 && material && color) {
            setSaveStatus('saving');
            try {
                let savedFilePaths: string[] = [];

                // 1. 파일을 백엔드로 업로드
                if (user && uploadedFiles.length > 0) {
                    const formData = new FormData();
                    formData.append('userId', user.uid);

                    uploadedFiles.forEach((file) => {
                        formData.append('files', file);
                    });

                    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
                    const response = await fetch(`${backendUrl}/api/save-quote-files`, {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();

                    if (result.success) {
                        savedFilePaths = result.filePaths;
                    } else {
                        throw new Error(result.error || '파일 저장 실패');
                    }
                }

                // 2. FileItem 생성 (savedFilePath 포함)
                const selectedColorHex = (materialColors[material] ?? []).find((c) => c.name === color)?.hex ?? '';
                const newItems: FileItem[] = uploadedFiles.map((file, index) => ({
                    id: Date.now() + index,
                    fileName: file.name,
                    material,
                    color,
                    colorHex: selectedColorHex,
                    quantity,
                    price: estimatedPrice || Math.floor(Math.random() * 200000) + 50000,
                    file: file,
                    savedFilePath: savedFilePaths[index] || undefined
                }));

                const updatedItems = [...fileItems, ...newItems];
                setFileItems(updatedItems);

                // 3. Firebase에 저장 (File 객체 제외, savedFilePath 포함)
                if (user) {
                    const quotesRef = doc(db, 'savedQuotes', user.uid);
                    const savedQuotes = updatedItems.map(item => ({
                        id: item.id,
                        fileName: item.fileName,
                        material: item.material,
                        color: item.color,
                        colorHex: item.colorHex,
                        quantity: item.quantity,
                        price: item.price,
                        savedFilePath: item.savedFilePath,
                        savedAt: new Date().toISOString()
                    }));

                    await setDoc(quotesRef, {
                        userId: user.uid,
                        quotes: savedQuotes,
                        updatedAt: new Date().toISOString()
                    });
                }

                recordQuoteStep('save'); // 방문 통계: 견적 흐름

                // 폼 초기화
                setMaterial('');
                setColor('');
                setQuantity(1);
                setUploadedFiles([]);
                setCurrentPreviewFile(null);
                setEstimatedPrice(0);
                setPrintTime('');
                setHasCalculatedEstimate(false); // 저장 후 견적 상태 초기화
                setModelDims(null);
                setHint(null);

                // 파일 input 초기화
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

                // 저장 완료 피드백을 잠시 보여준 뒤 오버레이 닫기
                setSaveStatus('done');
                await new Promise((resolve) => setTimeout(resolve, 1200));
                setSaveStatus('idle');
            } catch (error) {
                console.error('견적 저장 오류:', error);
                setSaveStatus('idle');
                showHint('option', '견적 저장 중 오류가 발생했습니다.');
            }
        } else {
            showHint('option', '파일을 업로드하고 소재, 색상을 선택해주세요.');
        }
    };

    // 견적 주문하기 버튼 클릭
    const handleOrderClick = () => {
        // 로그인 체크
        if (!user) {
            setLoginPrompt('order');
            return;
        }

        if (fileItems.length === 0) {
            showHint('list', '저장한 견적이 없습니다. 위에서 견적을 낸 뒤 저장해 주세요.');
            return;
        }
        setHint(null);
        setIsOrderModalOpen(true);
    };

    // 주문 제출 처리
    const handleOrderSubmit = async (customerInfo: CustomerInfo) => {
        setIsProcessingOrder(true);

        try {
            // 1. 주문번호 생성
            const orderNumber = await generateOrderNumber();

            // 2. STL 파일 처리 (새 업로드 파일 우선, 저장된 파일 후순위)
            let fileUrls: string[] = [];

            // 새로 업로드한 파일이 있는지 확인 (uploadedFiles 우선)
            if (uploadedFiles.length > 0) {
                // 새로 업로드된 파일 사용
                fileUrls = await uploadSTLFiles(uploadedFiles, orderNumber);
            } else {
                // 저장된 파일이 있는지 확인
                const hasSavedFiles = fileItems.some(item => item.savedFilePath);

                if (hasSavedFiles && user) {
                    // 저장된 파일을 주문 폴더로 복사
                    const savedFilePaths = fileItems
                        .filter(item => item.savedFilePath)
                        .map(item => item.savedFilePath as string);

                    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
                    const response = await fetch(`${backendUrl}/api/copy-saved-files-to-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: user.uid,
                            orderNumber: orderNumber,
                            filePaths: savedFilePaths
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        fileUrls = result.filePaths;
                    } else {
                        throw new Error(result.error || '저장된 파일 복사 실패');
                    }
                } else {
                    // fileItems에서 파일 추출
                    const files = fileItems.map(item => item.file).filter((file): file is File => file !== null);
                    if (files.length > 0) {
                        fileUrls = await uploadSTLFiles(files, orderNumber);
                    }
                }
            }

            // 3. 주문 정보 준비
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            const orderDate = `${year}-${month}-${day}`; // YYYY-MM-DD (로컬 시간)
            const orderTime = `${hours}:${minutes}:${seconds}`; // HH:MM:SS (로컬 시간)

            const orderData: OrderData = {
                customerName: customerInfo.name,
                phoneNumber: customerInfo.phoneNumber,
                orderEmail: customerInfo.email, // 주문 시 입력한 이메일
                userEmail: user?.email || '', // 로그인한 사용자의 계정 이메일
                fileUrls: fileUrls,
                files: fileItems.map((item) => ({
                    fileName: item.fileName,
                    material: item.material,
                    color: item.color,
                    colorHex: item.colorHex,
                    quantity: item.quantity,
                    price: item.price
                })),
                totalPrice: fileItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                paymentStatus: 'pending',
                orderDate: `${orderDate} ${orderTime}`,
                orderTime: orderTime,
                workStatus: 'pending'
            };

            // 4. Firestore에 주문 저장
            await saveOrder(orderNumber, orderData);
            recordQuoteStep('inquiry'); // 방문 통계: 견적 흐름

            // 5. 성공 처리
            alert(`주문이 완료되었습니다!\n주문번호: ${orderNumber}`);
            setIsOrderModalOpen(false);

            // 폼 초기화
            setFileItems([]);
            setMaterial('');
            setColor('');
            setQuantity(1);
            setUploadedFiles([]);
            setCurrentPreviewFile(null);
            setEstimatedPrice(0);
            setPrintTime('');
            setHasCalculatedEstimate(false); // 주문 완료 후 견적 상태 초기화

            // Firebase에 저장된 견적 초기화
            if (user) {
                try {
                    const quotesRef = doc(db, 'savedQuotes', user.uid);
                    await setDoc(quotesRef, {
                        userId: user.uid,
                        quotes: [],
                        updatedAt: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('Firebase 초기화 오류:', error);
                }
            }

        } catch (error) {
            console.error('주문 처리 오류:', error);
            alert('주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setIsProcessingOrder(false);
        }
    };

    // 견적 주문 처리 (주문번호 반환)
    const handleNaverPayOrder = async (customerInfo: CustomerInfo): Promise<string> => {
        setIsProcessingOrder(true);

        try {
            // 1. 주문번호 생성
            const orderNumber = await generateOrderNumber();

            // 2. STL 파일 처리 (기존 로직과 동일)
            let fileUrls: string[] = [];

            if (uploadedFiles.length > 0) {
                fileUrls = await uploadSTLFiles(uploadedFiles, orderNumber);
            } else {
                const hasSavedFiles = fileItems.some(item => item.savedFilePath);

                if (hasSavedFiles && user) {
                    const savedFilePaths = fileItems
                        .filter(item => item.savedFilePath)
                        .map(item => item.savedFilePath as string);

                    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
                    const response = await fetch(`${backendUrl}/api/copy-saved-files-to-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: user.uid,
                            orderNumber: orderNumber,
                            filePaths: savedFilePaths
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        fileUrls = result.filePaths;
                    } else {
                        throw new Error(result.error || '저장된 파일 복사 실패');
                    }
                } else {
                    const files = fileItems.map(item => item.file).filter((file): file is File => file !== null);
                    if (files.length > 0) {
                        fileUrls = await uploadSTLFiles(files, orderNumber);
                    }
                }
            }

            // 3. 총 금액 계산
            const totalAmount = fileItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // 4. 주문 데이터 구성 및 저장
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            const orderDate = `${year}-${month}-${day}`;
            const orderTime = `${hours}:${minutes}:${seconds}`;

            const orderData: OrderData = {
                customerName: customerInfo.name,
                phoneNumber: customerInfo.phoneNumber,
                orderEmail: customerInfo.email,
                userEmail: user?.email || '',
                fileUrls: fileUrls,
                files: fileItems.map((item) => ({
                    fileName: item.fileName,
                    material: item.material,
                    color: item.color,
                    colorHex: item.colorHex,
                    quantity: item.quantity,
                    price: item.price
                })),
                totalPrice: totalAmount,
                paymentStatus: 'pending',
                orderDate: `${orderDate} ${orderTime}`,
                orderTime: orderTime,
                workStatus: 'pending'
            };

            await saveOrder(orderNumber, orderData);
            recordQuoteStep('inquiry'); // 방문 통계: 견적 흐름

            // 5. 이메일 알림 발송
            try {
                await fetch('/api/send-order-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        orderNumber: orderNumber,
                        customerName: customerInfo.name,
                        phoneNumber: customerInfo.phoneNumber,
                        email: customerInfo.email,
                        totalPrice: totalAmount,
                        files: fileItems.map(item => ({
                            fileName: item.fileName,
                            material: item.material,
                            color: item.color,
                            colorHex: item.colorHex,
                            quantity: item.quantity,
                            price: item.price
                        })),
                        orderDate: `${orderDate} ${orderTime}`
                    })
                });
            } catch (emailError) {
                console.error('이메일 발송 오류:', emailError);
                // 이메일 발송 실패해도 주문은 정상 처리
            }

            // 6. 폼 초기화
            setFileItems([]);
            setMaterial('');
            setColor('');
            setQuantity(1);
            setUploadedFiles([]);
            setCurrentPreviewFile(null);
            setEstimatedPrice(0);
            setPrintTime('');
            setHasCalculatedEstimate(false);

            if (user) {
                const quotesRef = doc(db, 'savedQuotes', user.uid);
                await setDoc(quotesRef, {
                    userId: user.uid,
                    quotes: [],
                    updatedAt: new Date().toISOString()
                });
            }

            setIsProcessingOrder(false);
            return orderNumber;

        } catch (error) {
            console.error('견적 주문 처리 중 오류:', error);
            setIsProcessingOrder(false);
            throw error;
        }
    };

    const removeFileItem = async (id: number) => {
        const updatedItems = fileItems.filter(item => item.id !== id);
        setFileItems(updatedItems);

        // Firebase에서도 삭제
        if (user) {
            try {
                const quotesRef = doc(db, 'savedQuotes', user.uid);
                const savedQuotes = updatedItems.map(item => ({
                    id: item.id,
                    fileName: item.fileName,
                    material: item.material,
                    color: item.color,
                    colorHex: item.colorHex,
                    quantity: item.quantity,
                    price: item.price,
                    savedFilePath: item.savedFilePath,
                    savedAt: new Date().toISOString()
                }));

                await updateDoc(quotesRef, {
                    quotes: savedQuotes,
                    updatedAt: new Date().toISOString()
                });
            } catch (error) {
                console.error('Firebase 삭제 오류:', error);
            }
        }
    };

    const updateQuantity = async (id: number, newQuantity: number) => {
        const updatedItems = fileItems.map(item =>
            item.id === id ? {...item, quantity: newQuantity} : item
        );
        setFileItems(updatedItems);

        // Firebase 업데이트
        if (user) {
            try {
                const quotesRef = doc(db, 'savedQuotes', user.uid);
                const savedQuotes = updatedItems.map(item => ({
                    id: item.id,
                    fileName: item.fileName,
                    material: item.material,
                    color: item.color,
                    colorHex: item.colorHex,
                    quantity: item.quantity,
                    price: item.price,
                    savedFilePath: item.savedFilePath,
                    savedAt: new Date().toISOString()
                }));

                await updateDoc(quotesRef, {
                    quotes: savedQuotes,
                    updatedAt: new Date().toISOString()
                });
            } catch (error) {
                console.error('Firebase 업데이트 오류:', error);
            }
        }
    };

    // 로딩 중일 경우만 로딩 표시
    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <p className={styles.pageLoading}>로딩 중...</p>
                </div>
            </div>
        );
    }

    const colorOptions = material ? (materialColors[material] ?? []) : [];
    const selectedColor = colorOptions.find((c) => c.name === color) ?? null;
    const hasUnavailableColor = colorOptions.some((c) => !c.available);
    const hasFile = uploadedFiles.length > 0;
    const hasEstimate = hasCalculatedEstimate && estimatedPrice > 0;
    const saveDisabled = !hasEstimate || saveStatus !== 'idle';
    const calculateBlocked = !hasFile || !material || !color || isCalculating || isPrintSizeExceeded;
    const totalQuantity = fileItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = fileItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const previewExt = currentPreviewFile?.name.split('.').pop()?.toLowerCase();
    const previewRotatable = !!currentPreviewFile && previewExt !== 'stp' && previewExt !== 'step';
    const dimsText = modelDims
        ? `${modelDims.x.toFixed(1)} × ${modelDims.y.toFixed(1)} × ${modelDims.z.toFixed(1)} mm`
        : '';

    // 진행 순서: 저장까지 마쳐 올린 파일이 비워졌으면 앞의 세 단계는 끝난 것으로 본다
    const stepDone = !hasFile && fileItems.length > 0
        ? [true, true, true, false]
        : [hasFile, !!material && !!color, hasEstimate, false];
    const currentStep = stepDone.indexOf(false);

    return (

        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <header className={styles.pageHead}>
                    <div className={styles.titleWrapper}>
                        <h1 className={styles.pageTitle}>실시간 견적 확인</h1>
                        <a className={styles.guide} href="/quote/file/guide.pdf" download="견적가이드.pdf">
                            견적가이드 다운로드
                            <IconDownload />
                        </a>
                    </div>
                    <div className={styles.subTitleRow}>
                        <div>
                            <p className={styles.subTitle}>3D프린팅의 예상견적을 확인할 수 있습니다.</p>
                            <p className={styles.subTitle}>실제견적요청 시, 데이터를 압축하여 첨부 부탁드립니다.</p>
                        </div>
                        <div className={styles.consultBanner}>
                            <p className={styles.consultText}>앗! 아직 파일이 준비되지 않았나요?<br/>전문가와 상담하여 3D파일 설계부터 시작해보세요!</p>
                            <a
                                href={TALK_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.consultBtn}
                            >
                                상담하기
                            </a>
                        </div>
                    </div>
                </header>

                {/* 진행 순서: 누르면 그 구역으로 내려간다 */}
                <ol className={styles.steps} aria-label="견적 진행 순서">
                    {STEPS.map((step, index) => {
                        const state = stepDone[index] ? 'done' : index === currentStep ? 'current' : 'todo';
                        return (
                            <li
                                key={step.id}
                                className={`${styles.step} ${state === 'done' ? styles.stepDone : ''} ${state === 'current' ? styles.stepCurrent : ''}`}
                                aria-current={state === 'current' ? 'step' : undefined}
                            >
                                <button type="button" className={styles.stepButton} onClick={() => scrollToSection(step.target)}>
                                    <span className={styles.stepMark} aria-hidden="true">
                                        {state === 'done' ? <IconCheck size={14} /> : index + 1}
                                    </span>
                                    <span className={styles.stepLabel}>{step.label}</span>
                                    {state !== 'todo' && (
                                        <span className={styles.srOnly}>{state === 'done' ? ' (완료)' : ' (지금 단계)'}</span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <section
                    id="quote-upload"
                    className={`${styles.fileUploader} ${isDragOver ? styles.dragOver : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>STL 파일 업로드</h2>
                        <p className={styles.cardMeta}>한 파일 최대 {FILE_SIZE_LIMIT_MB}MB</p>
                    </div>
                    <input
                        type="file"
                        multiple
                        accept=".stl,.obj,.stp,.step"
                        onChange={handleFileUpload}
                        className={styles.fileInput}
                        id="fileInput"
                        aria-label="견적 낼 3D 파일 선택"
                    />
                    {!hasFile ? (
                        <label htmlFor="fileInput" className={styles.dragBox}>
                            <IconUpload />
                            <span className={styles.dragText}>STL / OBJ / STP 파일을 드래그 하거나, 파일을 올려주세요.</span>
                            <span className={styles.fileUploadBtn}>파일 선택</span>
                        </label>
                    ) : (
                        <div className={styles.uploaded}>
                            <ul className={styles.uploadedList}>
                                {uploadedFiles.map((file, index) => (
                                    <li key={`${file.name}-${index}`} className={styles.uploadedItem}>
                                        <span className={styles.fileBadge} aria-hidden="true">{fileExtension(file.name)}</span>
                                        <div className={styles.uploadedText}>
                                            <p className={styles.uploadedName}>{file.name}</p>
                                            <p className={styles.uploadedMeta}>
                                                {formatFileSize(file.size)}
                                                {index === 0 && dimsText && ` · 크기 ${dimsText}`}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className={styles.uploadedActions}>
                                <label htmlFor="fileInput" className={styles.ghostBtn}>다른 파일 선택</label>
                                <button type="button" className={styles.ghostBtn} onClick={clearUploadedFile}>지우기</button>
                            </div>
                        </div>
                    )}
                    {isPrintSizeExceeded && overSizeDimensions && (
                        <p className={styles.inlineAlert} role="alert">
                            출력할 수 있는 크기({PRINT_SIZE_LIMIT_MM} × {PRINT_SIZE_LIMIT_MM} × {PRINT_SIZE_LIMIT_MM}mm)를 넘는 파일입니다.
                            <button type="button" className={styles.textBtn} onClick={() => setIsPrintSizeModalOpen(true)}>자세히 보기</button>
                        </p>
                    )}
                    {hint?.where === 'upload' && (
                        <p className={styles.inlineAlert} role="alert">{hint.text}</p>
                    )}
                    <p className={styles.in}>
                        .stl / .obj / .stp 파일을 올려주세요. 출력할 수 있는 크기는 {PRINT_SIZE_LIMIT_MM} × {PRINT_SIZE_LIMIT_MM} × {PRINT_SIZE_LIMIT_MM}mm까지입니다.
                    </p>
                </section>

                <div className={styles.selectOption}>
                    <div className={styles.viewer}>
                        {currentPreviewFile ? (
                            // 그림의 크기가 틀의 높이를 밀어내지 않도록 틀 안에 띄워 둔다
                            <div className={styles.viewerStage}>
                                <STLViewer
                                    file={currentPreviewFile}
                                    className={styles.stlViewer}
                                    onDimensions={handleDimensions}
                                    modelColor={selectedColor?.hex}
                                />
                            </div>
                        ) : (
                            <div className={styles.viewerPlaceholder}>
                                <IconCube />
                                <p>STL 파일을 업로드하면</p>
                                <p>3D 미리보기가 표시됩니다</p>
                            </div>
                        )}
                        {previewRotatable && (
                            <div className={styles.viewerInfo}>
                                {dimsText && <span className={styles.viewerChip}>크기 {dimsText}</span>}
                                <span className={styles.viewerTip}>끌어서 돌려 볼 수 있습니다</span>
                            </div>
                        )}
                    </div>
                    <section id="quote-options" className={styles.option}>
                        <h2 className={styles.optionTitle}>상세 설정</h2>

                        <div className={styles.field}>
                            <div className={styles.fieldHead}>
                                <span id="quote-material-label" className={styles.fieldLabel}>
                                    소재 <span className={styles.required} aria-hidden="true">*</span>
                                </span>
                                <Link href={MATERIAL_GUIDE_URL} target="_blank" className={styles.fieldLink}>
                                    소재별 차이 보기
                                </Link>
                            </div>
                            <MaterialSelect
                                options={MATERIAL_OPTIONS}
                                value={material}
                                onChange={handleMaterialChange}
                                labelledBy="quote-material-label"
                                disabled={isCalculating}
                                invalid={hint?.where === 'option' && !material}
                                buttonRef={materialButtonRef}
                            />
                        </div>

                        <div className={styles.field}>
                            <div className={styles.fieldHead}>
                                <span id="quote-color-label" className={styles.fieldLabel}>
                                    색상 <span className={styles.required} aria-hidden="true">*</span>
                                </span>
                                {selectedColor ? (
                                    <span className={styles.colorSelectedLabel}>
                                        {selectedColor.name}
                                        {selectedColor.hex !== TRANSPARENT_SENTINEL && (
                                            <span className={styles.colorHex}>{selectedColor.hex}</span>
                                        )}
                                    </span>
                                ) : (
                                    <span className={styles.colorPlaceholder}>선택해주세요</span>
                                )}
                            </div>

                            {!material ? (
                                <p className={styles.colorNoMaterial}>소재를 먼저 선택해주세요</p>
                            ) : !colorsLoaded ? (
                                <p className={styles.colorNoMaterial}>색상을 불러오는 중입니다...</p>
                            ) : colorOptions.length === 0 ? (
                                <p className={styles.colorNoMaterial}>지금 고를 수 있는 색상이 없습니다. 상담으로 문의해 주세요.</p>
                            ) : (
                                <>
                                    <div
                                        ref={colorGridRef}
                                        className={styles.colorGrid}
                                        role="group"
                                        aria-labelledby="quote-color-label"
                                    >
                                        {colorOptions.map((colorOption) => {
                                            const isSelected = color === colorOption.name;
                                            const isTransparent = colorOption.hex === TRANSPARENT_SENTINEL;
                                            const selectable = colorOption.available && !isCalculating;
                                            const circleClasses = [
                                                styles.colorCircle,
                                                isSelected ? styles.selected : '',
                                                !colorOption.available ? styles.unavailable : '',
                                                isTransparent ? styles.transparent : '',
                                            ].filter(Boolean).join(' ');

                                            return (
                                                <button
                                                    type="button"
                                                    key={`${colorOption.code}-${colorOption.name}`}
                                                    className={circleClasses}
                                                    title={`${colorOption.name} (${colorOption.code})${!colorOption.available ? ' · 품절' : ''}`}
                                                    onClick={() => { if (selectable) handleColorSelect(colorOption.name); }}
                                                    style={isTransparent ? undefined : { backgroundColor: colorOption.hex }}
                                                    aria-label={`${colorOption.name}${!colorOption.available ? ' (품절)' : ''}`}
                                                    aria-pressed={isSelected}
                                                    aria-disabled={!selectable}
                                                    tabIndex={colorOption.available ? 0 : -1}
                                                />
                                            );
                                        })}
                                    </div>
                                    {hasUnavailableColor && (
                                        <p className={styles.colorLegend}>빗금이 그어진 색상은 품절입니다.</p>
                                    )}
                                </>
                            )}
                        </div>

                        <p className={styles.infoText}>솔리드 데이터 일 경우, 예상견적이 높게 산출됩니다.</p>

                        <div className={styles.calculateBtnWrapper}>
                            <ul className={styles.readyList} aria-label="견적에 필요한 항목">
                                {([['파일', hasFile], ['소재', !!material], ['색상', !!color]] as const).map(([name, ready]) => (
                                    <li key={name} className={ready ? styles.ready : ''}>
                                        <IconCheck size={12} />
                                        {name}
                                        <span className={styles.srOnly}>{ready ? ' 준비됨' : ' 필요'}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                className={`${styles.calculateBtn} ${calculateBlocked ? styles.btnMuted : ''}`}
                                onClick={() => {
                                    if (isCalculating) return;
                                    if (isPrintSizeExceeded) {
                                        setIsPrintSizeModalOpen(true);
                                        return;
                                    }
                                    calculateEstimate();
                                }}
                            >
                                {isCalculating ? '계산 중...' : '견적내기'}
                            </button>
                            {hint?.where === 'option' && (
                                <p className={styles.inlineAlert} role="alert">{hint.text}</p>
                            )}
                        </div>

                        <div id="quote-result" className={styles.result} aria-live="polite">
                            <div className={styles.priceWrapper}>
                                <p className={styles.title}>예상 견적</p>
                                <p className={styles.vat}>(VAT 포함)</p>
                            </div>
                            {isCalculating ? (
                                <div className={styles.loadingWrapper}>
                                    <div className={styles.loadingContent}>
                                        <div className={styles.spinner}></div>
                                        <span className={styles.loadingText}>견적을 계산하고 있습니다...</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill}></div>
                                    </div>
                                    <p className={styles.loadingNote}>파일 크기에 따라 시간이 조금 걸릴 수 있습니다.</p>
                                </div>
                            ) : hasEstimate ? (
                                <>
                                    <p className={styles.price}>₩ {estimatedPrice.toLocaleString()}</p>
                                    <p className={styles.printTime}>
                                        1개 기준
                                        {printTime && ` · 예상 출력 시간: ${formatPrintTime(printTime)}`}
                                    </p>
                                </>
                            ) : (
                                <p className={styles.priceEmpty}>견적내기를 누르면 예상 금액이 여기에 표시됩니다.</p>
                            )}
                        </div>

                        <div className={styles.saveArea}>
                            <button
                                type="button"
                                className={`${styles.saveBtn} ${saveDisabled ? styles.disabled : ''}`}
                                onClick={handleSave}
                            >
                                {saveStatus === 'saving' ? '저장 중...' : '견적 저장하기'}
                            </button>
                            <p className={styles.saveNote}>
                                {user ? (
                                    '저장하면 아래 ‘저장한 견적’에 담기고, 견적문의를 할 수 있습니다.'
                                ) : (
                                    <>저장과 견적문의는 <Link href="/login">로그인</Link> 후 이용할 수 있습니다.</>
                                )}
                            </p>
                        </div>
                    </section>
                </div>

                <section id="quote-list" className={styles.fileList}>
                    <div className={styles.cardHead}>
                        <h2 className={styles.cardTitle}>저장한 견적</h2>
                        {fileItems.length > 0 && (
                            <p className={styles.cardMeta}>새 파일을 올리면 이 목록은 새로 시작됩니다.</p>
                        )}
                    </div>

                    {fileItems.length === 0 ? (
                        <div className={styles.emptyList}>
                            <p className={styles.emptyTitle}>아직 저장한 견적이 없습니다.</p>
                            <p className={styles.emptyText}>위에서 견적을 낸 뒤 ‘견적 저장하기’를 누르면 여기에 담깁니다.</p>
                        </div>
                    ) : (
                        fileItems.map((item) => {
                            const isTransparent = item.colorHex === TRANSPARENT_SENTINEL;
                            return (
                                <div key={item.id} className={styles.fileItem}>
                                    <div className={styles.filePreview}>
                                        <div className={styles.stlIcon}>{fileExtension(item.fileName)}</div>
                                    </div>
                                    <div className={styles.fileInfo}>
                                        <div className={styles.fileName}>{item.fileName}</div>
                                        <div className={styles.fileDetails}>
                                            <span>소재: {item.material}</span>
                                            <span className={styles.fileColor}>
                                                {item.colorHex && (
                                                    <i
                                                        className={`${styles.fileSwatch} ${isTransparent ? styles.transparent : ''}`}
                                                        style={isTransparent ? undefined : { backgroundColor: item.colorHex }}
                                                        aria-hidden="true"
                                                    />
                                                )}
                                                색상: {item.color}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.filePriceWrapper}>
                                        <div className={styles.filePriceBox}>
                                            <div className={styles.filePrice}>￦ {item.price.toLocaleString()}</div>
                                            <div className={styles.filePriceNote}>
                                                {item.quantity > 1
                                                    ? `${item.quantity}개 합계 ￦ ${(item.price * item.quantity).toLocaleString()}`
                                                    : '1개 금액'}
                                            </div>
                                        </div>
                                        <div className={styles.fileControls} role="group" aria-label={`${item.fileName} 수량`}>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                                className={styles.controlBtn}
                                                aria-label="수량 줄이기"
                                                disabled={item.quantity <= 1}
                                            >
                                                −
                                            </button>
                                            <span className={styles.fileQuantity} aria-live="polite">{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className={styles.controlBtn}
                                                aria-label="수량 늘리기"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeFileItem(item.id)}
                                            className={styles.removeBtn}
                                            aria-label={`${item.fileName} 삭제`}
                                        >
                                            <IconTrash />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    <div className={styles.lastPriceWrapper}>
                        <div>
                            <p className={styles.lastPriceTitle}>최종 견적 요약</p>
                            <p className={styles.lastPriceInfo}>총 {fileItems.length}개 파일</p>
                            <p className={styles.lastPriceInfo}>총 수량: {totalQuantity}개</p>
                        </div>
                        <div className={styles.lastPriceTotal}>
                            <p className={styles.lastPriceInfo}>예상 견적(VAT 포함)</p>
                            <p className={styles.lastPrice}>₩ {totalPrice.toLocaleString()}</p>
                        </div>
                    </div>


                    <div className={styles.cautionSection}>
                        <div className={styles.cautionTitle}>
                            <Image
                                src="/caution_icon.svg"
                                alt=""
                                width={20}
                                height={20}
                            />
                            <p>유의사항</p>
                        </div>
                        <div className={styles.cautionInfoWrapper}>
                            <p className={styles.cautionInfo}>실시간 자동 견적은 기본 3D프린팅 세팅값에 따라 견적이 산출됩니다.</p>
                            <p className={styles.cautionInfo}>세팅이 바뀌면 금액이 변동될 수 있습니다.</p>
                            <p className={styles.cautionInfo}>실시간 견적은 실제 견적보다 상이할 수 있으며, 반드시 최종 상담 진행 후 결제를 진행해주세요.</p>
                            <p className={styles.cautionInfo}>설계나 수정이 필요하신 경우, 고객센터 (054-462-4140)로 문의 부탁드립니다.</p>
                        </div>
                    </div>

                    <div className={styles.orderWrapper}>
                        {hint?.where === 'list' && (
                            <p className={styles.inlineAlert} role="alert">{hint.text}</p>
                        )}
                        <button
                            type="button"
                            className={`${styles.inquiryBtn} ${fileItems.length === 0 ? styles.btnMuted : ''}`}
                            onClick={handleOrderClick}
                        >
                            견적문의하기
                        </button>
                    </div>
                    {/* 쇼핑가이드 섹션 */}
                    <div className={styles.shoppingGuide}>
                        <div className={styles.tabWrapper} role="tablist" aria-label="쇼핑가이드">
                            {(['상품결제정보', '배송정보', '교환 및 반품정보'] as const).map((tabName, index) => (
                                <button
                                    type="button"
                                    key={tabName}
                                    role="tab"
                                    aria-selected={activeShoppingGuideTab === tabName}
                                    className={`${index === 1 ? styles.tabCenter : styles.tab} ${activeShoppingGuideTab === tabName ? styles.active : ''}`}
                                    onClick={() => setActiveShoppingGuideTab(tabName)}
                                >
                                    {tabName}
                                </button>
                            ))}
                        </div>

                        <div className={styles.shoppingGuideContent}>
                            {activeShoppingGuideTab === '상품결제정보' && (
                                <>
                                    <p className={styles.contentLine}>■ 결제 안내</p>
                                    <p className={styles.contentLine}>- 본 상품은 Maker 3D에서 제작·판매하는 주문 제작(3D프린팅) 상품입니다.</p>
                                    <p className={styles.contentLine}>- 결제 완료와 동시에 제작이 즉시 시작됩니다.</p>
                                    <p className={styles.contentLine}>- 결제 수단: 네이버페이(신용카드, 계좌이체, 간편결제 등)</p>
                                    <p className={styles.contentLine}>- 현금영수증 발행 가능 (결제 단계에서 신청)</p>
                                    <p className={styles.contentLine}>&nbsp;</p>
                                    <p className={styles.contentLine}>■ 제작 및 배송 안내</p>
                                    <p className={styles.contentLine}>- 제작 기간: 결제 완료 후 근무일 기준 2~5영업일 (주문이 많으면 출고일이 조금 밀릴 수 있습니다.) </p>
                                    <p className={styles.contentLine}>- 배송 기간: 제작 완료 후 1~3영업일</p>
                                    <p className={styles.contentLine}>- 배송비: 기본 배송비 3,000원 (도서·산간 지역은 추가 배송비가 발생할 수 있습니다.)</p>
                                    <p className={styles.contentLine}>&nbsp;</p>
                                    <p className={styles.contentLine}>■ 취소·환불 안내 (중요)</p>
                                    <p className={styles.contentLine}>- 본 상품은 고객 요청에 따라 개별 제작되는 주문 제작 상품으로, 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라 결제 완료 후 제작이 시작된 이후에는 청약철회(취소)가 제한될 수 있습니다.</p>
                                    <p className={styles.contentLine}>- 단순 변심, 옵션 선택 오류, 고객 제공 데이터 오류로 인한 취소·환불은 불가합니다.</p>
                                    <p className={styles.contentLine}>- 출력 불량, 파손, 오배송 등 판매자 귀책 사유가 확인될 경우 재제작 또는 환불로 처리됩니다.</p>
                                    <p className={styles.contentLine}>- 불량 접수는 상품 수령 후 7일 이내 고객센터로 접수해 주세요.</p>
                                    <p className={styles.contentLine}>&nbsp;</p>
                                    <p className={styles.contentLine}>■ 3D프린팅 제품 유의사항</p>
                                    <p className={styles.contentLine}>- 3D프린팅 공정 특성상 미세한 적층 흔적, 표면 질감, 색상 오차가 발생할 수 있으며 이는 제조 공정상 자연스러운 현상으로 불량 사유에 해당하지 않습니다.</p>
                                    <p className={styles.contentLine}>- 제품 이미지와 실제 출력물은 모니터 환경에 따라 차이가 있을 수 있습니다.</p>
                                    <p className={styles.contentLine}>&nbsp;</p>
                                    <p className={styles.contentLine}>■ 고객센터 안내</p>
                                    <p className={styles.contentLine}>- 문의 방법: 자사몰 고객센터 054-462-4140 / Maker 3D카카오채널 1:1 문의</p>
                                    <p className={styles.contentLine}>- 운영 시간: 평일 09:00 ~ 19:00 (주말·공휴일 휴무)</p>
                                </>
                            )}
                            {activeShoppingGuideTab === '배송정보' && (
                                <>
                                    <p className={styles.contentLine}>배송안내</p>
                                    <p className={styles.contentLine}>1. 주문 제작 상품은 결제 완료 후 제작이 시작됩니다.</p>
                                    <p className={styles.contentLine}>2. 제작 기간은 결제 완료 후 근무일 기준 2~5영업일입니다. (주문이 많으면 출고일이 조금 밀릴 수 있습니다.)</p>
                                    <p className={styles.contentLine}>3. 배송 기간은 제작 완료 후 1~3영업일이며 택배사 사정에 따라 달라질 수 있습니다.</p>
                                    <p className={styles.contentLine}>4. 도서·산간 지역은 추가 배송비가 발생할 수 있습니다.</p>
                                </>
                            )}
                            {activeShoppingGuideTab === '교환 및 반품정보' && (
                                <>
                                    <p className={styles.contentLine}>교환/반품</p>
                                    <p className={styles.contentLine}>1. 일반 상품은 상품 수령일로부터 7일 이내 환불 신청이 가능합니다.</p>
                                    <p className={styles.contentLine}>2. 주문 제작(3D프린팅) 상품은 전자상거래법 제17조 제2항에 따라 결제 완료 후 제작이 시작된 이후에는 단순 변심에 의한 환불이 제한됩니다.</p>
                                    <p className={styles.contentLine}>3. 판매자 귀책 사유(출력 불량, 파손, 오배송)의 경우 재제작 또는 환불로 처리됩니다.</p>
                                    <p className={styles.contentLine}>4. 환불은 확인 후 영업일 기준 3~7일 이내 처리됩니다.</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.cautionWrapper}>



                        {/* 이용약관 섹션 - 유의사항 아래로 이동 */}
                        <div className={styles.termsSection}>
                            <div className={styles.termsHeader}>
                                <h3 className={styles.termsTitle}>Maker 3D 쇼핑몰이용약관</h3>
                                <button
                                    className={styles.termsToggleBtn}
                                    onClick={() => setIsTermsExpanded(!isTermsExpanded)}
                                >
                                    {isTermsExpanded ? '접기' : '전체보기'}
                                </button>
                            </div>
                            <div className={`${styles.termsContent} ${isTermsExpanded ? styles.expanded : ''}`}>
                                <div className={styles.termsItem}>
                                    <h4>제1조 (목적)</h4>
                                    <p>이 약관은 주식회사 비트텍(이하 "회사")이 운영하는 온라인 쇼핑몰 Maker 3D(이하 "몰")에서 제공하는 서비스 이용과 관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제2조 (정의)</h4>
                                    <p>1. "몰"이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 설정한 온라인 쇼핑몰을 말합니다.</p>
                                    <p>2. "이용자"란 몰에 접속하여 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</p>
                                    <p>3. "회원"이란 몰에 회원등록을 한 자로서 지속적으로 서비스를 이용할 수 있는 자를 말합니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제3조 (약관의 명시 및 개정)</h4>
                                    <p>1. 회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 몰에 게시합니다.</p>
                                    <p>2. 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</p>

                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제4조 (서비스의 제공)</h4>
                                    <p>회사는 다음과 같은 서비스를 제공합니다.</p>
                                    <p>1. 재화 또는 용역에 대한 정보 제공 및 구매계약 체결</p>
                                    <p>2. 주문 제작(3D프린팅) 상품의 제작 및 배송</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제5조 (결제 및 제작 개시 시점)</h4>
                                    <p>1. 주문 제작 상품은 주문과 동시에 제작이 진행되는 주문 제작(3D프린팅)상품으로, 결제 완료 시점에 제작이 즉시 시작됩니다.</p>
                                    <p>2. 결제 완료 후 제작이 개시된 경우 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라 청약철회가 제한될 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제6조 (주문 제작 상품 특화 조항)</h4>
                                    <p>1. 주문 제작 상품은 고객의 요청에 따라 개별 제작되는 맞춤 제작 상품으로, 단순 변심, 옵션 선택 오류, 고객 제공 데이터 오류를 사유로 한 취소·환불·교환이 불가합니다.</p>
                                    <p>2. 단, 상품수령 시 출력 불량, 파손, 오배송 등 판매자 귀책 사유가 확인될 경우 관련 법령에 따라 재제작 또는 환불로 처리됩니다.</p>
                                    <p>3. 3D프린팅 공정 특성상 발생하는 미세한 적층 흔적, 표면 질감 차이, 색상 오차는 제조 공정상 자연스러운 현상으로 불량에 해당하지 않습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제7조 (배송)</h4>
                                    <p>1. 상품은 결제 완료 및 제작 완료 후 순차적으로 배송됩니다.</p>
                                    <p>2. 배송 기간은 제작 기간과 택배사 사정에 따라 달라질 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제8조 (청약철회 및 환불)</h4>
                                    <p>1. 일반 상품은 상품 수령일로부터 7일 이내 청약철회가 가능합니다.</p>
                                    <p>2. 주문 제작 상품은 관련 법령에 따라 청약철회가 제한될 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제9조 (개인정보 보호)</h4>
                                    <p>회사는 개인정보보호법 등 관계 법령을 준수하며 개인정보처리방침에 따라 이용자의 개인정보를 보호합니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제10조 (분쟁 해결)</h4>
                                    <p>회사는 이용자가 제기하는 정당한 불만 및 의견을 신속히 처리하며, 분쟁 발생 시 「전자상거래 등에서의 소비자보호에 관한 법률」 및 공정거래위원회 소비자분쟁해결기준을 따릅니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제11조 (면책 조항)</h4>
                                    <p>천재지변, 시스템 장애 등 회사의 귀책 사유가 아닌 사유로 발생한 손해에 대하여 회사는 책임을 지지 않습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제12조 (준거법 및 관할)</h4>
                                    <p>본 약관은 대한민국 법을 준거법으로 하며, 본 약관과 관련된 분쟁의 관할 법원은 회사의 본점 소재지를 관할하는 법원으로 합니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>부칙</h4>
                                    <p>본 약관은 2026년 03월 01일부터 시행합니다.</p>
                                </div>
                            </div>
                        </div>

                        {/* 상품결제정보 섹션 */}
                        <div className={styles.termsSection}>
                            <div className={styles.termsHeader}>
                                <h3 className={styles.termsTitle}>MAKER3D 상품결제정보</h3>
                                <button
                                    className={styles.termsToggleBtn}
                                    onClick={() => setIsPaymentInfoExpanded(!isPaymentInfoExpanded)}
                                >
                                    {isPaymentInfoExpanded ? '접기' : '전체보기'}
                                </button>
                            </div>
                            <div className={`${styles.termsContent} ${isPaymentInfoExpanded ? styles.expanded : ''}`}>
                                <div className={styles.termsItem}>
                                    <h4>■ 결제 안내</h4>
                                    <p>- 본 상품은 Maker 3D에서 제작·판매하는 주문 제작(3D프린팅) 상품입니다.</p>
                                    <p>- 결제 완료와 동시에 제작이 즉시 시작됩니다.</p>
                                    <p>- 결제 수단: 네이버페이(신용카드, 계좌이체, 간편결제 등)</p>
                                    <p>- 현금영수증 발행 가능 (결제 단계에서 신청)</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>■ 제작 및 배송 안내</h4>
                                    <p>- 제작 기간: 결제 완료 후 2~5영업일</p>
                                    <p>- 배송 기간: 제작 완료 후 1~3영업일</p>
                                    <p>- 배송비: 기본 배송비 3,000원 (도서·산간 지역은 추가 배송비가 발생할 수 있습니다.)</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>■ 취소·환불 안내 (중요)</h4>
                                    <p>- 본 상품은 고객 요청에 따라 개별 제작되는 주문 제작 상품으로, 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라 결제 완료 후 제작이 시작된 이후에는 청약철회(취소)가 제한될 수 있습니다.</p>
                                    <p>- 단순 변심, 옵션 선택 오류, 고객 제공 데이터 오류로 인한 취소·환불은 불가합니다.</p>
                                    <p>- 출력 불량, 파손, 오배송 등 판매자 귀책 사유가 확인될 경우 재제작 또는 환불로 처리됩니다.</p>
                                    <p>- 불량 접수는 상품 수령 후 7일 이내 고객센터로 접수해 주세요.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>■ 3D프린팅 제품 유의사항</h4>
                                    <p>- 3D프린팅 공정 특성상 미세한 적층 흔적, 표면 질감, 색상 오차가 발생할 수 있으며 이는 제조 공정상 자연스러운 현상으로 불량 사유에 해당하지 않습니다.</p>
                                    <p>- 제품 이미지와 실제 출력물은 모니터 환경에 따라 차이가 있을 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>■ 고객센터 안내</h4>
                                    <p>- 문의 방법: 자사몰 고객센터 054-462-4140 / Maker 3D카카오채널 1:1 문의</p>
                                    <p>- 운영 시간: 평일 09:00 ~ 19:00 (주말·공휴일 휴무)</p>
                                </div>
                            </div>
                        </div>

                        {/* 개인정보처리방침 섹션 */}
                        <div className={styles.termsSection}>
                            <div className={styles.termsHeader}>
                                <h3 className={styles.termsTitle}>Maker 3D 개인정보처리방침</h3>
                                <button
                                    className={styles.termsToggleBtn}
                                    onClick={() => setIsPrivacyPolicyExpanded(!isPrivacyPolicyExpanded)}
                                >
                                    {isPrivacyPolicyExpanded ? '접기' : '전체보기'}
                                </button>
                            </div>
                            <div className={`${styles.termsContent} ${isPrivacyPolicyExpanded ? styles.expanded : ''}`}>
                                <div className={styles.termsItem}>
                                    <h4>제1조 (개인정보의 수집 항목 및 방법)</h4>
                                    <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
                                    <p>- 필수 항목: 이름, 연락처, 배송지 주소, 결제 정보</p>
                                    <p>- 수집 방법: 회원가입, 주문 및 결제 과정</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제2조 (개인정보의 수집 및 이용 목적)</h4>
                                    <p>회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.</p>
                                    <p>- 주문 처리 및 상품 배송</p>
                                    <p>- 결제 및 환불 처리</p>
                                    <p>- 고객 상담 및 분쟁 처리</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제3조 (개인정보의 보유 및 이용 기간)</h4>
                                    <p>회사는 개인정보를 수집 및 이용 목적 달성 시까지 보유하며, 관계 법령에 따라 일정 기간 보관할 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제4조 (개인정보의 제3자 제공)</h4>
                                    <p>회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 상품 배송을 위해 택배사에 최소한의 정보가 제공될 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제5조 (개인정보 보호 책임자)</h4>
                                    <p>- 개인정보 보호 책임자: 장재영</p>
                                    <p>- 직위: 대표이사</p>
                                    <p>- 연락처: 054-462-4140</p>
                                    <p>- 이메일: 3dstore@bittech3d.com</p>
                                </div>
                            </div>
                        </div>

                        {/* 배송 및 환불 정책 섹션 */}
                        <div className={styles.termsSection}>
                            <div className={styles.termsHeader}>
                                <h3 className={styles.termsTitle}>Maker 3D 배송 및 환불 정책</h3>
                                <button
                                    className={styles.termsToggleBtn}
                                    onClick={() => setIsShippingPolicyExpanded(!isShippingPolicyExpanded)}
                                >
                                    {isShippingPolicyExpanded ? '접기' : '전체보기'}
                                </button>
                            </div>
                            <div className={`${styles.termsContent} ${isShippingPolicyExpanded ? styles.expanded : ''}`}>
                                <div className={styles.termsItem}>
                                    <h4>제1조 (배송 정책)</h4>
                                    <p>1. 주문 제작 상품은 결제 완료 후 제작이 시작됩니다.</p>
                                    <p>2. 제작 기간은 결제 완료 후 2~5영업일입니다.</p>
                                    <p>3. 배송 기간은 제작 완료 후 1~3영업일이며 택배사 사정에 따라 달라질 수 있습니다.</p>
                                    <p>4. 도서·산간 지역은 추가 배송비가 발생할 수 있습니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>제2조 (환불 및 반품 정책)</h4>
                                    <p>1. 일반 상품은 상품 수령일로부터 7일 이내 환불 신청이 가능합니다.</p>
                                    <p>2. 주문 제작(3D프린팅) 상품은 전자상거래법 제17조 제2항에 따라 결제 완료 후 제작이 시작된 이후에는 단순 변심에 의한 환불이 제한됩니다.</p>
                                    <p>3. 판매자 귀책 사유(출력 불량, 파손, 오배송)의 경우 재제작 또는 환불로 처리됩니다.</p>
                                    <p>4. 환불은 확인 후 영업일 기준 3~7일 이내 처리됩니다.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

            </div>

            {/* 출력 크기 초과 모달 */}
            {isPrintSizeModalOpen && overSizeDimensions && (
                <QuoteDialog tone="danger" title="출력 가능 크기 초과" onClose={() => setIsPrintSizeModalOpen(false)}>
                    <p className={styles.dialogText}>
                        최대 출력 크기는 <strong>{PRINT_SIZE_LIMIT_MM} × {PRINT_SIZE_LIMIT_MM} × {PRINT_SIZE_LIMIT_MM} mm</strong>입니다.<br />
                        업로드한 파일의 크기가 이를 초과합니다.
                    </p>
                    <dl className={styles.dialogBox}>
                        {(['x', 'y', 'z'] as const).map((axis) => {
                            const over = overSizeDimensions[axis] > PRINT_SIZE_LIMIT;
                            return (
                                <div key={axis} className={styles.dialogRow}>
                                    <dt>{axis.toUpperCase()}축</dt>
                                    <dd className={over ? styles.dialogOver : ''}>
                                        {overSizeDimensions[axis].toFixed(1)} mm
                                        <span className={styles.dialogMark}>{over ? '초과' : '가능'}</span>
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                    <p className={styles.dialogNote}>파일을 분할하거나 크기를 줄인 후 다시 업로드해 주세요.</p>
                    <button type="button" className={styles.dialogPrimary} onClick={() => setIsPrintSizeModalOpen(false)}>
                        확인
                    </button>
                </QuoteDialog>
            )}

            {/* 파일 용량 초과 모달 */}
            {isFileSizeModalOpen && (
                <QuoteDialog
                    tone="warn"
                    title="파일이 너무 큽니다!"
                    onClose={() => { setIsFileSizeModalOpen(false); setEmailCopied(false); }}
                >
                    <p className={styles.dialogText}>
                        {FILE_SIZE_LIMIT_MB}MB 이상 파일은 아래 이메일로 파일을 보내주세요!
                    </p>
                    <button
                        type="button"
                        className={styles.dialogCopy}
                        onClick={() => {
                            navigator.clipboard.writeText('3dstore@bittech3d.com');
                            setEmailCopied(true);
                            setTimeout(() => setEmailCopied(false), 2000);
                        }}
                    >
                        <IconCopy />
                        3dstore@bittech3d.com
                    </button>
                    <p className={styles.dialogCopied} aria-live="polite">
                        {emailCopied && '✓ 이메일 주소가 복사되었습니다'}
                    </p>
                    <a
                        href={TALK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.dialogSecondary}
                        onClick={() => setIsFileSizeModalOpen(false)}
                    >
                        1:1 문의하기
                    </a>
                    <button
                        type="button"
                        className={styles.dialogPrimary}
                        onClick={() => { setIsFileSizeModalOpen(false); setEmailCopied(false); }}
                    >
                        확인
                    </button>
                </QuoteDialog>
            )}

            {/* 견적 계산 오류 모달 */}
            {isEstimateErrorModalOpen && (
                <QuoteDialog tone="danger" title="견적 계산 오류" onClose={() => setIsEstimateErrorModalOpen(false)}>
                    <p className={styles.dialogText}>
                        견적 계산 중 오류가 발생했습니다.<br />
                        아래 톡톡으로 문의해 주세요.
                    </p>
                    <a
                        href={TALK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.dialogTalk}
                    >
                        네이버 톡톡으로 문의하기
                    </a>
                    <button type="button" className={styles.dialogSecondary} onClick={() => setIsEstimateErrorModalOpen(false)}>
                        닫기
                    </button>
                </QuoteDialog>
            )}

            {/* 로그인 안내 모달: 바로 로그인 화면으로 넘기지 않고, 올린 파일이 사라진다는 것을 먼저 알린다 */}
            {loginPrompt && (
                <QuoteDialog tone="info" title="로그인이 필요합니다" onClose={() => setLoginPrompt(null)}>
                    <p className={styles.dialogText}>
                        {loginPrompt === 'save'
                            ? '견적 저장은 로그인 후 이용할 수 있습니다.'
                            : '견적문의는 로그인 후 이용할 수 있습니다.'}
                    </p>
                    {hasFile && (
                        <p className={styles.dialogNote}>
                            로그인 화면으로 이동하면 지금 올린 파일과 견적은 다시 진행해야 합니다.
                        </p>
                    )}
                    <button type="button" className={styles.dialogPrimary} onClick={() => router.push('/login')}>
                        로그인하러 가기
                    </button>
                    <button type="button" className={styles.dialogSecondary} onClick={() => setLoginPrompt(null)}>
                        닫기
                    </button>
                </QuoteDialog>
            )}

            {/* 주문 정보 입력 모달 */}
            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                onSubmit={handleOrderSubmit}
                onNaverPayOrder={handleNaverPayOrder}
                totalPrice={fileItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
                fileCount={fileItems.length}
            />

            {/* 견적 저장 중 전체화면 오버레이 */}
            {saveStatus !== 'idle' && (
                <div
                    className={styles.saveOverlay}
                    role="status"
                    aria-live="polite"
                    aria-busy={saveStatus === 'saving'}
                >
                    <div className={styles.saveOverlayCard}>
                        {saveStatus === 'saving' ? (
                            <>
                                <div className={styles.saveSpinner} />
                                <p className={styles.saveOverlayTitle}>예상 견적을 저장 및 최종 견적에 포함하는 중입니다</p>
                                <p className={styles.saveOverlaySub}>파일을 업로드하고 있어요. 잠시만 기다려주세요.</p>
                                <div className={styles.saveProgressBar}>
                                    <div className={styles.saveProgressFill} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.saveDoneIcon}>✓</div>
                                <p className={styles.saveOverlayTitle}>저장 완료</p>
                                <p className={styles.saveOverlaySub}>아래 최종 견적 목록에 추가되었습니다.</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}