'use client';

import styles from './page.module.scss';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import MiniItemComponent from '@/components/MiniItemComponent';
import ReviewComponent from '@/components/ReviewComponent';


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

    // 상품 데이터 가져오기
    useEffect(() => {
        const fetchProductDetail = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/naver/product/${productId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (data.success && data.data) {
                    const naverProduct = data.data;
                    console.log('상품 상세 응답:', data);
                    //
                    console.log('상품 상세 API 응답:', naverProduct);
                    console.log('ㄴㄹㅇㄴㄹ:', naverProduct.originProduct.leafCategoryId);
                    setCategoryId(naverProduct.originProduct.leafCategoryId);
                    console.log('===============',categoryId)


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
                        options: naverProduct.options?.map((opt: any) => opt.name) || ['[필수] 옵션선택'], // eslint-disable-line @typescript-eslint/no-explicit-any
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
                console.log('=== product/all API로 전체 상품 목록 조회 시작 ===');
                const response = await fetch(`${BACKEND_URL}/api/naver/product/all`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                console.log('product/all API 전체 응답:', data);

                if (data.success && data.data.contents) {
                    console.log('===== 전체 상품 목록 =====');
                    console.log('상품 개수:', data.data.contents.length);
                    console.log('전체 상품 상세 정보:', data.data.contents[0].channelProducts[0]);

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

                    console.log('===== 관련 상품들 (현재 상품 제외) =====');
                    console.log('관련 상품 개수:', relatedProducts.length);
                    console.log('관련 상품 상세 정보:', relatedProducts);

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
                        console.log('=== 현재 상품 ID와 매치되는 상품을 찾을 수 없습니다 ===');
                        console.log('찾고 있는 상품 ID:', currentProductId);
                        console.log('전체 상품의 ID들:', data.data.contents.map((content: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
                            content.channelProducts?.map((cp: any) => cp.channelProductNo) // eslint-disable-line @typescript-eslint/no-explicit-any
                        ));
                    }
                }
            } catch (error) {
                console.error('product/all API로 상품 조회 실패:', error);
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

    const handleAddToCart = () => {
        console.log('장바구니 추가:', {
            productId,
            quantity,
            selectedOption
        });
        // 실제로는 장바구니 API 호출
    };

    const handleBuyNow = () => {
        console.log('바로 구매:', {
            productId,
            quantity,
            selectedOption
        });
        // 실제로는 주문 페이지로 이동
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
        { name: '상품후기', count: 7 }
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
                '- NPay 네이버 결제',
                '',
                '결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다.',
                '결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다. 결제수단의 주의점입니다.'
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

    function handleProductClick(number: number) {

    }

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
                                    className={styles.optionSelect}
                                    value={selectedOption}
                                    onChange={(e) => setSelectedOption(e.target.value)}
                                >
                                    {product.options.map((option: any) => (
                                        <option key={option} value={option}>- {option} -</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 총 상품금액 */}
                        <div className={styles.totalSection}>
                            <span className={styles.totalLabel}>총 상품금액(수량): </span>
                            <span className={styles.totalQuantity}>{quantity}</span>
                            <span className={styles.totalUnit}>(개)</span>
                        </div>

                        {/* 구매 버튼 영역 */}
                        <div className={styles.actionSection}>
                            <div className={styles.paymentMethods}>
                                <div className={styles.naver}>
                                    <span>NAVER</span>
                                    <span className={styles.smallText}>네이버포인트 적립액</span>
                                    <span className={styles.smallText}>네이버페이</span>
                                </div>
                                <button className={styles.payButton}>PAY 구매</button>
                                <button className={styles.wishButton}>
                                    <span>찜</span>
                                </button>
                            </div>
                            
                            <div className={styles.quantityAndCart}>
                                <span>수량</span>
                                <div className={styles.quantityControl}>
                                    <button 
                                        className={styles.quantityBtn}
                                        onClick={() => handleQuantityChange(-1)}
                                    >
                                        -
                                    </button>
                                    <span className={styles.quantityValue}>{quantity}</span>
                                    <button 
                                        className={styles.quantityBtn}
                                        onClick={() => handleQuantityChange(1)}
                                    >
                                        +
                                    </button>
                                </div>
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
                        {shoppingGuideContent[activeShoppingGuideTab]?.content?.map((line, index) => (
                            <p key={index} className={styles.contentLine}>
                                {line || '\u00A0'}
                            </p>
                        )) || <p>내용을 불러올 수 없습니다.</p>}
                    </div>
                </div>
                <div className={styles.lineWrapper}>
                    <div className={styles.line}></div>
                </div>

                <div className={styles.categoryWrapper}>
                    {tabs.map((tab, index) => (
                        <div key={`fourth-${tab.name}`} className={styles.tabGroup}>
                            <div
                                className={`${styles.tab} ${tab.name === '상품후기' ? styles.active : ''}`}
                            >
                                {tab.name}
                                {tab.count && <span className={styles.count}>({tab.count})</span>}
                            </div>
                            {index < tabs.length - 1 && <div className={styles.separator}>|</div>}
                        </div>
                    ))}
                </div>

                <div className={styles.reviewSection}>
                    <h2 className={styles.reviewTitle}>REVIEW (7)</h2>
                    
                    <div className={styles.reviewContent}>
                        <div className={styles.reviewSummary}>
                            <div className={styles.ratingDisplay}>
                                <div className={styles.starIcon}>★</div>
                                <div className={styles.ratingScore}>5.0</div>
                            </div>
                            <p className={styles.satisfactionText}>100%의 구매자가 상품을 좋아합니다.</p>
                            <button className={styles.writeReviewBtn}>상품 리뷰 작성하기</button>
                        </div>
                        
                        <div className={styles.ratingBreakdown}>
                            <div className={styles.ratingRow}>
                                <span className={styles.ratingLabel}>아주 좋아요</span>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar}>
                                        <div className={`${styles.progressFill} ${styles.excellent}`} style={{width: '100%'}}></div>
                                    </div>
                                </div>
                                <span className={styles.ratingCount}>7</span>
                            </div>
                            
                            <div className={styles.ratingRow}>
                                <span className={styles.ratingLabel}>맘에 들어요</span>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar}>
                                        <div className={`${styles.progressFill} ${styles.good}`} style={{width: '0%'}}></div>
                                    </div>
                                </div>
                                <span className={styles.ratingCount}>0</span>
                            </div>
                            
                            <div className={styles.ratingRow}>
                                <span className={styles.ratingLabel}>보통이에요</span>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar}>
                                        <div className={`${styles.progressFill} ${styles.normal}`} style={{width: '0%'}}></div>
                                    </div>
                                </div>
                                <span className={styles.ratingCount}>0</span>
                            </div>
                            
                            <div className={styles.ratingRow}>
                                <span className={styles.ratingLabel}>그냥 그래요</span>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar}>
                                        <div className={`${styles.progressFill} ${styles.poor}`} style={{width: '0%'}}></div>
                                    </div>
                                </div>
                                <span className={styles.ratingCount}>0</span>
                            </div>
                            
                            <div className={styles.ratingRow}>
                                <span className={styles.ratingLabel}>별로예요</span>
                                <div className={styles.progressBarContainer}>
                                    <div className={styles.progressBar}>
                                        <div className={`${styles.progressFill} ${styles.bad}`} style={{width: '0%'}}></div>
                                    </div>
                                </div>
                                <span className={styles.ratingCount}>0</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.photoReviewWrapper}>
                    <div className={styles.photoReviewWrapperTitle}>포토 ({PhotoReviewCount})</div>
                    <div className={styles.photoReviewGrid}>
                        {Array.from({length: PhotoReviewCount}, (_, index) => (
                            <div key={index} className={styles.photoReviewItem}>
                                <Image
                                    src="/exampleItem.png"
                                    alt={`포토 리뷰 ${index + 1}`}
                                    width={172}
                                    height={172}
                                    className={styles.photoReviewImage}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <div className={styles.reviewFilterWrapper}>
                    <p 
                        className={`${styles.filterOption} ${activeReviewFilter === '추천순' ? styles.active : ''}`}
                        onClick={() => setActiveReviewFilter('추천순')}
                    >
                        추천순
                    </p>
                    <p 
                        className={`${styles.filterOption} ${activeReviewFilter === '최신순' ? styles.active : ''}`}
                        onClick={() => setActiveReviewFilter('최신순')}
                    >
                        최신순
                    </p>
                    <p 
                        className={`${styles.filterOption} ${activeReviewFilter === '별점순' ? styles.active : ''}`}
                        onClick={() => setActiveReviewFilter('별점순')}
                    >
                        별점순
                    </p>
                </div>

                <div className={styles.reviewList}>
                    {filteredReviews.map((review) => (
                        <ReviewComponent
                            key={review.id}
                            id={review.id}
                            rating={review.rating}
                            name={review.name}
                            content={review.content}
                            date={review.date}
                            images={review.images}
                            isOwner={review.isOwner}
                            onEdit={() => console.log('Edit review:', review.id)}
                            onDelete={() => console.log('Delete review:', review.id)}
                        />
                    ))}
                </div>
                <div className={styles.lineWrapper}>
                    <div className={styles.line}></div>
                </div>

            </div>
        </div>
    );
}