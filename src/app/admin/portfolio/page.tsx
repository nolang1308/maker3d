'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';
import Image from "next/image";
import { useAuth } from '@/contexts/AuthContext';
import { getPortfolios, deletePortfolio, Portfolio } from '@/services/portfolioService';

export default function PortfolioAdminPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // authLoading이 false이고 user가 없으면 로그인 페이지로
        if (!authLoading && !user) {
            alert('로그인이 필요합니다.');
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // 포트폴리오 목록 로드
    useEffect(() => {
        if (user) {
            loadPortfolios();
        }
    }, [user]);

    const loadPortfolios = async () => {
        setLoading(true);
        try {
            const result = await getPortfolios(100);
            setPortfolios(result.portfolios);
        } catch (error) {
            console.error('포트폴리오 로드 에러:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            await deletePortfolio(id);
            alert('삭제되었습니다.');
            loadPortfolios();
        } catch (error) {
            console.error('삭제 에러:', error);
            alert('삭제에 실패했습니다.');
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('ko-KR');
    };

    return (
        <div className={styles.container}>
            <div className={styles.ManagerSignatureBar}>
                <Image src={"/Icon_smile.svg"} width={24} height={24} alt={""}/>
                <p>관리자</p>
            </div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <h1>포트폴리오 관리</h1>
                    <button
                        className={styles.writeButton}
                        onClick={() => router.push('/admin/portfolio/write')}
                    >
                        포트폴리오 작성
                    </button>
                </div>

                {loading ? (
                    <div className={styles.portfolioList}>
                        <p className={styles.placeholder}>로딩 중...</p>
                    </div>
                ) : portfolios.length === 0 ? (
                    <div className={styles.portfolioList}>
                        <p className={styles.placeholder}>포트폴리오가 없습니다. 새로운 포트폴리오를 작성해주세요.</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.noticeTable}>
                            <thead>
                                <tr>
                                    <th>번호</th>
                                    <th>제목</th>
                                    <th>카테고리</th>
                                    <th>작성자</th>
                                    <th>작성일</th>
                                    <th>조회수</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {portfolios.map((portfolio, index) => (
                                    <tr key={portfolio.id}>
                                        <td>{portfolios.length - index}</td>
                                        <td
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => router.push(`/portfolio/${portfolio.id}`)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                {portfolio.imageUrl && (
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${portfolio.imageUrl}`}
                                                        alt={portfolio.title}
                                                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                                                    />
                                                )}
                                                <span>{portfolio.title}</span>
                                            </div>
                                        </td>
                                        <td>{portfolio.category}</td>
                                        <td>{portfolio.writer}</td>
                                        <td>{formatDate(portfolio.createdAt)}</td>
                                        <td>{portfolio.views}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                    className={styles.editButton}
                                                    onClick={() => router.push(`/admin/portfolio/edit/${portfolio.id}`)}
                                                >
                                                    수정
                                                </button>
                                                <button
                                                    className={styles.deleteButton}
                                                    onClick={() => handleDelete(portfolio.id)}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}