'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import Pagination from '../../components/Pagination';
import Image from 'next/image';
import { getNotices, Notice } from '@/services/noticeService';


export default function NoticePage() {
    const router = useRouter();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearchTerm, setActiveSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 20;

    // Firebase에서 공지사항 데이터 로드
    useEffect(() => {
        const loadNotices = async () => {
            try {
                setLoading(true);
                const response = await getNotices(1, 1000); // 모든 공지사항 가져오기
                // 공개된 공지사항만 필터링
                const publicNotices = response.notices.filter(notice => notice.isPublic);
                setNotices(publicNotices);
            } catch (error) {
                console.error('공지사항 로드 에러:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNotices();
    }, []);

    const filteredNotices = notices.filter(notice => 
        notice.title.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
        notice.author.toLowerCase().includes(activeSearchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredNotices.length / itemsPerPage);
    const currentNotices = filteredNotices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleSearch = () => {
        setActiveSearchTerm(searchTerm);
        setCurrentPage(1);
    };

    const handleNoticeClick = (noticeId: string) => {
        router.push(`/notice/${noticeId}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.noticeContainer}>
                <div className={styles.header}>
                    <h1 className={styles.title}>공지사항</h1>
                </div>
                
                {/* 로딩 상태 */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        공지사항을 불러오는 중...
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.noticeTable}>
                            <thead>
                                <tr>
                                    <th>제목</th>
                                    <th>글쓴이</th>
                                    <th>작성시간</th>
                                    <th>조회수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentNotices.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
                                            등록된 공지사항이 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    currentNotices.map((notice) => (
                                        <tr key={notice.id} onClick={() => handleNoticeClick(notice.id)} className={styles.tableRow}>
                                            <td className={styles.titleCell}>{notice.title}</td>
                                            <td>{notice.author}</td>
                                            <td>{notice.createdAt.toLocaleDateString('ko-KR')}</td>
                                            <td>{notice.views}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className={styles.bottomSection}>
                    <div className={styles.searchForm}>
                        <div className={styles.searchInputWrapper}>
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={styles.searchInput}
                            />
                            <Image
                                src="/SearchIcon.svg"
                                alt="Search"
                                width={16}
                                height={16}
                                className={styles.searchIcon}
                                onClick={handleSearch}
                            />
                        </div>
                    </div>
                    
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                    />
                </div>
            </div>
        </div>
    );
}