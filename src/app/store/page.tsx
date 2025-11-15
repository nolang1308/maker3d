'use client';

import styles from './page.module.scss';
import {useState, useEffect} from 'react';
import Image from 'next/image';
import MiniItemComponent from "@/components/MiniItemComponent";
import ItemComponent from "@/components/ItemComponent";
import { useRouter } from 'next/navigation';

export default function StorePage() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const router = useRouter();

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
                        <div className={styles.bestReviewWrapper}>
                            <div className={styles.title}>
                                ✨ 베스트 리뷰

                            </div>
                            <div className={styles.reviewList}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                                    <div key={index} className={styles.reviewItem}>
                                        <Image
                                            src={index <= 1 ? '/exampleItem.png' : `/exampleItem${index}.svg`}
                                            alt={`리뷰 이미지 ${index}`}
                                            width={125}
                                            height={125}
                                            className={styles.reviewImage}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.mdItem}>
                            <div className={styles.title}>
                                🏆 MD 추천 제품
                            </div>
                            <div className={styles.mdItemWrapper}>
                                <MiniItemComponent
                                    image="/exampleItem.png"
                                    title="구글 애드리틱스(건전성기) 레진 상자"
                                    originalPrice={100000}
                                    discountRate={35}
                                    finalPrice={65000}
                                    onClick={() => handleProductClick(1001)}
                                />
                                <MiniItemComponent
                                    image="/exampleItem.png"
                                    title="구글 애드리틱스(건전성기) 레진 상자"
                                    originalPrice={100000}
                                    discountRate={35}
                                    finalPrice={65000}
                                    onClick={() => handleProductClick(1002)}
                                />
                                <MiniItemComponent
                                    image="/exampleItem.png"
                                    title="구글 애드리틱스(건전성기) 레진 상자"
                                    originalPrice={100000}
                                    discountRate={35}
                                    finalPrice={65000}
                                    onClick={() => handleProductClick(1003)}
                                />

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
                        <div className={styles.ItemWrapper}>
                            {Array.from({length: 16}, (_, index) => (
                                <ItemComponent
                                    key={index}
                                    image="/exampleItem.png"
                                    title="구글 애드리틱스(건전성기) 레진 상자"
                                    originalPrice={100000}
                                    discountRate={35}
                                    finalPrice={65000}
                                    onClick={() => handleProductClick(2000 + index + 1)}
                                />
                            ))}
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