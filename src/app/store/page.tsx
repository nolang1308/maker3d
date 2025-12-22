'use client';

import styles from './page.module.scss';
import {useState, useEffect} from 'react';
import Image from 'next/image';
import MiniItemComponent from "@/components/MiniItemComponent";
import ItemComponent from "@/components/ItemComponent";
import { useRouter } from 'next/navigation';

interface Product {
    id: string | number;
    name: string;
    image: string;
    originalPrice: number;
    discountRate: number;
    finalPrice: number;
}

interface NaverChannelProduct {
    channelProductNo: number;
    name: string;
    salePrice: number;
    discountedPrice: number;
    representativeImage?: {
        url: string;
    };
    categoryId: string;
    channelProductDisplayStatusType: string;
    statusType: string;
}

interface NaverContent {
    originProductNo: number;
    channelProducts: NaverChannelProduct[];
    representativeImage?: {
        url: string;
    };
}


export default function StorePage() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [popularProducts, setPopularProducts] = useState<Product[]>([]);
    const [mdRecommendedProducts, setMdRecommendedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
    
    // 디버깅용 - 환경변수 확인

    // 샘플 광고 이미지들 (실제로는 서버에서 받아온 데이터)
    const advertisements = [
        {
            id: 1,
            title: '3D 프린팅 신제품 출시',
            image: '/mainPhoto.png',
            description: '최신 3D 프린터로 더욱 정교한 출력이 가능합니다',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        },
        {
            id: 2,
            title: '특가 이벤트 진행중',
            image: '/mainPhoto2.svg',
            description: '지금 주문하시면 50% 할인 혜택',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        },
        {
            id: 3,
            title: '프리미엄 소재 입고',
            image: '/mainPhoto3.svg',
            description: '고품질 레진 및 필라멘트 신규 입고',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
        },
        {
            id: 4,
            title: '빠른 배송 서비스',
            image: '/mainPhoto4.svg',
            description: '당일 출고, 익일 배송으로 빠르게 받아보세요',
            gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
        }
    ];

    useEffect(() => {
        const fetchStoreData = async () => {
            setLoading(true);
            try {
                // 1. 토큰 발행
                const tokenResponse = await fetch(`${BACKEND_URL}/api/naver/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const tokenData = await tokenResponse.json();

                // 2. 상품 목록 가져오기
                const productsResponse = await fetch(`${BACKEND_URL}/api/naver/product/all`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                const productsData = await productsResponse.json();
                
                if (productsData.success && productsData.data) {
                    
                    // 네이버 API 응답 구조에 맞춰 데이터 추출
                    const contents: NaverContent[] = productsData.data.contents || [];
                    
                    // 각 content의 channelProducts를 평탄화하여 상품 목록 생성
                    const allProducts: (NaverContent & NaverChannelProduct)[] = [];
                    contents.forEach((content: NaverContent) => {
                        if (content.channelProducts && content.channelProducts.length > 0) {
                            content.channelProducts.forEach((channelProduct: NaverChannelProduct) => {
                                allProducts.push({
                                    // 원본 상품 정보와 채널 상품 정보를 조합
                                    ...content,
                                    ...channelProduct,
                                    originProductNo: content.originProductNo,
                                    representativeImage: content.representativeImage || channelProduct.representativeImage
                                });
                            });
                        }
                    });
                    
                    const transformedProducts = allProducts.map(product => {
                        // 할인율 계산
                        const discountRate = product.salePrice && product.discountedPrice 
                            ? Math.round(((product.salePrice - product.discountedPrice) / product.salePrice) * 100)
                            : 0;
                            
                        return {
                            id: product.channelProductNo || product.originProductNo,
                            name: product.name || '상품명 없음',
                            image: product.representativeImage?.url || '/exampleItem.png',
                            originalPrice: product.salePrice || 0,
                            discountRate: discountRate,
                            finalPrice: product.discountedPrice || product.salePrice || 0
                        };
                    });

                    // MD 추천 상품 (처음 6개)
                    setMdRecommendedProducts(transformedProducts.slice(0, 6));
                    
                    // 인기 상품 (처음 16개)
                    setPopularProducts(transformedProducts.slice(0, 16));
                } else {
                    console.error('상품 데이터 형식 오류:', productsData);
                }

            } catch (error) {
                console.error('데이터 로딩 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStoreData();
    }, []);


    // 자동 슬라이드 기능
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % advertisements.length);
        }, 3000); // 3초마다 변경

        return () => clearInterval(timer);
    }, [advertisements.length]);

    // 수동으로 슬라이드 변경
    const goToSlide = (index: number) => {
        setCurrentSlide(index);
    };

    const goToPrevious = () => {
        setCurrentSlide((prev) => (prev - 1 + advertisements.length) % advertisements.length);
    };

    const goToNext = () => {
        setCurrentSlide((prev) => (prev + 1) % advertisements.length);
    };

    // 상품 상세페이지로 이동
    const handleProductClick = (productId: number) => {
        router.push(`/store/product/${productId}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <div className={styles.adPanel}>
                    <div className={styles.slideWrapper}>
                        <div
                            className={styles.slideContainer}
                            style={{transform: `translateX(-${currentSlide * 100}%)`}}
                        >
                            {advertisements.map((ad, index) => (
                                <div key={ad.id} className={styles.slide}>
                                    <div
                                        className={styles.slideContent}
                                        style={{background: ad.gradient}}
                                    >
                                        <div className={styles.textSection}>
                                            <h2 className={styles.adTitle}>{ad.title}</h2>
                                            <p className={styles.adDescription}>{ad.description}</p>
                                            <button className={styles.ctaButton}>자세히 보기</button>
                                        </div>
                                        <div className={styles.imageSection}>
                                            <Image
                                                src={ad.image}
                                                alt={ad.title}
                                                width={300}
                                                height={200}
                                                className={styles.adImage}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 좌우 네비게이션 버튼 */}
                        <button
                            className={`${styles.navButton} ${styles.prevButton}`}
                            onClick={goToPrevious}
                        >
                            &#8249;
                        </button>
                        <button
                            className={`${styles.navButton} ${styles.nextButton}`}
                            onClick={goToNext}
                        >
                            &#8250;
                        </button>

                        {/* 인디케이터 점들 */}
                        <div className={styles.indicators}>
                            {advertisements.map((_, index) => (
                                <button
                                    key={index}
                                    className={`${styles.indicator} ${index === currentSlide ? styles.active : ''}`}
                                    onClick={() => goToSlide(index)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className={styles.itemWrapper}>
                    <div className={styles.topItem}>
                        <div className={styles.mdItem}>
                            <div className={styles.title}>
                                🏆 MD 추천 제품
                            </div>
                            <div className={styles.mdItemWrapper}>
                                {loading ? (
                                    // 로딩 스켈레톤
                                    Array.from({ length: 6 }, (_, index) => (
                                        <div key={index} className={styles.loadingSkeleton}>
                                            <div className={styles.skeletonImage}></div>
                                            <div className={styles.skeletonText}></div>
                                        </div>
                                    ))
                                ) : (
                                    mdRecommendedProducts.map((product) => (
                                        <MiniItemComponent
                                            key={product.id}
                                            image={product.image}
                                            title={product.name}
                                            originalPrice={product.originalPrice}
                                            discountRate={product.discountRate}
                                            finalPrice={product.finalPrice}
                                            onClick={() => handleProductClick(typeof product.id === 'string' ? parseInt(product.id) : product.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.bestItemWrapper}>
                        <div className={styles.title}>
                            🎁 메이커 3D 인기상품
                            <p>
                                {"더보기 >"}
                            </p>
                        </div>
                        {/* 데스크톱용 (1024px 초과) - ItemComponent 사용 */}
                        <div className={styles.ItemWrapperDesktop}>
                            {loading ? (
                                // 로딩 스켈레톤
                                Array.from({ length: 16 }, (_, index) => (
                                    <div key={index} className={styles.loadingItemSkeleton}>
                                        <div className={styles.skeletonItemImage}></div>
                                        <div className={styles.skeletonItemText}></div>
                                        <div className={styles.skeletonItemPrice}></div>
                                    </div>
                                ))
                            ) : (
                                popularProducts.map((product) => (
                                    <ItemComponent
                                        key={product.id}
                                        image={product.image}
                                        title={product.name}
                                        originalPrice={product.originalPrice}
                                        discountRate={product.discountRate}
                                        finalPrice={product.finalPrice}
                                        onClick={() => handleProductClick(typeof product.id === 'string' ? parseInt(product.id) : product.id)}
                                    />
                                ))
                            )}
                        </div>
                        {/* 태블릿/모바일용 (1024px 이하) - MiniItemComponent 사용 */}
                        <div className={styles.ItemWrapperMobile}>
                            {loading ? (
                                // 로딩 스켈레톤
                                Array.from({ length: 16 }, (_, index) => (
                                    <div key={index} className={styles.loadingSkeleton}>
                                        <div className={styles.skeletonImage}></div>
                                        <div className={styles.skeletonText}></div>
                                    </div>
                                ))
                            ) : (
                                popularProducts.map((product) => (
                                    <MiniItemComponent
                                        key={product.id}
                                        image={product.image}
                                        title={product.name}
                                        originalPrice={product.originalPrice}
                                        discountRate={product.discountRate}
                                        finalPrice={product.finalPrice}
                                        onClick={() => handleProductClick(typeof product.id === 'string' ? parseInt(product.id) : product.id)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                    <div className={styles.policyBtn}>
                        배송 및 환불정책
                        <Image
                            src="/download_icon.svg"
                            alt="MAKER 3D Logo"
                            width={30}
                            height={30}
                            className={styles.logoIcon}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}