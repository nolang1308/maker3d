'use client';

import styles from './page.module.scss';
import Image from "next/image";
import {useState} from 'react';
import STLViewer from '../../components/STLViewer';

interface FileItem {
    id: number;
    fileName: string;
    material: string;
    color: string;
    quantity: number;
    price: number;
}

export default function QuotePage() {
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
            
            // STL 파일인 경우 자동으로 견적 계산
            if (files[0].name.toLowerCase().endsWith('.stl')) {
                await calculateEstimate(files[0]);
            }
        }
    };

    const calculateEstimate = async (file: File) => {
        setIsCalculating(true);
        setEstimatedPrice(0);
        
        try {
            // PrusaSlicer 백엔드 API 호출
            const formData = new FormData();
            formData.append('stlFile', file);
            
            const response = await fetch('http://35.192.48.34:10000/api/upload-stl', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('PrusaSlicer 출력 시간:', result.printTime);
                setPrintTime(result.printTime);
                
                // 출력 시간을 기반으로 견적 계산 (예시)
                // 실제로는 시간, 재료비, 전력비 등을 고려한 계산 로직 필요
                const estimatedHours = parseTimeToHours(result.printTime);
                const hourlyRate = 10000; // 시간당 10,000원 가정
                const materialCost = 20000; // 재료비 20,000원 가정
                const calculatedPrice = Math.round((estimatedHours * hourlyRate) + materialCost);
                
                setEstimatedPrice(calculatedPrice);
            } else {
                console.error('PrusaSlicer 오류:', result.error);
                // 오류 시 기본 가격 설정
                const fallbackPrice = Math.floor(Math.random() * 200000) + 50000;
                setEstimatedPrice(fallbackPrice);
            }
        } catch (error) {
            console.error('네트워크 오류:', error);
            // 네트워크 오류 시 기본 가격 설정
            const fallbackPrice = Math.floor(Math.random() * 200000) + 50000;
            setEstimatedPrice(fallbackPrice);
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
            await calculateEstimate(stlFiles[0]);
        } else {
            alert('STL 파일만 업로드 가능합니다.');
        }
    };

    const handleSave = () => {
        if (uploadedFiles.length > 0 && material && color) {
            const newItems: FileItem[] = uploadedFiles.map((file, index) => ({
                id: Date.now() + index,
                fileName: file.name,
                material,
                color,
                quantity,
                price: estimatedPrice || Math.floor(Math.random() * 200000) + 50000
            }));

            setFileItems(prev => [...prev, ...newItems]);

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
        } else {
            alert('파일을 업로드하고 소재, 색상을 선택해주세요.');
        }
    };

    const removeFileItem = (id: number) => {
        setFileItems(prev => prev.filter(item => item.id !== id));
    };

    const updateQuantity = (id: number, newQuantity: number) => {
        setFileItems(prev => prev.map(item =>
            item.id === id ? {...item, quantity: newQuantity} : item
        ));
    };

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
                        <div className={styles.divider}></div>
                        <div className={styles.quantitySection}>
                            <div className={styles.quantityLabel}>
                                <span>수량 <span style={{color: '#FF4040', marginLeft: '2px'}}>*</span></span>
                            </div>
                            <div className={styles.quantityControl}>
                                <button
                                    className={styles.quantityBtn}
                                    onClick={decreaseQuantity}
                                    type="button"
                                >
                                    -
                                </button>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={handleQuantityChange}
                                        onBlur={handleQuantityBlur}
                                        onKeyPress={handleKeyPress}
                                        className={styles.quantityInput}
                                        autoFocus
                                        min="1"
                                    />
                                ) : (
                                    <span
                                        className={styles.quantityValue}
                                        onClick={handleQuantityClick}
                                    >
                                        {quantity}
                                    </span>
                                )}
                                <button
                                    className={styles.quantityBtn}
                                    onClick={increaseQuantity}
                                    type="button"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <div className={styles.infoText}>
                            <p>솔리드 데이터 일 경우, 예상견적이 높게 산출됩니다.</p>
                        </div>
                        <div className={styles.divider}></div>
                        <div className={styles.priceWrapper}>
                            <p className={styles.title}>예상 견적</p>
                            <p className={styles.vat}>(VAT 포함)</p>
                        </div>
                        {isCalculating ? (
                            <p className={styles.price}>계산 중...</p>
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
                            <p className={styles.lastPriceInfo}>총 2개 파일</p>
                            <p className={styles.lastPriceInfo}>총 부피: 210.7 mm³</p>
                        </div>
                        <div style={{display: 'flex', alignItems: 'flex-end', flexDirection: 'column'}}>
                            <p className={styles.lastPriceInfo}>예상 견적(VAT 포함)</p>
                            <p className={styles.lastPrice}>₩ 0</p>

                        </div>
                    </div>
                    <div className={styles.orderWrapper}>
                        <div className={styles.order}>견적 주문 하기</div>
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
        </div>
    );
}