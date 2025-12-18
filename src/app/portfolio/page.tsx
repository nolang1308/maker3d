'use client';

import styles from './page.module.scss';
import Image from "next/image";
import {useState, useEffect} from "react";
import PortfolioCard from "@/components/PortfolioCard";
import Pagination from "@/components/Pagination";
import { getPortfolios, Portfolio } from "@/services/portfolioService";


export default function PortfolioPage() {
    const [selectedChip, setSelectedChip] = useState('전체');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15; // 3x5 그리드
    const [portfolioData, setPortfolioData] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);

    // Firebase에서 포트폴리오 데이터 로드
    useEffect(() => {
        const loadPortfolios = async () => {
            try {
                setLoading(true);
                const result = await getPortfolios(100);
                setPortfolioData(result.portfolios);
            } catch (error) {
                console.error('포트폴리오 로드 에러:', error);
            } finally {
                setLoading(false);
            }
        };

        loadPortfolios();
    }, []);

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

    // 날짜 포맷 함수
    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '.').replace(/\.$/, '');
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
                {loading ? (
                    <div className={styles.portfolioGrid}>
                        <p>로딩 중...</p>
                    </div>
                ) : (
                    <div className={styles.portfolioGrid}>
                        {currentItems.map((item) => (
                            <PortfolioCard
                                key={item.id}
                                id={item.id}
                                title={item.title}
                                imageUrl={`${process.env.NEXT_PUBLIC_BACKEND_URL}${item.imageUrl}`}
                                date={formatDate(item.createdAt)}
                            />
                        ))}
                    </div>
                )}

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