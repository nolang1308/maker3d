'use client';

import styles from './page.module.scss';
import Image from "next/image";
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getPortfolio, incrementPortfolioViews, Portfolio } from '@/services/portfolioService';

export default function PortfolioDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [textColor, setTextColor] = useState('#ffffff');
    const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
    const [loading, setLoading] = useState(true);
    
    // 포트폴리오 데이터 로드
    useEffect(() => {
        const loadPortfolio = async () => {
            try {
                const data = await getPortfolio(id);
                if (data) {
                    setPortfolio(data);
                    // 조회수 증가
                    await incrementPortfolioViews(id);
                }
            } catch (error) {
                console.error('포트폴리오 로드 에러:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPortfolio();
    }, [id]);

    const analyzeImageBrightness = (imageUrl: string) => {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let brightness = 0;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    brightness += (r * 0.299 + g * 0.587 + b * 0.114);
                }
                
                const avgBrightness = brightness / (data.length / 4);
                
                // 평균 밝기가 128보다 높으면 어두운 글씨, 낮으면 밝은 글씨
                setTextColor(avgBrightness > 128 ? '#0a0a0a' : '#ffffff');
            } catch (error) {
                console.error('이미지 분석 실패:', error);
                setTextColor('#ffffff'); // 기본값
            }
        };
        img.onerror = () => {
            setTextColor('#ffffff'); // 기본값
        };
        img.src = imageUrl;
    };
    
    useEffect(() => {
        if (portfolio?.imageUrl) {
            analyzeImageBrightness(portfolio.imageUrl);
        }
    }, [portfolio]);

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '.').replace('.', '');
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <h1>로딩 중...</h1>
                </div>
            </div>
        );
    }

    if (!portfolio) {
        return (
            <div className={styles.container}>
                <div className={styles.innerContainer}>
                    <h1>포트폴리오를 찾을 수 없습니다.</h1>
                    <button onClick={() => router.back()}>뒤로 가기</button>
                </div>
            </div>
        );
    }
    
    return (
        <div className={styles.container}>
            <div 
                className={styles.heroSection}
                style={{
                    backgroundImage: `url(${process.env.NEXT_PUBLIC_BACKEND_URL}${portfolio.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            >
                <div className={styles.heroContent}>
                    <h1 
                        className={styles.heroTitle}
                        style={{ 
                            color: textColor,
                            textShadow: textColor === '#ffffff' ? '2px 2px 4px rgba(0, 0, 0, 0.5)' : '2px 2px 4px rgba(255, 255, 255, 0.5)'
                        }}
                    >
                        {portfolio.title}
                    </h1>
                    <div className={styles.heroMeta}>
                        <span
                            className={styles.heroDate}
                            style={{
                                color: textColor,
                                textShadow: textColor === '#ffffff' ? '1px 1px 2px rgba(0, 0, 0, 0.5)' : '1px 1px 2px rgba(255, 255, 255, 0.5)'
                            }}
                        >
                            {formatDate(portfolio.createdAt)}
                        </span>
                        <span 
                            className={styles.heroDivider}
                            style={{ 
                                color: textColor,
                                textShadow: textColor === '#ffffff' ? '1px 1px 2px rgba(0, 0, 0, 0.5)' : '1px 1px 2px rgba(255, 255, 255, 0.5)'
                            }}
                        >
                            /
                        </span>
                        <span 
                            className={styles.heroWriter}
                            style={{ 
                                color: textColor,
                                textShadow: textColor === '#ffffff' ? '1px 1px 2px rgba(0, 0, 0, 0.5)' : '1px 1px 2px rgba(255, 255, 255, 0.5)'
                            }}
                        >
                            {portfolio.writer}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className={styles.mainContent}>
                <div className={styles.innerContainer}>
                    <div className={styles.imageSection}>
                        <img
                            src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${portfolio.imageUrl}`}
                            alt={portfolio.title}
                            className={styles.mainImage}
                        />
                    </div>
                    
                    <div className={styles.contentSection}>
                        <p className={styles.content}>
                            {portfolio.content}
                        </p>

                    </div>
                    
                    <div className={styles.backButtonWrapper}>
                        <button className={styles.backButton} onClick={() => router.back()}>
                            목록으로 돌아가기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}