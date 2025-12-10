'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './page.module.scss';
import Link from 'next/link';
import DownloadAttachment from '../../../components/DownloadAttachment';
import { getNotice, incrementNoticeViews, Notice } from '@/services/noticeService';


export default function NoticeDetailPage() {
    const params = useParams();
    const [notice, setNotice] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadNotice = async () => {
            try {
                const id = params.id as string;
                if (!id) {
                    setLoading(false);
                    return;
                }

                const noticeData = await getNotice(id);
                if (noticeData && noticeData.isPublic) {
                    setNotice(noticeData);
                    // 조회수 증가
                    await incrementNoticeViews(id);
                }
            } catch (error) {
                console.error('공지사항 로드 에러:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNotice();
    }, [params.id]);

    if (loading) {
        return <div className={styles.loading}>로딩 중...</div>;
    }

    if (!notice) {
        return (
            <div className={styles.mainContainer}>
                <div className={styles.notFound}>
                    <h1>비공개 된 게시글 입니다.</h1>
                    <Link href="/notice" className={styles.bottomButton}>돌아가기</Link>
                </div>
            </div>
        );
    }


    return (
        <div className={styles.mainContainer}>
            <div className={styles.infoContainer}>
                <div className={styles.infoTitle}>
                    <span className={styles.chip}
                          style={{backgroundColor: '#B81C7E', color: '#ffffff'}}>
                        공지사항
                    </span>
                    <div className={styles.infoTitleText}>{notice.title}</div>
                </div>
                
                <div className={styles.info1}>
                    <div className={styles.InnerWrapper}>
                        <div className={styles.infoType}>작성자</div>
                        <div className={styles.info}>{notice.author}</div>
                    </div>
                    <div className={styles.InnerWrapper}>
                        <div className={styles.infoType}>작성일</div>
                        <div className={styles.info}>{notice.createdAt.toLocaleDateString('ko-KR')}</div>
                        <div className={styles.infoType}>조회</div>
                        <div className={styles.info}>{notice.views}</div>
                    </div>
                </div>

                <div className={styles.info2}>
                    <div className={styles.infoType}>첨부파일</div>
                    <div className={styles.attachmentContainer}>
                        {notice.attachments && notice.attachments.length > 0 ? (
                            notice.attachments.map((file, index) => (
                                <DownloadAttachment
                                    key={index}
                                    title={file.name}
                                    path={file.url} // GCS 내부 경로 전달
                                />
                            ))
                        ) : (
                            <div className={styles.noAttachment}>첨부파일이 존재하지 않음</div>
                        )}
                    </div>
                </div>

                <div className={styles.ContentWrapper}>
                    <div className={styles.details}>
                        {notice.content.split('\n').map((line, index) => (
                            <p key={index}>{line}</p>
                        ))}
                    </div>
                </div>
            </div>

            <div className={styles.buttonContainer}>
                <Link href="/notice">
                    <button className={styles.bottomButton}>목록보기</button>
                </Link>
            </div>
        </div>
    );
}
