'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import Pagination from '../../components/Pagination';
import Image from 'next/image';

interface NoticeItem {
    id: number;
    title: string;
    author: string;
    date: string;
    views: number;
    isPublic: boolean;
}

const mockNotices: NoticeItem[] = [
    { id: 1, title: '[공지] 문의 및 질문은 고객센터를 이용해주세요', author: 'MAKER3D', date: '2024-08-12', views: 270, isPublic: true },
    { id: 2, title: '프로존 소녀 미니 8K 출력 관련 질문', author: '박규만', date: '2024-08-29', views: 438, isPublic: false },
    { id: 3, title: 'X축 방전층력', author: '조선의', date: '2024-08-27', views: 353, isPublic: true },
    { id: 4, title: '치루박스 프로 1년 이용권 판매합니다.(부적절 하시면 삭제해 주세요)', author: '김명길', date: '2024-08-23', views: 373, isPublic: false },
    { id: 5, title: '레본에 w40 레진 사용중인데', author: '최지원', date: '2024-08-19', views: 379, isPublic: false },
    { id: 6, title: '소녀 레본 14K 소모품 궁금해요', author: '박인', date: '2024-08-06', views: 414, isPublic: false },
    { id: 7, title: '안녕하세요, 프로존 소녀 마이티 8K으로 애니규빅 Water-Wash Resin 사용하려하는데..', author: '김준호', date: '2024-08-06', views: 437, isPublic: false },
    { id: 8, title: '소녀 미니 8K s 수조 레진누이 질문', author: '석경호', date: '2024-08-05', views: 229, isPublic: false },
    { id: 9, title: '안녕하세요 소녀 레본 14K질문드립니다', author: '문현기', date: '2024-07-31', views: 408, isPublic: false },
    { id: 10, title: '프로존 릴 블랙 3d 프린터 레진의 프린터 세팅방법이 궁금합니다.', author: '이선경', date: '2024-07-30', views: 678, isPublic: false }
];

export default function NoticePage() {
    const router = useRouter();
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearchTerm, setActiveSearchTerm] = useState('');
    const itemsPerPage = 20;

    const filteredNotices = mockNotices.filter(notice => 
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

    const handleNoticeClick = (noticeId: number) => {
        router.push(`/notice/${noticeId}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.noticeContainer}>
                <div className={styles.header}>
                    <h1 className={styles.title}>공지사항</h1>
                </div>
                
                <div className={styles.tableWrapper}>
                    <table className={styles.noticeTable}>
                        <thead>
                            <tr>
                                <th>제목</th>
                                <th>글쓴이</th>
                                <th>작성시간</th>
                                <th>조회수</th>
                                <th>공개여부</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentNotices.map((notice) => (
                                <tr key={notice.id} onClick={() => handleNoticeClick(notice.id)} className={styles.tableRow}>
                                    <td className={styles.titleCell}>{notice.title}</td>
                                    <td>{notice.author}</td>
                                    <td>{notice.date}</td>
                                    <td>{notice.views}</td>
                                    <td className={styles.statusCell}>
                                        <span className={notice.isPublic ? styles.public : styles.private}>
                                            {notice.isPublic ? '공개' : '비공개'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

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