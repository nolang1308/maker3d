'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './page.module.scss';
import Link from 'next/link';
import DownloadAttachment from '../../../components/DownloadAttachment';
import { getPost, incrementViews, Post, deletePost, getPosts } from '@/services/postService';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [modalAction, setModalAction] = useState<'edit' | 'delete' | null>(null);

    // 디버깅용 로그
    useEffect(() => {
        console.log('현재 사용자:', user);
        console.log('현재 게시글:', post);
        if (user && post) {
            console.log('사용자 이메일:', user.email);
            console.log('게시글 작성자 ID:', post.authorId);
            console.log('일치 여부:', user.email === post.authorId);
        }
    }, [user, post]);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [nextPostId, setNextPostId] = useState<string | null>(null);
    const [prevPostId, setPrevPostId] = useState<string | null>(null);

    useEffect(() => {
        const loadPost = async () => {
            try {
                const postId = params.id as string;
                if (!postId) {
                    setError('잘못된 게시글 ID입니다.');
                    setLoading(false);
                    return;
                }

                const postData = await getPost(postId);
                
                if (postData) {
                    setPost(postData);
                    // 조회수 증가
                    await incrementViews(postId);
                    
                    // 이전글/다음글 찾기
                    try {
                        const { posts } = await getPosts(100); // 충분한 수량으로 가져오기
                        const currentIndex = posts.findIndex(p => p.id === postId);
                        
                        // 다음글 (더 최신글)
                        if (currentIndex > 0) {
                            setNextPostId(posts[currentIndex - 1].id!);
                        }
                        
                        // 이전글 (더 오래된 글)
                        if (currentIndex < posts.length - 1) {
                            setPrevPostId(posts[currentIndex + 1].id!);
                        }
                    } catch (error) {
                        console.error('이전글/다음글 조회 에러:', error);
                    }
                } else {
                    setError('게시글을 찾을 수 없습니다.');
                }
            } catch (error) {
                console.error('게시글 로드 에러:', error);
                setError('게시글을 불러오는데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        loadPost();
    }, [params.id]);

    // 날짜 포맷팅
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\./g, '-').replace(/ /g, '').slice(0, -1);
    };

    // 수정 버튼 클릭
    const handleEditClick = () => {
        setModalAction('edit');
        setShowPasswordModal(true);
        setPassword('');
        setPasswordError('');
    };

    // 삭제 버튼 클릭
    const handleDeleteClick = () => {
        setModalAction('delete');
        setShowPasswordModal(true);
        setPassword('');
        setPasswordError('');
    };

    // 비밀번호 확인 및 액션 실행
    const handlePasswordSubmit = async () => {
        if (!post) return;

        if (!password.trim()) {
            setPasswordError('비밀번호를 입력해주세요.');
            return;
        }

        // 디버깅용 로그
        console.log('입력한 비밀번호:', password);
        console.log('게시글 저장된 비밀번호:', post.password);
        
        if (password !== post.password) {
            setPasswordError('비밀번호가 일치하지 않습니다.');
            return;
        }

        try {
            setActionLoading(true);
            setPasswordError('');

            if (modalAction === 'edit') {
                // 수정 페이지로 이동
                router.push(`/freenoticeboard/edit/${post.id}`);
            } else if (modalAction === 'delete') {
                // 게시글 삭제
                await deletePost(post.id!);
                alert('게시글이 삭제되었습니다.');
                router.push('/freenoticeboard');
            }
        } catch (error) {
            console.error('작업 실행 에러:', error);
            setPasswordError('작업 실행에 실패했습니다.');
        } finally {
            setActionLoading(false);
        }
    };

    // 모달 닫기
    const closeModal = () => {
        setShowPasswordModal(false);
        setModalAction(null);
        setPassword('');
        setPasswordError('');
    };

    // 작성자 본인인지 확인
    const isAuthor = user && post && (user.email === post.authorId || user.email?.split('@')[0] === post.author);

    if (loading) {
        return (
            <div className={styles.mainContainer}>
                <div className={styles.loading}>로딩 중...</div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className={styles.mainContainer}>
                <div className={styles.notFound}>
                    <h1>{error || '게시글을 찾을 수 없습니다.'}</h1>
                    <Link href="/freenoticeboard" className={styles.bottomButton}>목록으로 돌아가기</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.mainContainer}>
            <div className={styles.infoContainer}>
                <div className={styles.infoTitle}>
                    <div className={styles.infoTitleText}>{post.title}</div>
                </div>
                
                <div className={styles.info1}>
                    <div className={styles.InnerWrapper}>
                        <div className={styles.infoType}>작성자</div>
                        <div className={styles.info}>{post.author}</div>
                    </div>
                    <div className={styles.InnerWrapper}>
                        <div className={styles.infoType}>작성일</div>
                        <div className={styles.info}>{formatDate(post.createdAt)}</div>
                        <div className={styles.infoType}>조회</div>
                        <div className={styles.info}>{post.views}</div>
                    </div>
                </div>

                <div className={styles.info2}>
                    <div className={styles.infoType}>첨부파일</div>
                    <div className={styles.attachmentContainer}>
                        {post.attachments && post.attachments.length > 0 ? (
                            post.attachments.map((file, index) => (
                                <DownloadAttachment
                                    key={index}
                                    title={file.name}
                                    path={file.url}
                                />
                            ))
                        ) : (
                            <div className={styles.noAttachment}>첨부파일이 존재하지 않음</div>
                        )}
                    </div>
                </div>

                <div className={styles.ContentWrapper}>
                    <div className={styles.details}>
                        {post.content.split('\n').map((line, index) => (
                            <p key={index}>{line}</p>
                        ))}
                    </div>
                </div>
            </div>

            <div className={styles.buttonContainer}>
                {/* 상단 행: 수정/삭제 버튼(왼쪽, 작성자만) vs 네비게이션 버튼(오른쪽) */}
                <div className={styles.topButtonRow}>
                    <div className={styles.actionButtons}>
                        {isAuthor && (
                            <>
                                <button 
                                    className={styles.editButton}
                                    onClick={handleEditClick}
                                >
                                    수정
                                </button>
                                <button 
                                    className={styles.deleteButton}
                                    onClick={handleDeleteClick}
                                >
                                    삭제
                                </button>
                            </>
                        )}
                    </div>
                    <div className={styles.navigationButtons}>
                        {prevPostId ? (
                            <Link href={`/freenoticeboard/${prevPostId}`} className={styles.navButton}>
                                이전글
                            </Link>
                        ) : (
                            <span className={styles.navButtonDisabled}>
                                이전글
                            </span>
                        )}
                        {nextPostId ? (
                            <Link href={`/freenoticeboard/${nextPostId}`} className={styles.navButton}>
                                다음글
                            </Link>
                        ) : (
                            <span className={styles.navButtonDisabled}>
                                다음글
                            </span>
                        )}
                    </div>
                </div>
                
                {/* 하단 행: 목록보기 버튼(중앙) */}
                <div className={styles.bottomButtonRow}>
                    <Link href="/freenoticeboard">
                        <button className={styles.bottomButton}>목록보기</button>
                    </Link>
                </div>
            </div>

            {/* 비밀번호 확인 모달 */}
            {showPasswordModal && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalContent}>
                            <h3 className={styles.modalTitle}>
                                {modalAction === 'edit' ? '게시글 수정' : '게시글 삭제'}
                            </h3>
                            <p className={styles.modalMessage}>
                                {modalAction === 'edit' 
                                    ? '게시글을 수정하려면 비밀번호를 입력해주세요.' 
                                    : '게시글을 삭제하려면 비밀번호를 입력해주세요.'
                                }
                            </p>
                            
                            <input
                                type="password"
                                placeholder="비밀번호 입력"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.passwordInput}
                                maxLength={4}
                            />
                            
                            {passwordError && (
                                <div className={styles.errorMessage}>
                                    {passwordError}
                                </div>
                            )}
                            
                            <div className={styles.modalButtons}>
                                <button 
                                    className={styles.cancelButton}
                                    onClick={closeModal}
                                    disabled={actionLoading}
                                >
                                    취소
                                </button>
                                <button 
                                    className={styles.confirmButton}
                                    onClick={handlePasswordSubmit}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? '처리 중...' : 
                                     modalAction === 'edit' ? '수정하기' : '삭제하기'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}