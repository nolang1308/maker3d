'use client';

import styles from './page.module.scss';
import Image from "next/image";
import {useState} from "react";
import PortfolioCard from "@/components/PortfolioCard";
import Pagination from "@/components/Pagination";


export default function PortfolioPage() {
    const [selectedChip, setSelectedChip] = useState('전체');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15; // 3x5 그리드

    // 포트폴리오 데이터
    const portfolioData = [
        {id: 0, title: "피규어 3D 프린팅 작업", imageUrl: "/mainPhoto.png", date: "2024.11.01", category: "피규어", writer: "관리자"},
        {id: 1, title: "맞춤형 부품 제작", imageUrl: "/mainPhoto2.svg", date: "2024.10.28", category: "부품", writer: "관리자"},
        {id: 2, title: "외주 개발 프로젝트", imageUrl: "/mainPhoto4.png", date: "2024.10.25", category: "외주 개발", writer: "관리자"},
        {id: 3, title: "피규어 모델링", imageUrl: "/mainPhoto5.png", date: "2024.10.20", category: "피규어", writer: "관리자"},
        {id: 4, title: "프로토타입 제작", imageUrl: "/mainPhoto.png", date: "2024.10.15", category: "부품", writer: "관리자"},
        {id: 5, title: "맞춤 디자인", imageUrl: "/mainPhoto2.svg", date: "2024.10.10", category: "외주 개발", writer: "관리자"},
        {id: 6, title: "기계 부품 제작", imageUrl: "/mainPhoto4.png", date: "2024.10.05", category: "부품", writer: "관리자"},
        {id: 7, title: "건축 모형", imageUrl: "/mainPhoto5.png", date: "2024.09.30", category: "피규어", writer: "관리자"},
        {id: 8, title: "의료용 모델", imageUrl: "/mainPhoto.png", date: "2024.09.25", category: "부품", writer: "관리자"},
        {id: 9, title: "교육용 모형", imageUrl: "/mainPhoto2.svg", date: "2024.09.20", category: "피규어", writer: "관리자"},
        {id: 10, title: "예술 작품", imageUrl: "/mainPhoto4.png", date: "2024.09.15", category: "피규어", writer: "관리자"},
        {id: 11, title: "산업용 부품", imageUrl: "/mainPhoto5.png", date: "2024.09.10", category: "부품", writer: "관리자"},
        {id: 12, title: "장난감 제작", imageUrl: "/mainPhoto.png", date: "2024.09.05", category: "피규어", writer: "관리자"},
        {id: 13, title: "액세서리 제작", imageUrl: "/mainPhoto2.svg", date: "2024.08.30", category: "부품", writer: "관리자"},
        {id: 14, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자"},
        {id: 15, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자"},
        {id: 16, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자"},
        {id: 17, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자"},
        {id: 18, title: "맞춤형 케이스", imageUrl: "/mainPhoto4.png", date: "2024.08.25", category: "외주 개발", writer: "관리자"},
        {id: 19, title: "액세서리 제작", imageUrl: "/mainPhoto2.svg", date: "2024.08.30", category: "부품", writer: "관리자"},
        {id: 20, title: "피규어 3D 프린팅 작업", imageUrl: "/mainPhoto.png", date: "2024.11.01", category: "피규어", writer: "관리자"},

    ];

    // 필터링된 데이터
    const filteredData = selectedChip === '전체'
        ? portfolioData
        : portfolioData.filter(item => item.category === selectedChip);

    // 페이지네이션 계산
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

    // 칩 변경시 첫 페이지로 이동
    const handleChipChange = (chip: string) => {
        setSelectedChip(chip);
        setCurrentPage(1);
    };

    return (
        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <div className={styles.title}>
                    <Image
                        src="/portfolio.svg"
                        alt="MAKER 3D Logo"
                        width={229}
                        height={68}
                        className={styles.logoIcon}
                    />
                    <p className={styles.count}>{filteredData.length}</p>
                </div>
                <div className={styles.chipWrapper}>
                    <div
                        className={`${styles.chip} ${selectedChip === '전체' ? styles.active : ''}`}
                        onClick={() => handleChipChange('전체')}
                    >
                        전체
                    </div>
                    <div
                        className={`${styles.chip} ${selectedChip === '피규어' ? styles.active : ''}`}
                        onClick={() => handleChipChange('피규어')}
                    >
                        피규어
                    </div>
                    <div
                        className={`${styles.chip} ${selectedChip === '부품' ? styles.active : ''}`}
                        onClick={() => handleChipChange('부품')}
                    >
                        부품
                    </div>
                    <div
                        className={`${styles.chip} ${selectedChip === '외주 개발' ? styles.active : ''}`}
                        onClick={() => handleChipChange('외주 개발')}
                    >
                        외주 개발
                    </div>


                </div>
                <div className={styles.portfolioGrid}>
                    {currentItems.map((item, index) => (
                        <PortfolioCard
                            key={`${item.title}-${index}`}
                            id={item.id}
                            title={item.title}
                            imageUrl={item.imageUrl}
                            date={item.date}
                        />
                    ))}
                </div>

                {totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}


            </div>
        </div>
    );
}