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
                        console.log('저장된 견적을 불러왔습니다:', loadedItems.length, '개');
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
            // 자동 견적 계산 제거 - 견적내기 버튼 클릭 시에만 계산
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

            console.log('견적 계산 요청:', { material, color });

            // 직접 백엔드로 호출 (Vercel 제한 우회)
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
            const response = await fetch(`${backendUrl}/api/upload-stl`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                console.log('PrusaSlicer 출력 시간:', result.printTime);
                console.log('계산된 가격:', result.estimatedPrice);
                setPrintTime(result.printTime);
                setEstimatedPrice(result.estimatedPrice);
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
            // 자동 견적 계산 제거 - 견적내기 버튼 클릭 시에만 계산
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
                        console.log('파일 백엔드 저장 완료:', savedFilePaths);
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

                    console.log('견적이 Firebase에 저장되었습니다.');
                }

                // 폼 초기화
                setMaterial('');
                setColor('');
                setQuantity(1);
                setUploadedFiles([]);
                setCurrentPreviewFile(null);
                setEstimatedPrice(0);
                setPrintTime('');

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
            console.log('생성된 주문번호:', orderNumber);

            // 2. STL 파일 처리 (저장된 파일 또는 새 파일)
            let fileUrls: string[] = [];

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
                    console.log('저장된 파일 복사 완료:', fileUrls);
                } else {
                    throw new Error(result.error || '저장된 파일 복사 실패');
                }
            } else {
                // 새로 업로드된 파일 사용
                const files = fileItems.map(item => item.file).filter((file): file is File => file !== null);
                if (files.length > 0) {
                    fileUrls = await uploadSTLFiles(files, orderNumber);
                    console.log('파일 업로드 완료:', fileUrls);
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
                email: customerInfo.email,
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

            // Firebase에 저장된 견적 초기화
            if (user) {
                try {
                    const quotesRef = doc(db, 'savedQuotes', user.uid);
                    await setDoc(quotesRef, {
                        userId: user.uid,
                        quotes: [],
                        updatedAt: new Date().toISOString()
                    });
                    console.log('주문 완료 후 저장된 견적이 초기화되었습니다.');
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

                console.log('견적이 삭제되었습니다.');
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

                console.log('수량이 업데이트되었습니다.');
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
                        <div className={styles.saveBtn} onClick={handleSave}>저장</div>


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
                    <div className={styles.cautionWrapper}>
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
                            <p className={styles.cautionInfo}>배송은 근무일 기준 2~3일 이내 출고됩니다.</p>
                            <p className={styles.cautionInfo}>퀵 서비스 및 화물 배송은 고객센터 (054-462-4140) 로 문의 부탁드립니다.</p>
                            <p className={styles.cautionInfo}>하나의 파일에 여러 종류의 색상 설정은 고객센터 (054-462-4140) 로 문의 부탁드립니다.</p>
                            <p className={styles.cautionInfo}>실시간 견적에 사용된 데이터는 임시저장 후 바로 폐기됩니다.</p>
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