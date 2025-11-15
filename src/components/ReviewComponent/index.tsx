'use client';

import styles from './index.module.scss';
import Image from 'next/image';

interface ReviewComponentProps {
    rating: number; // 1-5 별점
    name: string; // 리뷰어 이름
    id: string; // 리뷰 ID
    content: string; // 리뷰 내용
    date: string; // 작성 날짜
    images?: string[]; // 리뷰 이미지들 (선택사항)
    isOwner?: boolean; // 본인이 작성한 리뷰인지 여부
    onEdit?: () => void; // 수정 버튼 클릭 핸들러
    onDelete?: () => void; // 삭제 버튼 클릭 핸들러
}

export default function ReviewComponent({
    rating,
    name,
    id,
    content,
    date,
    images = [],
    isOwner = false,
    onEdit,
    onDelete
}: ReviewComponentProps) {
    // 별점에 따른 텍스트 매핑
    const getRatingText = (rating: number): string => {
        switch (rating) {
            case 5: return '아주 좋아요';
            case 4: return '맘에 들어요';
            case 3: return '보통이에요';
            case 2: return '그냥 그래요';
            case 1: return '별로예요';
            default: return '보통이에요';
        }
    };

    // 이름 마스킹 (마지막 글자를 * 로 변경)
    const maskName = (name: string): string => {
        if (name.length <= 1) return name;
        return name.slice(0, -1) + '*';
    };

    // 별 렌더링
    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <span
                    key={i}
                    className={`${styles.star} ${i <= rating ? styles.filled : styles.empty}`}
                >
                    ★
                </span>
            );
        }
        return stars;
    };

    return (
        <div className={styles.reviewContainer}>
            {/* 상단 별점 및 정보 */}
            <div className={styles.reviewHeader}>
                <div className={styles.leftSection}>
                    <div className={styles.ratingSection}>
                        <div className={styles.stars}>
                            {renderStars(rating)}
                        </div>
                        <span className={styles.ratingText}>{getRatingText(rating)}</span>
                        <span className={styles.reviewDate}>{date}</span>
                    </div>
                </div>
                
                <div className={styles.rightSection}>
                    <span className={styles.reviewerInfo}>
                        <span className={styles.reviewerName}>{maskName(name)}</span>님의 리뷰입니다.
                    </span>
                    {isOwner && (
                        <div className={styles.actionButtons}>
                            <button className={styles.editBtn} onClick={onEdit}>
                                수정
                            </button>
                            <button className={styles.deleteBtn} onClick={onDelete}>
                                삭제
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 리뷰 내용 */}
            <div className={styles.reviewContent}>
                <p className={styles.contentText}>{content}</p>
            </div>

            {/* 리뷰 이미지들 */}
            {images && images.length > 0 && (
                <div className={styles.reviewImageSection}>
                    <div className={styles.reviewImagesGrid}>
                        {images.map((imageUrl, index) => (
                            <div key={index} className={styles.reviewImageContainer}>
                                <Image
                                    src={imageUrl}
                                    alt={`리뷰 이미지 ${index + 1}`}
                                    width={120}
                                    height={120}
                                    className={styles.reviewImage}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}