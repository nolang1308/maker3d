'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.scss';
import Pagination from '../../components/Pagination';
import Image from 'next/image';
import Link from 'next/link';
import { getPosts, searchPosts, Post } from '@/services/postService';

export default function NoticePage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearchTerm, setActiveSearchTerm] = useState('');
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 20;

    // 게시글 목록 로드
    const loadPosts = async (reset: boolean = false) => {
        try {
            setLoading(true);
            const { posts: newPosts, lastDoc: newLastDoc } = await getPosts(itemsPerPage, reset ? null : lastDoc);
            
            if (reset) {
                setPosts(newPosts);
            } else {
                setPosts(prev => [...prev, ...newPosts]);
            }
            
            setLastDoc(newLastDoc);
            setHasMore(newPosts.length === itemsPerPage);
        } catch (error) {
            console.error('게시글 로드 에러:', error);
        } finally {
            setLoading(false);
        }
    };

    // 검색 실행
    const handleSearch = async () => {
        try {
            setLoading(true);
            setActiveSearchTerm(searchTerm);
            setCurrentPage(1);
            
            if (searchTerm.trim()) {
                const searchResults = await searchPosts(searchTerm);
                setPosts(searchResults.posts);
                setHasMore(false);
            } else {
                loadPosts(true);
            }
        } catch (error) {
            console.error('검색 에러:', error);
        } finally {
            setLoading(false);
        }
    };

    // 컴포넌트 마운트 시 게시글 로드
    useEffect(() => {
        loadPosts(true);
    }, []);

    // 페이지네이션용 (검색이 아닐 때)
    const totalPages = activeSearchTerm ? Math.ceil(posts.length / itemsPerPage) : Math.ceil(posts.length / itemsPerPage);
    const currentPosts = activeSearchTerm 
        ? posts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : posts.slice(0, currentPage * itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // 날짜 포맷팅
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
    };


    return (
        <div className={styles.container}>
            <div className={styles.noticeContainer}>
                <div className={styles.header}>
                    <h1 className={styles.title}>자유게시판</h1>
                    <Link href="/freenoticeboard/write" className={styles.writeButton}>글쓰기</Link>
                </div>
                
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
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className={styles.loading}>로딩 중...</td>
                                </tr>
                            ) : currentPosts.length > 0 ? (
                                currentPosts.map((post) => (
                                    <tr key={post.id}>
                                        <td className={styles.titleCell}>
                                            <Link href={`/freenoticeboard/${post.id}`} className={styles.titleLink}>
                                                {post.title}
                                            </Link>
                                        </td>
                                        <td>{post.author}</td>
                                        <td>{formatDate(post.createdAt)}</td>
                                        <td>{post.views}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className={styles.noData}>
                                        {activeSearchTerm ? '검색 결과가 없습니다.' : '게시글이 없습니다.'}
                                    </td>
                                </tr>
                            )}
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
                        <Link href="/freenoticeboard/write" className={styles.writeButton}>글쓰기</Link>
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