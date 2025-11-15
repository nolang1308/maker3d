'use client';

import styles from './page.module.scss';
import Image from "next/image";
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function PortfolioDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [textColor, setTextColor] = useState('#ffffff');
    
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
    
    // 포트폴리오 데이터 (실제로는 API나 데이터베이스에서 가져올 데이터)
    const portfolioData = [
        {id: 0, title: "피규어 3D 프린팅 작업", imageUrl: "/mainPhoto.png", date: "2024.11.01", category: "피규어", writer: "관리자", content: "고품질 피규어 3D 프린팅 작업을 진행했습니다. 세밀한 디테일과 완벽한 마감으로 고객 만족도가 높은 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. \n" +
                "\n" +
                "웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. \n" +
                "\n" +
                "웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. 웹진상세페이지 내용 영역 입니다. ."},
        {id: 1, title: "맞춤형 부품 제작", imageUrl: "/mainPhoto2.svg", date: "2024.10.28", category: "부품", writer: "관리자", content: "산업용 맞춤형 부품을 정밀하게 제작했습니다. 고객의 요구사항에 맞춰 완벽한 품질로 완성되었습니다."},
        {id: 2, title: "외주 개발 프로젝트", imageUrl: "/mainPhoto4.png", date: "2024.10.25", category: "외주 개발", writer: "관리자", content: "복잡한 외주 개발 프로젝트를 성공적으로 완료했습니다. 혁신적인 디자인과 기술력을 바탕으로 제작되었습니다."},
        {id: 3, title: "피규어 모델링", imageUrl: "/mainPhoto5.png", date: "2024.10.20", category: "피규어", writer: "관리자", content: "정교한 피규어 모델링 작업입니다. 캐릭터의 특징을 살려 생동감 있게 표현했습니다."},
        {id: 4, title: "프로토타입 제작", imageUrl: "/mainPhoto.png", date: "2024.10.15", category: "부품", writer: "관리자", content: "신제품 프로토타입 제작 작업입니다. 기능성과 디자인을 모두 고려한 완성도 높은 결과물입니다."},
        {id: 5, title: "맞춤 디자인", imageUrl: "/mainPhoto2.svg", date: "2024.10.10", category: "외주 개발", writer: "관리자", content: "고객 맞춤형 디자인 제작 서비스입니다. 독창적이고 실용적인 디자인으로 완성했습니다."},
        {id: 6, title: "기계 부품 제작", imageUrl: "/mainPhoto4.png", date: "2024.10.05", category: "부품", writer: "관리자", content: "정밀 기계 부품 제작 작업입니다. 높은 정확도와 내구성을 자랑합니다."},
        {id: 7, title: "건축 모형", imageUrl: "/mainPhoto5.png", date: "2024.09.30", category: "피규어", writer: "관리자", content: "건축 모형 제작 프로젝트입니다. 실제 건물의 디테일을 정확하게 재현했습니다."},
        {id: 8, title: "의료용 모델", imageUrl: "/mainPhoto.png", date: "2024.09.25", category: "부품", writer: "관리자", content: "의료용 모델 제작 작업입니다. 의료 기기의 정확한 구조를 3D로 구현했습니다."},
        {id: 9, title: "교육용 모형", imageUrl: "/mainPhoto2.svg", date: "2024.09.20", category: "피규어", writer: "관리자", content: "교육용 모형 제작 서비스입니다. 학습 효과를 높이는 실감나는 모델로 제작되었습니다."},
        {id: 10, title: "예술 작품", imageUrl: "/mainPhoto4.png", date: "2024.09.15", category: "피규어", writer: "관리자", content: "예술적 가치가 높은 3D 프린팅 작품입니다. 창의적인 디자인과 완벽한 기술력이 결합된 결과물입니다."},
        {id: 11, title: "산업용 부품", imageUrl: "/mainPhoto5.png", date: "2024.09.10", category: "부품", writer: "관리자", content: "산업용 부품 제작 프로젝트입니다. 고강도와 정밀성을 요구하는 부품을 완벽하게 제작했습니다."},
        {id: 12, title: "장난감 제작", imageUrl: "/mainPhoto.png", date: "2024.09.05", category: "피규어", writer: "관리자", content: "안전하고 재미있는 장난감 제작 서비스입니다. 아이들의 안전을 최우선으로 고려하여 제작되었습니다."},
        {id: 13, title: "액세서리 제작", imageUrl: "/mainPhoto2.svg", date: "2024.08.30", category: "부품", writer: "관리자", content: "개성있는 액세서리 제작 서비스입니다. 고객의 취향에 맞춰 정교하게 디자인되었습니다."},
        {id: 14, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자", content: "전자기기 맞춤형 케이스 제작입니다. 완벽한 보호기능과 세련된 디자인을 제공합니다."},
        {id: 15, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자", content: "전자기기 맞춤형 케이스 제작입니다. 완벽한 보호기능과 세련된 디자인을 제공합니다."},
        {id: 16, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자", content: "전자기기 맞춤형 케이스 제작입니다. 완벽한 보호기능과 세련된 디자인을 제공합니다."},
        {id: 17, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자", content: "전자기기 맞춤형 케이스 제작입니다. 완벽한 보호기능과 세련된 디자인을 제공합니다."},
        {id: 18, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자", content: "전자기기 맞춤형 케이스 제작입니다. 완벽한 보호기능과 세련된 디자인을 제공합니다."},
        {id: 19, title: "액세서리 제작", imageUrl: "/mainPhoto2.svg", date: "2024.08.30", category: "부품", writer: "관리자", content: "개성있는 액세서리 제작 서비스입니다. 고객의 취향에 맞춰 정교하게 디자인되었습니다."},
        {id: 20, title: "피규어 3D 프린팅 작업", imageUrl: "/mainPhoto.png", date: "2024.11.01", category: "피규어", writer: "관리자", content: "고품질 피규어 3D 프린팅 작업을 진행했습니다. 세밀한 디테일과 완벽한 마감으로 고객 만족도가 높은 작품입니다."},
    ];
    
    const portfolio = portfolioData.find(item => item.id === parseInt(id));
    
    useEffect(() => {
        if (portfolio) {
            analyzeImageBrightness(portfolio.imageUrl);
        }
    }, [portfolio]);
    
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
                    backgroundImage: `url(${portfolio.imageUrl})`,
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
                            {portfolio.date}
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
                        <Image
                            src={portfolio.imageUrl}
                            alt={portfolio.title}
                            width={422}
                            height={254}
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