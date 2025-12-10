'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';
import Pagination from '../../../components/Pagination';
import {getNotices, deleteNotice, Notice} from '@/services/noticeService';
import Image from "next/image";

interface NoticeItem extends Notice {
    isSelected: boolean; // 선택 체크박스 상태
}

export default function NoticePage() {
    const router = useRouter();
    const [notices, setNotices] = useState<NoticeItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearchTerm, setActiveSearchTerm] = useState('');
    const [selectAll, setSelectAll] = useState(false);
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 20;

    // Firebase에서 공지사항 데이터 로드
    useEffect(() => {
        const loadNotices = async () => {
            try {
                setLoading(true);
                const response = await getNotices(1, 1000); // 모든 공지사항 가져오기
                const noticeItems: NoticeItem[] = response.notices.map(notice => ({
                    ...notice,
                    isSelected: false
                }));
                setNotices(noticeItems);
            } catch (error) {
                console.error('공지사항 로드 에러:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNotices();
    }, []);

    const filteredNotices = notices.filter(notice =>
        notice.title.toLowerCase().includes(activeSearchTerm.toLowerCase())
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

    const handleAddNotice = () => {
        router.push('/admin/notice/write');
    };

    const handleEdit = (noticeId: string) => {
        router.push(`/admin/notice/edit/${noticeId}`);
    };

    // 공개/비공개 토글
    const handlePublicToggle = (id: string) => {
        setNotices(prev => prev.map(notice =>
            notice.id === id ? {...notice, isPublic: !notice.isPublic} : notice
        ));
    };

    // 개별 선택 체크박스 토글
    const handleSelectToggle = (id: string) => {
        setNotices(prev => prev.map(notice =>
            notice.id === id ? {...notice, isSelected: !notice.isSelected} : notice
        ));
    };

    // 전체 선택 토글
    const handleSelectAll = () => {
        const newSelectAll = !selectAll;
        setSelectAll(newSelectAll);
        setNotices(prev => prev.map(notice => ({...notice, isSelected: newSelectAll})));
    };

    // 선택된 항목 삭제
    const handleDeleteSelected = async () => {
        const selectedNotices = notices.filter(notice => notice.isSelected);
        if (selectedNotices.length === 0) {
            alert('삭제할 항목을 선택해주세요.');
            return;
        }

        if (confirm(`선택된 ${selectedNotices.length}개의 공지사항을 삭제하시겠습니까?`)) {
            try {
                // Firebase에서 선택된 공지사항들 삭제
                await Promise.all(selectedNotices.map(notice => deleteNotice(notice.id)));

                // 로컬 상태 업데이트
                setNotices(prev => prev.filter(notice => !notice.isSelected));
                setSelectAll(false);

                alert('선택된 공지사항이 삭제되었습니다.');
            } catch (error) {
                console.error('공지사항 삭제 에러:', error);
                alert('공지사항 삭제에 실패했습니다.');
            }
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.ManagerSignatureBar}>
                <Image src={"/Icon_smile.svg"} width={24} height={24} alt={""}/>
                <p>관리자</p>
            </div>

            <div className={styles.noticeContainer}>
                {/* 헤더 */}
                <div className={styles.header}>
                    <h1 className={styles.title}>공지사항 관리</h1>
                    <button className={styles.addButton} onClick={handleAddNotice}>
                        + 신규 공지 추가
                    </button>
                </div>

                {/* 검색 */}
                <div className={styles.searchSection}>
                    <div className={styles.searchBox}>
                        <span className={styles.searchLabel}>검색</span>
                        <input
                            type="text"
                            placeholder="제목으로 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            className={styles.searchInput}
                        />
                        <button className={styles.searchButton} onClick={handleSearch}>
                            검색
                        </button>
                    </div>
                </div>

                {/* 로딩 상태 */}
                {loading ? (
                    <div style={{textAlign: 'center', padding: '40px'}}>
                        공지사항을 불러오는 중...
                    </div>
                ) : (
                    <>
                        {/* 공지사항 테이블 */}
                        <div className={styles.tableWrapper}>
                            <table className={styles.noticeTable}>
                                <thead>
                                <tr>
                                    <th>공개</th>
                                    <th>제목</th>
                                    <th>등록일</th>
                                    <th>
                                        <input
                                            type="checkbox"
                                            checked={selectAll}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th>작업</th>
                                </tr>
                                </thead>
                                <tbody>
                                {currentNotices.map((notice) => (
                                    <tr key={notice.id} className={styles.tableRow}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={notice.isPublic}
                                                onChange={() => handlePublicToggle(notice.id)}
                                            />
                                        </td>
                                        <td className={styles.titleCell}>{notice.title}</td>
                                        <td>{notice.createdAt.toLocaleDateString('ko-KR')}</td>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={notice.isSelected}
                                                onChange={() => handleSelectToggle(notice.id)}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className={styles.editButton}
                                                onClick={() => handleEdit(notice.id)}
                                            >
                                                수정
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 선택 삭제 버튼 */}
                        <div className={styles.bulkActions}>
                            <button className={styles.deleteButton} onClick={handleDeleteSelected}>
                                선택항목 삭제
                            </button>
                        </div>

                        {/* 페이지네이션 */}
                        <div className={styles.paginationWrapper}>
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}