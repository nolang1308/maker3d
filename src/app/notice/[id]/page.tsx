'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import styles from './page.module.scss';
import Link from 'next/link';
import DownloadAttachment from '../../../components/DownloadAttachment';

interface NoticeDetail {
    id: number;
    title: string;
    author: string;
    date: string;
    views: number;
    content: string;
    isPublic: boolean;
    category: string;
    categoryColor: string;
    fontColor: string;
    files?: { name: string; uri: string; size: string }[];
}

const mockNoticeDetails: { [key: string]: NoticeDetail } = {
    '1': {
        id: 1,
        title: '[공지] 문의 및 질문은 고객센터를 이용해주세요',
        author: 'MAKER3D',
        date: '2024-08-12',
        views: 270,
        category: '공지',
        categoryColor: '#B81C7E',
        fontColor: '#ffffff',
        content: `안녕하세요, MAKER3D입니다.

고객님들의 문의 및 질문사항은 고객센터를 통해 접수해주시기 바랍니다.

고객센터 운영시간:
- 평일: 오전 9시 ~ 오후 6시
- 토요일: 오전 9시 ~ 오후 1시
- 일요일 및 공휴일 휴무

빠르고 정확한 답변을 위해 문의 시 다음 정보를 포함해주세요:
1. 제품명
2. 구매일자
3. 문의내용
4. 연락처

감사합니다.`,
        isPublic: true,
        files: [
            { name: "고객센터_이용안내.pdf", uri: "/files/customer_guide.pdf", size: "2.3MB" },
            { name: "문의양식.docx", uri: "/files/inquiry_form.docx", size: "1.1MB" }
        ]
    },
    '2': {
        id: 2,
        title: '프로존 소녀 미니 8K 출력 관련 질문',
        author: '박규만',
        date: '2024-08-29',
        views: 438,
        category: '질문',
        categoryColor: '#2493d8',
        fontColor: '#ffffff',
        content: `프로존 소녀 미니 8K로 출력을 하고 있는데 몇 가지 궁금한 점이 있어서 문의드립니다.

1. 레진 온도는 어느 정도로 설정하는 것이 좋을까요?
2. 출력 후 후처리 과정에서 주의사항이 있나요?
3. 지지대 설정 시 권장사항이 있을까요?

답변 부탁드립니다.`,
        isPublic: false,
        files: []
    },
    '3': {
        id: 3,
        title: 'X축 방전층력',
        author: '조선의',
        date: '2024-08-27',
        views: 353,
        category: '질문',
        categoryColor: '#2493d8',
        fontColor: '#ffffff',
        content: `X축 방전층력 관련하여 문의드립니다.

출력 중에 X축에서 이상한 소리가 나면서 층이 어긋나는 현상이 발생하고 있습니다.

해결 방법이 있을까요?`,
        isPublic: true,
        files: []
    }
};

export default function NoticeDetailPage() {
    const params = useParams();
    const [notice, setNotice] = useState<NoticeDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const id = params.id as string;
        const noticeData = mockNoticeDetails[id];
        
        if (noticeData) {
            setNotice(noticeData);
        }
        setLoading(false);
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

    if (!notice.isPublic) {
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
                          style={{backgroundColor: notice.categoryColor, color: notice.fontColor}}>
                        {notice.category}
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
                        <div className={styles.info}>{notice.date}</div>
                        <div className={styles.infoType}>조회</div>
                        <div className={styles.info}>{notice.views}</div>
                    </div>
                </div>

                <div className={styles.info2}>
                    <div className={styles.infoType}>첨부파일</div>
                    <div className={styles.attachmentContainer}>
                        {notice.files && notice.files.length > 0 ? (
                            notice.files.map((file, index) => (
                                <DownloadAttachment
                                    key={index}
                                    title={file.name}
                                    path={file.uri}
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
                <div className={styles.bottomLeftContainer}>
                    {notice.id > 1 && (
                        <Link href={`/notice/${notice.id - 1}`}>
                            <button className={styles.bottomButton}>이전글</button>
                        </Link>
                    )}
                    <Link href={`/notice/${notice.id + 1}`}>
                        <button className={styles.bottomButton}>다음글</button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
