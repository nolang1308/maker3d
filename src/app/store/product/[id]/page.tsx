'use client';

import styles from './page.module.scss';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import MiniItemComponent from '@/components/MiniItemComponent';
import ReviewComponent from '@/components/ReviewComponent';
import { requestNaverPay, PaymentData } from '@/utils/naverPay';


export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;

    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

    const [quantity, setQuantity] = useState(1);
    const [selectedOption, setSelectedOption] = useState('');
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [PhotoReviewCount, setPhotoReviewCount] = useState(12);
    const [activeTab, setActiveTab] = useState('관련상품');
    const [activeInfoTab, setActiveInfoTab] = useState('상품결제정보');
    const [activeShoppingGuideTab, setActiveShoppingGuideTab] = useState('상품결제정보');
    const [activeReviewFilter, setActiveReviewFilter] = useState('추천순');
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
    const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
    const [categoryId, setCategoryId] = useState('');
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);
    const [isTermsExpanded, setIsTermsExpanded] = useState(false); // 이용약관 확장 상태

    // 상품 데이터 가져오기
    useEffect(() => {
        const fetchProductDetail = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${BACKEND_URL}/api/naver/product/${productId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success && data.data) {
                    const naverProduct = data.data;
                    // console.log('상품 상세 응답:', data);
                    // //
                    // console.log('상품 상세 API 응답:', naverProduct);
                    // console.log('ㄴㄹㅇㄴㄹ:', naverProduct.originProduct.leafCategoryId);
                    setCategoryId(naverProduct.originProduct.leafCategoryId);
                    // console.log('===============',categoryId)


                    // 네이버 상품 상세 API 응답을 우리 형식으로 변환
                    const transformedProduct = {
                        id: naverProduct.channelProductNo || productId,
                        name: naverProduct.originProduct.name || '상품명 없음',
                        images: [
                            naverProduct.originProduct.images?.representativeImage?.url,
                            ...(naverProduct.originProduct.images?.optionalImages?.map((img: any) => img.url) || []), // eslint-disable-line @typescript-eslint/no-explicit-any
                        ].filter(Boolean).slice(0, 30), // 최대 30개 이미지
                        originalPrice: naverProduct.originProduct.salePrice || 0,
                        finalPrice: naverProduct.originProduct.salePrice || naverProduct.salePrice || 0,
                        description: naverProduct.productDescription || naverProduct.detailContent || '네이버 스마트스토어 상품입니다.',
                        optionLabel: '옵션선택',
                        options: naverProduct.options?.map((opt: any) => opt.name) || ['[필수] 옵션선택', '옵션1', '옵션2', '옵션3'], // eslint-disable-line @typescript-eslint/no-explicit-any
                        totalScore: 5,
                        reviewCount: 7,
                        categoryName: naverProduct.wholeCategoryName || naverProduct.categoryName || '',
                        statusType: naverProduct.statusType || 'SALE',
                        stockQuantity: naverProduct.stockQuantity || 0,
                        detailContent: naverProduct.originProduct.detailContent,
                        leafCategoryId: naverProduct.originProduct.leafCategoryId,
                    };

                    setProduct(transformedProduct);
                } else {
                    // // 기본 상품 데이터 (API 실패 시)
                    // setProduct({
                    //     id: productId,
                    //     name: '프리미엄 3D 프린터 필라멘트',
                    //     images: ['/exampleItem.png', '/mainPhoto2.svg', '/mainPhoto3.svg', '/mainPhoto4.svg'],
                    //     originalPrice: 67000,
                    //     finalPrice: 46900,
                    //     description: '사이즈는 어떻게되고, 용량은 어떻게 됩니다.',
                    //     optionLabel: '옵션선택',
                    //     options: ['[필수] 옵션선택'],
                    //     totalScore: 5,
                    //     reviewCount: 7
                    // });
                }



                // 현재 상품 정보를 product/all API로도 조회
                await fetchProductFromAll(productId);

            } catch (error) {
                console.error('상품 상세 정보 로딩 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchProductFromAll = async (currentProductId: string) => {
            try {
                // console.log('=== product/all API로 전체 상품 목록 조회 시작 ===');
                const response = await fetch(`${BACKEND_URL}/api/naver/product/all`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                // console.log('product/all API 전체 응답:', data);

                if (data.success && data.data.contents) {
                    // console.log('===== 전체 상품 목록 =====');
                    // console.log('상품 개수:', data.data.contents.length);
                    // console.log('전체 상품 상세 정보:', data.data.contents[0].channelProducts[0]);

                    // 현재 상품을 제외한 모든 상품들을 관련 상품으로 설정
                    const relatedProducts = data.data.contents
                        .filter((content: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                            // 현재 상품만 제외
                            return !content.channelProducts?.some((cp: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                                cp.channelProductNo.toString() === currentProductId.toString()
                            );
                        })
                            .slice(0, 6) // 최대 6개만
                            .map((content: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                                const channelProduct = content.channelProducts?.[0];
                                const discountRate = channelProduct?.salePrice && channelProduct?.discountedPrice 
                                    ? Math.round((1 - channelProduct.discountedPrice / channelProduct.salePrice) * 100)
                                    : 0;


                                return {
                                    id: channelProduct?.channelProductNo,
                                    name: channelProduct.name || '상품명 없음',
                                    image: channelProduct.representativeImage.url ?? null,
                                    originalPrice: channelProduct?.salePrice || 0,
                                    discountRate: discountRate,
                                    finalPrice: channelProduct?.discountedPrice || channelProduct?.salePrice || 0
                                };
                            });

                    // console.log('===== 관련 상품들 (현재 상품 제외) =====');
                    // console.log('관련 상품 개수:', relatedProducts.length);
                    // console.log('관련 상품 상세 정보:', relatedProducts);

                    setRelatedProducts(relatedProducts);

                    // 현재 상품 ID와 매치되는 상품 찾기 (기존 로직)
                    const matchingProduct = data.data.contents.find((content: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                        content.channelProducts?.some((cp: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                            cp.channelProductNo.toString() === currentProductId.toString()
                        )
                    );

                    if (matchingProduct) {
                        // console.log('=== 매치되는 상품 발견! ===');
                        // console.log('매치된 상품 전체 정보:', matchingProduct);
                        const matchingChannelProduct = matchingProduct.channelProducts?.find((cp: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                            cp.channelProductNo.toString() === currentProductId.toString()
                        );


                        // 기존 상품 데이터의 finalPrice를 업데이트
                        setProduct((prevProduct: any) => {
                            if (prevProduct) {
                                return {
                                    ...prevProduct,
                                    finalPrice: matchingChannelProduct.discountedPrice || prevProduct.finalPrice
                                };
                            }
                            return prevProduct;
                        });

                        return matchingChannelProduct.discountedPrice;
                    } else {
                        // console.log('=== 현재 상품 ID와 매치되는 상품을 찾을 수 없습니다 ===');
                        // console.log('찾고 있는 상품 ID:', currentProductId);
                        // console.log('전체 상품의 ID들:', data.data.contents.map((content: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                        //     content.channelProducts?.map((cp: any) => cp.channelProductNo) // eslint-disable-line @typescript-eslint/no-explicit-any
                        // ));
                    }
                }
            } catch (error) {
                console.error('API로 상품 조회 실패:', error);
            }
        };

        fetchProductDetail();
    }, [productId,categoryId]);

    const handleQuantityChange = (change: number) => {
        const newQuantity = quantity + change;
        if (newQuantity >= 1) {
            setQuantity(newQuantity);
        }
    };


    const handleGoToSmartStore = () => {
        const smartStoreUrl = `https://smartstore.naver.com/maker-3d/products/${productId}`;
        window.open(smartStoreUrl, '_blank', 'noopener,noreferrer');
    };

    // 썸네일 네비게이션 함수들
    const visibleThumbnailCount = 5; // 한 번에 보이는 썸네일 개수

    const canGoThumbnailPrev = thumbnailStartIndex > 0;
    const canGoThumbnailNext = product && thumbnailStartIndex + visibleThumbnailCount < product.images.length;

    const goThumbnailPrev = () => {
        if (canGoThumbnailPrev) {
            setThumbnailStartIndex(prev => Math.max(0, prev - 1));
        }
    };

    const goThumbnailNext = () => {
        if (canGoThumbnailNext) {
            setThumbnailStartIndex(prev => prev + 1);
        }
    };

    // 탭 목록
    const tabs = [
        { name: '관련상품', count: null },
        { name: '상세정보', count: null },
        { name: '쇼핑가이드', count: null },
        // { name: '상품후기', count: 7 }
    ];

    // 정보 탭 목록
    const infoTabs = [
        '상품결제정보',
        '배송정보',
        '교환 및 반품정보'
    ] as const;

    // 정보 탭 내용
    const infoContent: Record<string, {title: string, content: string[]}> = {
        '상품결제정보': {
            title: '결제수단',
            content: [

            ]
        },
        '배송정보': {
            title: '배송안내',
            content: [
                '- 평일 오후 2시 이전 주문 시 당일 발송',
                '- 주말 및 공휴일 제외',
                '',
                '배송에 관한 안내사항입니다. 배송지연이 발생할 수 있으니 양해 부탁드립니다.',
                '제주도 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.'
            ]
        },
        '교환 및 반품정보': {
            title: '교환/반품',
            content: [
                '- 수령 후 7일 이내 교환/반품 가능',
                '- 상품 하자 시 무료 교환/반품',
                '',
                '교환 및 반품에 관한 정책입니다. 고객 변심으로 인한 반품은 배송비가 발생할 수 있습니다.',
                '단순 변심으로 인한 교환/반품은 고객 부담입니다.'
            ]
        }
    };

    // 쇼핑가이드 탭 내용
    const shoppingGuideContent: Record<string, {content: string[]}> = {
        '상품결제정보': {
            content: [
                '결제수단 (현재 페이지 제작 중 입니다. 아래 내용은 정확하지 않으니, 주의 해주시기 바랍니다.)',
                '- NPay 네이버 결제',
                '결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다.',
                '결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다.'
            ]
        },
        '배송정보': {
            content: [
                '배송안내 (현재 페이지 제작 중 입니다. 아래 내용은 정확하지 않으니, 주의 해주시기 바랍니다.)',
                '- 평일 오후 2시 이전 주문 시 당일 발송',
                '- 주말 및 공휴일 제외',
                '배송에 관한 안내사항입니다. 배송지연이 발생할 수 있으니 양해 부탁드립니다.',
                '제주도 및 도서산간 지역은 추가 배송비가 발생할 수 있습니다.'
            ]
        },
        '교환 및 반품정보': {
            content: [
                '교환/반품 (현재 페이지 제작 중 입니다. 아래 내용은 정확하지 않으니, 주의 해주시기 바랍니다.)',
                '- 수령 후 7일 이내 교환/반품 가능',
                '- 상품 하자 시 무료 교환/반품',
                '교환 및 반품에 관한 정책입니다. 고객 변심으로 인한 반품은 배송비가 발생할 수 있습니다.',
                '단순 변심으로 인한 교환/반품은 고객 부담입니다.'
            ]
        }
    };


    // 샘플 리뷰 데이터
    const sampleReviews = [
        {
            id: '1',
            rating: 1,
            name: '김민수',
            content: '해당 자리에 리뷰가 작성됩니다.',
            date: '2024.11.15',
            images: ['/exampleItem.png', '/mainPhoto.png', '/mainPhoto2.svg'],
            isOwner: true,
            helpfulCount: 12
        },
        {
            id: '2',
            rating: 4,
            name: '이지영',
            content: '해당 자리에 리뷰가 작성됩니다.',
            date: '2024.11.10',
            images: ['/exampleItem.png'],
            isOwner: false,
            helpfulCount: 8
        },
        {
            id: '3',
            rating: 3,
            name: '박철수',
            content: '해당 자리에 리뷰가 작성됩니다.',
            date: '2024.11.05',
            images: ['/exampleItem.png', '/mainPhoto3.svg'],
            isOwner: false,
            helpfulCount: 3
        }
    ];

    // 리뷰 필터링 로직
    const getFilteredReviews = () => {
        const sortedReviews = [...sampleReviews];

        switch (activeReviewFilter) {
            case '추천순':
                // 추천순 = 도움이 된 수가 많은 순
                return sortedReviews.sort((a, b) => b.helpfulCount - a.helpfulCount);

            case '최신순':
                // 최신순 = 날짜가 최근인 순
                return sortedReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            case '별점순':
                // 별점순 = 별점이 높은 순
                return sortedReviews.sort((a, b) => b.rating - a.rating);

            default:
                return sortedReviews;
        }
    };

    const filteredReviews = getFilteredReviews();

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <div className={styles.loadingContainer}>
                        <div>상품 정보를 불러오는 중...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <div className={styles.errorContainer}>
                        <div>상품을 찾을 수 없습니다.</div>
                        <button onClick={() => router.back()}>돌아가기</button>
                    </div>
                </div>
            </div>
        );
    }

    // 주문하기 핸들러
    const handleBuyNow = async () => {
        // 네이버페이 입점심사 기준에 맞는 유효성 검사
        if (!selectedOption || selectedOption === '[필수] 옵션선택') {
            alert('옵션을 선택해 주세요.');
            return;
        }

        if (quantity < 1) {
            alert('수량을 1개 이상 선택해 주세요.');
            return;
        }

        // 재고 확인
        if (product.stockQuantity && quantity > product.stockQuantity) {
            alert(`재고가 부족합니다. (현재 재고: ${product.stockQuantity}개)`);
            return;
        }

        // try {
        //     setIsPaymentLoading(true);
        //
        //     // 주문 데이터 준비
        //     const orderData = {
        //         productId: product.id,
        //         productName: product.name,
        //         quantity: quantity,
        //         selectedOption: selectedOption,
        //         unitPrice: product.finalPrice,
        //         totalPrice: product.finalPrice * quantity,
        //         productImage: product.images[0],
        //         categoryId: categoryId
        //     };
        //
        //     // 네이버페이 결제 요청
        //     const paymentData: PaymentData = {
        //         merchantPayKey: `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        //         productName: product.name,
        //         productCount: quantity,
        //         totalPayAmount: product.finalPrice * quantity,
        //         taxScopeAmount: product.finalPrice * quantity,
        //         taxExScopeAmount: 0,
        //         returnUrl: `${window.location.origin}/payment/complete`
        //     };
        //
        //     const naverPayResult = await requestNaverPay(paymentData);
        //
        //     if (naverPayResult.success) {
        //         // 네이버페이로 리다이렉트
        //         window.location.href = naverPayResult.naverPayUrl;
        //     } else {
        //         throw new Error(naverPayResult.message || '결제 요청에 실패했습니다.');
        //     }
        //
        // } catch (error) {
        //     console.error('주문 처리 중 오류:', error);
        //     alert('주문 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
        // } finally {
        //     setIsPaymentLoading(false);
        // }
    };

    // 장바구니 추가 핸들러
    const handleAddToCart = () => {
        if (!selectedOption || selectedOption === '[필수] 옵션선택') {
            alert('옵션을 선택해 주세요.');
            return;
        }

        if (quantity < 1) {
            alert('수량을 1개 이상 선택해 주세요.');
            return;
        }

        // 장바구니에 상품 추가 로직
        const cartItem = {
            id: product.id,
            name: product.name,
            image: product.images[0],
            option: selectedOption,
            quantity: quantity,
            unitPrice: product.finalPrice,
            totalPrice: product.finalPrice * quantity
        };

        // localStorage에 장바구니 데이터 저장
        const existingCart = JSON.parse(localStorage.getItem('cart') || '[]');
        const existingItemIndex = existingCart.findIndex(
            (item: any) => item.id === cartItem.id && item.option === cartItem.option
        );

        if (existingItemIndex > -1) {
            // 이미 있는 상품이면 수량 증가
            existingCart[existingItemIndex].quantity += cartItem.quantity;
            existingCart[existingItemIndex].totalPrice = 
                existingCart[existingItemIndex].unitPrice * existingCart[existingItemIndex].quantity;
        } else {
            // 새로운 상품이면 추가
            existingCart.push(cartItem);
        }

        localStorage.setItem('cart', JSON.stringify(existingCart));
        alert('장바구니에 상품이 추가되었습니다.');
    };

    return (
        <div className={styles.container}>
            <div className={styles.innerContainer}>


                <div className={styles.productDetail}>
                    {/* 상품 이미지 영역 */}
                    <div className={styles.imageSection}>
                        <div className={styles.mainImage}>
                            <Image
                                src={product.images[selectedImageIndex]}
                                alt={product.name}
                                width={500}
                                height={583}
                                className={styles.productImage}
                            />
                            {/* 메인 이미지 네비게이션 버튼 */}
                            {product.images.length > 1 && (
                                <>
                                    <button
                                        className={`${styles.imageNavBtn} ${styles.prevImageBtn}`}
                                        onClick={() => setSelectedImageIndex(prev => prev > 0 ? prev - 1 : product.images.length - 1)}
                                    >
                                        &#8249;
                                    </button>
                                    <button
                                        className={`${styles.imageNavBtn} ${styles.nextImageBtn}`}
                                        onClick={() => setSelectedImageIndex(prev => prev < product.images.length - 1 ? prev + 1 : 0)}
                                    >
                                        &#8250;
                                    </button>
                                </>
                            )}
                        </div>
                        <div className={styles.thumbnails}>
                            {product.images.map((image: any, index: number) => (
                                <div
                                    key={index}
                                    className={`${styles.thumbnail} ${index === selectedImageIndex ? styles.active : ''}`}
                                    onClick={() => setSelectedImageIndex(index)}
                                >
                                    <Image
                                        src={image}
                                        alt={`${product.name} ${index + 1}`}
                                        width={79}
                                        height={105}
                                        className={styles.thumbnailImage}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 상품 정보 영역 */}
                    <div className={styles.infoSection}>
                        <h1 className={styles.productName}>{product.name}</h1>

                        {/* 가격 정보 테이블 */}
                        <div className={styles.priceTable}>
                            <div className={styles.priceRow}>
                                <span className={styles.priceLabel}>소비자가</span>
                                <span className={styles.originalPrice}>₩{product.originalPrice.toLocaleString()}원</span>
                            </div>
                            <div className={styles.priceRow}>
                                <span className={styles.finalPriceLabel}>판매가</span>
                                <span className={styles.finalPrice}>₩{product.finalPrice.toLocaleString()}원</span>
                            </div>
                            <div className={styles.priceRow}>
                                <span className={styles.priceLabel}>설명</span>
                                <span className={styles.description}>{product.description}</span>
                            </div>
                        </div>

                        {/* 옵션 선택 */}
                        <div className={styles.optionSection}>
                            <div className={styles.priceRow}>
                                <span className={styles.optionLabel}>{product.optionLabel}</span>
                                <select
                                    className={`${styles.optionSelect} ${!selectedOption || selectedOption === '[필수] 옵션선택' ? styles.required : ''}`}
                                    value={selectedOption}
                                    onChange={(e) => setSelectedOption(e.target.value)}
                                    required
                                >
                                    {product.options.map((option: any, index: number) => (
                                        <option 
                                            key={option} 
                                            value={option}
                                            disabled={index === 0 && option === '[필수] 옵션선택'}
                                        >
                                            {index === 0 && option === '[필수] 옵션선택' ? '- 옵션을 선택해 주세요 -' : option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {(!selectedOption || selectedOption === '[필수] 옵션선택') && (
                                <div className={styles.validationMessage}>
                                    * 옵션 선택은 필수입니다
                                </div>
                            )}
                        </div>
                        {/*<div className={styles.moveToSmartStoreWrapper}>*/}
                        {/*    <div*/}
                        {/*        className={styles.moveToSmartStore}*/}
                        {/*        onClick={handleGoToSmartStore}*/}
                        {/*    >*/}
                        {/*        구매하러가기*/}
                        {/*    </div>*/}
                        {/*</div>*/}

                        {/* 총 상품금액 */}
                        <div className={styles.totalSection}>
                            <div className={styles.totalRow}>
                                <span className={styles.totalLabel}>총 상품금액</span>
                                <div className={styles.totalAmount}>
                                    <span className={styles.totalPrice}>₩{(product.finalPrice * quantity).toLocaleString()}</span>
                                    <span className={styles.totalQuantityInfo}>({quantity}개)</span>
                                </div>
                            </div>
                        </div>

                        {/* 수량 선택 */}
                        <div className={styles.quantitySection}>
                            <span className={styles.quantityLabel}>수량</span>
                            <div className={styles.quantityControl}>
                                <button
                                    className={styles.quantityBtn}
                                    onClick={() => handleQuantityChange(-1)}
                                    disabled={quantity <= 1}
                                >
                                    -
                                </button>
                                <input 
                                    type="number" 
                                    className={styles.quantityInput}
                                    value={quantity}
                                    min="1"
                                    max={product.stockQuantity || 999}
                                    onChange={(e) => {
                                        const newQuantity = parseInt(e.target.value) || 1;
                                        if (newQuantity >= 1 && (!product.stockQuantity || newQuantity <= product.stockQuantity)) {
                                            setQuantity(newQuantity);
                                        }
                                    }}
                                />
                                <button
                                    className={styles.quantityBtn}
                                    onClick={() => handleQuantityChange(1)}
                                    disabled={product.stockQuantity && quantity >= product.stockQuantity}
                                >
                                    +
                                </button>
                            </div>
                            {product.stockQuantity && (
                                <span className={styles.stockInfo}>재고: {product.stockQuantity}개</span>
                            )}
                        </div>

                        {/* 구매 버튼 영역 */}
                        <div className={styles.actionSection}>
                            <div className={styles.buttonGroup}>
                                {/*<button*/}
                                {/*    className={styles.cartButton}*/}
                                {/*    onClick={handleAddToCart}*/}
                                {/*    disabled={!selectedOption || selectedOption === '[필수] 옵션선택'}*/}
                                {/*>*/}
                                {/*    장바구니*/}
                                {/*</button>*/}
                                
                                <div className={styles.paymentGroup}>
                                    <div className={styles.naverPayInfo}>
                                        <span className={styles.naverBrand}>NAVER</span>
                                        <div className={styles.paymentDetails}>
                                            <span className={styles.pointInfo}>네이버포인트 적립</span>
                                            <span className={styles.payMethod}>네이버페이</span>
                                        </div>
                                    </div>
                                    <button
                                        className={styles.payButton}
                                        onClick={handleBuyNow}
                                        disabled={isPaymentLoading || !selectedOption || selectedOption === '[필수] 옵션선택'}
                                    >
                                        {isPaymentLoading ? (
                                            '결제 준비 중...'
                                        ) : (
                                            <Image
                                                src="/btn_npaygr_paying.svg"
                                                alt="주문하기"
                                                width={251}
                                                height={65}
                                            />
                                        )}
                                    </button>
                                </div>
                                
                                {/*<button className={styles.wishButton}>*/}
                                {/*    <span>♡</span>*/}
                                {/*</button>*/}
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.categoryWrapper}>
                    {tabs.map((tab, index) => (
                        <div key={tab.name} className={styles.tabGroup}>
                            <div 
                                className={`${styles.tab} ${activeTab === tab.name ? styles.active : ''}`}
                            >
                                {tab.name}
                                {tab.count && <span className={styles.count}>({tab.count})</span>}
                            </div>
                            {index < tabs.length - 1 && <div className={styles.separator}>|</div>}
                        </div>
                    ))}
                </div>
                

                <p className={styles.text1}>WITH ITEM</p>
                <p className={styles.text2}>같이 보기 좋은 상품입니다.</p>
                
                <div className={styles.withItemGrid}>
                    {loading ? (
                        // 로딩 스켈레톤
                        Array.from({length: 6}, (_, index) => (
                            <div key={index} className={styles.loadingSkeleton}>
                                <div className={styles.skeletonImage}></div>
                                <div className={styles.skeletonText}></div>
                            </div>
                        ))
                    ) : (
                        relatedProducts.map((relatedProduct, index) => (
                            <MiniItemComponent
                                key={relatedProduct.id || index}
                                image={relatedProduct.image}
                                title={relatedProduct.name}
                                originalPrice={relatedProduct.originalPrice}
                                discountRate={relatedProduct.discountRate}
                                finalPrice={relatedProduct.finalPrice}
                                onClick={() => router.push(`/store/product/${relatedProduct.id}`)}
                            />
                        ))
                    )}
                </div>
                <div className={styles.lineWrapper}>
                    <div className={styles.line}></div>
                </div>
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

                <div className={styles.categoryWrapper}>
                    {tabs.map((tab, index) => (
                        <div key={`second-${tab.name}`} className={styles.tabGroup}>
                            <div
                                className={`${styles.tab} ${tab.name === '상세정보' ? styles.active : ''}`}
                            >
                                {tab.name}
                                {tab.count && <span className={styles.count}>({tab.count})</span>}
                            </div>
                            {index < tabs.length - 1 && <div className={styles.separator}>|</div>}
                        </div>
                    ))}
                </div>
                {/*<p className={styles.text3}>프리미엄 3D 프린터 필라멘트 카키블루색상</p>*/}
                <div className={styles.itemInfoPhotoWrapper}>
                    {product.detailContent && (
                        <div className={styles.naverContent} dangerouslySetInnerHTML={{ __html: product.detailContent }} />
                    )}
                </div>
                <div className={styles.lineWrapper}>
                    <div className={styles.line}></div>
                </div>

                <div className={styles.categoryWrapper}>
                    {tabs.map((tab, index) => (
                        <div key={`third-${tab.name}`} className={styles.tabGroup}>
                            <div
                                className={`${styles.tab} ${tab.name === '쇼핑가이드' ? styles.active : ''}`}
                            >
                                {tab.name}
                                {tab.count && <span className={styles.count}>({tab.count})</span>}
                            </div>
                            {index < tabs.length - 1 && <div className={styles.separator}>|</div>}
                        </div>
                    ))}
                </div>




                {/*<div className={styles.shoppingGuide}>*/}
                {/*    <div className={styles.tabWrapper}>*/}
                {/*        <div*/}
                {/*            className={`${styles.tab} ${activeShoppingGuideTab === '상품결제정보' ? styles.active : ''}`}*/}
                {/*            onClick={() => setActiveShoppingGuideTab('상품결제정보')}*/}
                {/*        >*/}
                {/*            상품결제정보*/}
                {/*        </div>*/}
                {/*        <div*/}
                {/*            className={`${styles.tabCenter} ${activeShoppingGuideTab === '배송정보' ? styles.active : ''}`}*/}
                {/*            onClick={() => setActiveShoppingGuideTab('배송정보')}*/}
                {/*        >*/}
                {/*            배송정보*/}
                {/*        </div>*/}
                {/*        <div*/}
                {/*            className={`${styles.tab} ${activeShoppingGuideTab === '교환 및 반품정보' ? styles.active : ''}`}*/}
                {/*            onClick={() => setActiveShoppingGuideTab('교환 및 반품정보')}*/}
                {/*        >*/}
                {/*            교환 및 반품정보*/}
                {/*        </div>*/}
                {/*    </div>*/}

                {/*    <div className={styles.shoppingGuideContent}>*/}
                {/*        {shoppingGuideContent[activeShoppingGuideTab]?.content?.map((line, index) => (*/}
                {/*            <p key={index} className={styles.contentLine}>*/}
                {/*                {line || '\u00A0'}*/}
                {/*            </p>*/}
                {/*        )) || <p>내용을 불러올 수 없습니다.</p>}*/}
                {/*    </div>*/}
                {/*</div>*/}
                {/*<div className={styles.lineWrapper}>*/}
                {/*    <div className={styles.line}></div>*/}
                {/*</div>*/}

                {/*<div className={styles.categoryWrapper}>*/}
                {/*    {tabs.map((tab, index) => (*/}
                {/*        <div key={`fourth-${tab.name}`} className={styles.tabGroup}>*/}
                {/*            <div*/}
                {/*                className={`${styles.tab} ${tab.name === '상품후기' ? styles.active : ''}`}*/}
                {/*            >*/}
                {/*                {tab.name}*/}
                {/*                {tab.count && <span className={styles.count}>({tab.count})</span>}*/}
                {/*            </div>*/}
                {/*            {index < tabs.length - 1 && <div className={styles.separator}>|</div>}*/}
                {/*        </div>*/}
                {/*    ))}*/}
                {/*</div>*/}

                {/*<div className={styles.reviewSection}>*/}
                {/*    <h2 className={styles.reviewTitle}>REVIEW (7)</h2>*/}
                {/*    */}
                {/*    <div className={styles.reviewContent}>*/}
                {/*        <div className={styles.reviewSummary}>*/}
                {/*            <div className={styles.ratingDisplay}>*/}
                {/*                <div className={styles.starIcon}>★</div>*/}
                {/*                <div className={styles.ratingScore}>5.0</div>*/}
                {/*            </div>*/}
                {/*            <p className={styles.satisfactionText}>100%의 구매자가 상품을 좋아합니다.</p>*/}
                {/*            <button className={styles.writeReviewBtn}>상품 리뷰 작성하기</button>*/}
                {/*        </div>*/}
                {/*        */}
                {/*        <div className={styles.ratingBreakdown}>*/}
                {/*            <div className={styles.ratingRow}>*/}
                {/*                <span className={styles.ratingLabel}>아주 좋아요</span>*/}
                {/*                <div className={styles.progressBarContainer}>*/}
                {/*                    <div className={styles.progressBar}>*/}
                {/*                        <div className={`${styles.progressFill} ${styles.excellent}`} style={{width: '100%'}}></div>*/}
                {/*                    </div>*/}
                {/*                </div>*/}
                {/*                <span className={styles.ratingCount}>7</span>*/}
                {/*            </div>*/}
                {/*            */}
                {/*            <div className={styles.ratingRow}>*/}
                {/*                <span className={styles.ratingLabel}>맘에 들어요</span>*/}
                {/*                <div className={styles.progressBarContainer}>*/}
                {/*                    <div className={styles.progressBar}>*/}
                {/*                        <div className={`${styles.progressFill} ${styles.good}`} style={{width: '0%'}}></div>*/}
                {/*                    </div>*/}
                {/*                </div>*/}
                {/*                <span className={styles.ratingCount}>0</span>*/}
                {/*            </div>*/}
                {/*            */}
                {/*            <div className={styles.ratingRow}>*/}
                {/*                <span className={styles.ratingLabel}>보통이에요</span>*/}
                {/*                <div className={styles.progressBarContainer}>*/}
                {/*                    <div className={styles.progressBar}>*/}
                {/*                        <div className={`${styles.progressFill} ${styles.normal}`} style={{width: '0%'}}></div>*/}
                {/*                    </div>*/}
                {/*                </div>*/}
                {/*                <span className={styles.ratingCount}>0</span>*/}
                {/*            </div>*/}
                {/*            */}
                {/*            <div className={styles.ratingRow}>*/}
                {/*                <span className={styles.ratingLabel}>그냥 그래요</span>*/}
                {/*                <div className={styles.progressBarContainer}>*/}
                {/*                    <div className={styles.progressBar}>*/}
                {/*                        <div className={`${styles.progressFill} ${styles.poor}`} style={{width: '0%'}}></div>*/}
                {/*                    </div>*/}
                {/*                </div>*/}
                {/*                <span className={styles.ratingCount}>0</span>*/}
                {/*            </div>*/}
                {/*            */}
                {/*            <div className={styles.ratingRow}>*/}
                {/*                <span className={styles.ratingLabel}>별로예요</span>*/}
                {/*                <div className={styles.progressBarContainer}>*/}
                {/*                    <div className={styles.progressBar}>*/}
                {/*                        <div className={`${styles.progressFill} ${styles.bad}`} style={{width: '0%'}}></div>*/}
                {/*                    </div>*/}
                {/*                </div>*/}
                {/*                <span className={styles.ratingCount}>0</span>*/}
                {/*            </div>*/}
                {/*        </div>*/}
                {/*    </div>*/}
                {/*</div>*/}
                {/*<div className={styles.photoReviewWrapper}>*/}
                {/*    <div className={styles.photoReviewWrapperTitle}>포토 ({PhotoReviewCount})</div>*/}
                {/*    <div className={styles.photoReviewGrid}>*/}
                {/*        {Array.from({length: PhotoReviewCount}, (_, index) => (*/}
                {/*            <div key={index} className={styles.photoReviewItem}>*/}
                {/*                <Image*/}
                {/*                    src="/exampleItem.png"*/}
                {/*                    alt={`포토 리뷰 ${index + 1}`}*/}
                {/*                    width={172}*/}
                {/*                    height={172}*/}
                {/*                    className={styles.photoReviewImage}*/}
                {/*                />*/}
                {/*            </div>*/}
                {/*        ))}*/}
                {/*    </div>*/}
                {/*</div>*/}
                {/*<div className={styles.reviewFilterWrapper}>*/}
                {/*    <p */}
                {/*        className={`${styles.filterOption} ${activeReviewFilter === '추천순' ? styles.active : ''}`}*/}
                {/*        onClick={() => setActiveReviewFilter('추천순')}*/}
                {/*    >*/}
                {/*        추천순*/}
                {/*    </p>*/}
                {/*    <p */}
                {/*        className={`${styles.filterOption} ${activeReviewFilter === '최신순' ? styles.active : ''}`}*/}
                {/*        onClick={() => setActiveReviewFilter('최신순')}*/}
                {/*    >*/}
                {/*        최신순*/}
                {/*    </p>*/}
                {/*    <p */}
                {/*        className={`${styles.filterOption} ${activeReviewFilter === '별점순' ? styles.active : ''}`}*/}
                {/*        onClick={() => setActiveReviewFilter('별점순')}*/}
                {/*    >*/}
                {/*        별점순*/}
                {/*    </p>*/}
                {/*</div>*/}

                {/*<div className={styles.reviewList}>*/}
                {/*    {filteredReviews.map((review) => (*/}
                {/*        <ReviewComponent*/}
                {/*            key={review.id}*/}
                {/*            id={review.id}*/}
                {/*            rating={review.rating}*/}
                {/*            name={review.name}*/}
                {/*            content={review.content}*/}
                {/*            date={review.date}*/}
                {/*            images={review.images}*/}
                {/*            isOwner={review.isOwner}*/}
                {/*            onEdit={() => console.log('Edit review:', review.id)}*/}
                {/*            onDelete={() => console.log('Delete review:', review.id)}*/}
                {/*        />*/}
                {/*    ))}*/}
                {/*</div>*/}
                <div className={styles.lineWrapper}>
                    <div className={styles.line}></div>
                </div>

            </div>
        </div>
    );
}