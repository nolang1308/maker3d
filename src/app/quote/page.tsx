'use client';

import styles from './page.module.scss';
import Image from "next/image";
import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/contexts/AuthContext';
import STLViewer from '../../components/STLViewer';
import OrderModal, { CustomerInfo } from '@/components/OrderModal';
import { generateOrderNumber, uploadSTLFiles, saveOrder, OrderData } from '@/utils/orderUtils';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

interface FileItem {
    id: number;
    fileName: string;
    material: string;
    color: string;
    quantity: number;
    price: number;
    file: File | null;
    savedFilePath?: string; // 백엔드에 저장된 파일 경로
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
    const [isTermsExpanded, setIsTermsExpanded] = useState(false); // 이용약관 확장 상태
    const [isPaymentInfoExpanded, setIsPaymentInfoExpanded] = useState(false); // 상품결제정보 확장 상태
    const [isPrivacyPolicyExpanded, setIsPrivacyPolicyExpanded] = useState(false); // 개인정보처리방침 확장 상태
    const [isShippingPolicyExpanded, setIsShippingPolicyExpanded] = useState(false); // 배송 및 환불 정책 확장 상태
    const [activeShoppingGuideTab, setActiveShoppingGuideTab] = useState('상품결제정보'); // 쇼핑가이드 탭 상태

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
                            quantity: quote.quantity,
                            price: quote.price,
                            file: null, // 파일은 백엔드에 저장되어 있음
                            savedFilePath: quote.savedFilePath // 백엔드 파일 경로
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setUploadedFiles(files);
            setCurrentPreviewFile(files[0]);

            // 새 파일 업로드 시 기존 저장된 견적 초기화
            setFileItems([]);
            setEstimatedPrice(0);
            setPrintTime('');
            setHasCalculatedEstimate(false); // 견적 계산 상태 초기화
        }
    };

    const calculateEstimate = async () => {
        // 유효성 검사
        if (uploadedFiles.length === 0) {
            alert('STL 파일을 먼저 업로드해주세요.');
            return;
        }
        if (!material) {
            alert('소재를 선택해주세요.');
            return;
        }
        if (!color) {
            alert('색상을 선택해주세요.');
            return;
        }

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
            } else {
                console.error('견적 계산 오류:', result.error);
                alert('견적 계산에 실패했습니다. 다시 시도해주세요.');
            }
        } catch (error) {
            console.error('네트워크 오류:', error);
            alert('견적 계산 중 오류가 발생했습니다. 다시 시도해주세요.');
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
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const stlFiles = files.filter(file => file.name.toLowerCase().endsWith('.stl'));

        if (stlFiles.length > 0) {
            setUploadedFiles(stlFiles);
            setCurrentPreviewFile(stlFiles[0]);
            // 드래그 앤 드롭 시에도 견적 상태 초기화
            setFileItems([]);
            setEstimatedPrice(0);
            setPrintTime('');
            setHasCalculatedEstimate(false);
        } else {
            alert('STL 파일만 업로드 가능합니다.');
        }
    };

    const handleSave = async () => {
        // 로그인 체크
        if (!user) {
            alert('저장하기는 로그인이 필요한 서비스입니다.');
            router.push('/login');
            return;
        }

        // 견적 계산 완료 확인
        if (!hasCalculatedEstimate || estimatedPrice <= 0) {
            alert('견적내기를 먼저 진행해주세요.');
            return;
        }

        if (uploadedFiles.length > 0 && material && color) {
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
                const newItems: FileItem[] = uploadedFiles.map((file, index) => ({
                    id: Date.now() + index,
                    fileName: file.name,
                    material,
                    color,
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

                // 폼 초기화
                setMaterial('');
                setColor('');
                setQuantity(1);
                setUploadedFiles([]);
                setCurrentPreviewFile(null);
                setEstimatedPrice(0);
                setPrintTime('');
                setHasCalculatedEstimate(false); // 저장 후 견적 상태 초기화

                // 파일 input 초기화
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

                alert('견적이 저장되었습니다!');
            } catch (error) {
                console.error('견적 저장 오류:', error);
                alert('견적 저장 중 오류가 발생했습니다.');
            }
        } else {
            alert('파일을 업로드하고 소재, 색상을 선택해주세요.');
        }
    };

    // 견적 주문하기 버튼 클릭
    const handleOrderClick = () => {
        // 로그인 체크
        if (!user) {
            alert('견적 주문하기는 로그인이 필요한 서비스입니다.');
            router.push('/login');
            return;
        }

        if (fileItems.length === 0) {
            alert('주문할 파일을 먼저 추가해주세요.');
            return;
        }
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
                files: fileItems.map((item, index) => ({
                    fileName: item.fileName,
                    material: item.material,
                    color: item.color,
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
                    <p style={{ textAlign: 'center', marginTop: '100px' }}>로딩 중...</p>
                </div>
            </div>
        );
    }

    return (

        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <div className={styles.titleWrapper}>
                    <p>실시간 견적 확인</p>
                    <div className={styles.guide}>
                        견적가이드 다운로드
                        <Image
                            src="/download_icon.svg"
                            alt="MAKER 3D Logo"
                            width={30}
                            height={30}
                            className={styles.logoIcon}
                        />
                    </div>

                </div>
                <p className={styles.subTitle}>3D프린팅의 예상견적을 확인할 수 있습니다.</p>
                <p className={styles.subTitle}>실제견적요청 시, 데이터를 압축하여 첨부 부탁드립니다.</p>

                <div className={styles.line}></div>
                <div className={styles.fileUploader}>
                    <p>STL 파일 업로드</p>
                    <div 
                        className={`${styles.dragBox} ${isDragOver ? styles.dragOver : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <Image
                            src="/download_icon2.svg"
                            alt="MAKER 3D Logo"
                            width={25}
                            height={26}
                            className={styles.logoIcon}
                        />
                        <p>STL 파일을 드래그 하거나, 파일을 올려주세요.</p>
                        <Image
                            src="/download_divider.svg"
                            alt="MAKER 3D Logo"
                            width={201}
                            height={16}
                            style={{marginTop: 10}}
                        />
                        <input
                            type="file"
                            multiple
                            accept=".stl"
                            onChange={handleFileUpload}
                            style={{display: 'none'}}
                            id="fileInput"
                        />
                        <label htmlFor="fileInput" className={styles.fileUploadBtn}>
                            파일 선택
                        </label>


                    </div>
                    <p className={styles.in}>.stl 파일만 올려주세요.</p>


                </div>
                <div className={styles.selectOption}>
                    <div className={styles.viewer}>
                        {currentPreviewFile ? (
                            <STLViewer file={currentPreviewFile} className={styles.stlViewer} />
                        ) : (
                            <div className={styles.viewerPlaceholder}>
                                <p>STL 파일을 업로드하면</p>
                                <p>3D 미리보기가 표시됩니다</p>
                            </div>
                        )}
                    </div>
                    <div className={styles.option}>
                        <p className={styles.optionTitle}>상세 설정</p>
                        <div className={styles.divider}></div>
                        <div className={styles.optionDropbox}>
                            <span>소재 <span style={{color: '#FF4040', marginLeft: '2px'}}>*</span></span>
                            <select
                                className={styles.dropdown}
                                value={material}
                                onChange={(e) => setMaterial(e.target.value)}
                            >
                                <option value="">선택해주세요</option>
                                <option value="광경화성 레진">광경화성 레진</option>
                                <option value="PLA">PLA</option>
                                <option value="ABS">ABS</option>
                                <option value="PETG">PETG</option>
                                <option value="TPU">TPU</option>
                            </select>
                        </div>
                        <div className={styles.divider}></div>
                        <div className={styles.optionDropbox}>
                            <span>색상 <span style={{color: '#FF4040', marginLeft: '2px'}}>*</span></span>
                            <select
                                className={styles.dropdown}
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                            >
                                <option value="">선택해주세요</option>
                                <option value="G40-JG">G40-JG</option>
                                <option value="화이트">화이트</option>
                                <option value="블랙">블랙</option>
                                <option value="그레이">그레이</option>
                                <option value="투명">투명</option>
                            </select>
                        </div>
                        <div className={styles.infoText}>
                            <p>솔리드 데이터 일 경우, 예상견적이 높게 산출됩니다.</p>
                        </div>
                        <div className={styles.divider}></div>
                        <div className={styles.calculateBtnWrapper}>

                            <div
                                className={styles.calculateBtn}
                                onClick={calculateEstimate}
                                style={{
                                    cursor: isCalculating ? 'not-allowed' : 'pointer',
                                    opacity: isCalculating ? 0.6 : 1
                                }}
                            >
                                {isCalculating ? '계산 중...' : '견적내기'}
                            </div>

                        </div>

                        <div className={styles.divider}></div>
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
                            </div>
                        ) : (
                            <>
                                <p className={styles.price}>₩ {estimatedPrice.toLocaleString()}</p>
                                {printTime && (
                                    <p className={styles.printTime}>예상 출력 시간: {printTime}</p>
                                )}
                            </>
                        )}
                        <div 
                            className={`${styles.saveBtn} ${!hasCalculatedEstimate || estimatedPrice <= 0 ? styles.disabled : ''}`}
                            onClick={handleSave}
                            style={{
                                cursor: (!hasCalculatedEstimate || estimatedPrice <= 0) ? 'not-allowed' : 'pointer',
                                opacity: (!hasCalculatedEstimate || estimatedPrice <= 0) ? 0.5 : 1
                            }}
                        >
                            저장
                        </div>


                    </div>
                </div>
                <div className={styles.fileList}>
                    STL 파일 업로드
                    {fileItems.map((item) => (
                        <div key={item.id} className={styles.fileItem}>
                            <div className={styles.filePreview}>
                                <div className={styles.stlIcon}>3D</div>
                            </div>
                            <div className={styles.fileInfo}>
                                <div className={styles.fileName}>{item.fileName}</div>
                                <div className={styles.fileDetails}>
                                    <span>소재: {item.material}</span>
                                    <span>색상: {item.color} | 부피: 124.5 mm³</span>
                                </div>
                            </div>


                            <div className={styles.filePriceWrapper}>
                                <div className={styles.filePrice}>￦ {item.price.toLocaleString()}</div>
                                <div className={styles.fileControls}>
                                    <button
                                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                        className={styles.controlBtn}
                                    >
                                        −
                                    </button>
                                    <span className={styles.fileQuantity}>{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                        className={styles.controlBtn}
                                    >
                                        +
                                    </button>
                                </div>
                                <div
                                    onClick={() => removeFileItem(item.id)}
                                    className={styles.removeBtn}


                                >
                                    <Image
                                        src="/delete_btn.svg"
                                        alt="MAKER 3D Logo"
                                        width={32}
                                        height={32}
                                    />

                                </div>
                            </div>


                        </div>
                    ))}
                    <div className={styles.lastPriceWrapper}>
                        <div>
                            <p className={styles.lastPriceTitle}>최종 견적 요약</p>
                            <p className={styles.lastPriceInfo}>총 {fileItems.length}개 파일</p>
                            <p className={styles.lastPriceInfo}>총 수량: {fileItems.reduce((sum, item) => sum + item.quantity, 0)}개</p>
                        </div>
                        <div style={{display: 'flex', alignItems: 'flex-end', flexDirection: 'column'}}>
                            <p className={styles.lastPriceInfo}>예상 견적(VAT 포함)</p>
                            <p className={styles.lastPrice}>₩ {fileItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()}</p>

                        </div>
                    </div>
                    <div className={styles.orderWrapper}>
                        <div
                            className={styles.order}
                            onClick={handleOrderClick}
                            style={{ cursor: 'pointer' }}
                        >
                            견적 주문 하기
                        </div>
                    </div>

                    {/* 쇼핑가이드 섹션 */}
                    <div className={styles.shoppingGuide}>
                        <div className={styles.tabWrapper}>
                            <div
                                className={`${styles.tab} ${activeShoppingGuideTab === '상품결제정보' ? styles.active : ''}`}
                                onClick={() => setActiveShoppingGuideTab('상품결제정보')}
                            >
                                상품결제정보
                            </div>
                            <div
                                className={`${styles.tabCenter} ${activeShoppingGuideTab === '배송정보' ? styles.active : ''}`}
                                onClick={() => setActiveShoppingGuideTab('배송정보')}
                            >
                                배송정보
                            </div>
                            <div
                                className={`${styles.tab} ${activeShoppingGuideTab === '교환 및 반품정보' ? styles.active : ''}`}
                                onClick={() => setActiveShoppingGuideTab('교환 및 반품정보')}
                            >
                                교환 및 반품정보
                            </div>
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
                                    <p className={styles.contentLine}>- 제작 기간: 결제 완료 후 2~5영업일</p>
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
                                    <p className={styles.contentLine}>2. 제작 기간은 결제 완료 후 2~5영업일입니다.</p>
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
                        <div className={styles.cautionSection}>
                            <div className={styles.cautionTitle}>
                                <Image
                                    src="/caution_icon.svg"
                                    alt="MAKER 3D Logo"
                                    width={20}
                                    height={20}
                                />
                                <p>유의사항</p>
                            </div>
                            <div className={styles.cautionInfoWrapper}>
                                <p className={styles.cautionInfo}>모델링에 문제가 있을 경우 자동 견적 이용이 안되거나, 추후 견적이 달라질 수 있습니다.</p>
                                <p className={styles.cautionInfo}>하나의 파일에 여러 종류의 색상 설정은 고객센터 (054-462-4140) 로 문의 부탁드립니다.</p>
                                <p className={styles.cautionInfo}>실시간 견적에 사용된 데이터는 임시저장 후 바로 폐기됩니다.</p>
                            </div>
                        </div>


                        {/* 이용약관 섹션 - 유의사항 아래로 이동 */}
                        <div className={styles.termsSection}>
                            <div className={styles.termsHeader}>
                                <h3 className={styles.termsTitle}>Maker 3D 쇼핑몰 이용약관</h3>
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
                                    <p>본 약관은 2025년 12월 30일부터 시행합니다.</p>
                                </div>

                                <div className={styles.termsItem}>
                                    <h4>고객지원</h4>
                                    <p>문의사항이 있으시면 고객센터 (054-462-4140)로 연락주시기 바랍니다.</p>
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
                </div>

            </div>

            {/* 주문 정보 입력 모달 */}
            <OrderModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                onSubmit={handleOrderSubmit}
                totalPrice={fileItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
                fileCount={fileItems.length}
            />
        </div>
    );
}