'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './page.module.scss';
import { getPopups, deletePopup, Popup } from '@/services/popupService';

type PopupStatus = 'active' | 'upcoming' | 'expired';

function getStatus(popup: Popup): PopupStatus {
  const now = new Date();
  if (now < popup.startDate) return 'upcoming';
  if (now > popup.endDate) return 'expired';
  return 'active';
}

function formatDate(date: Date) {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function AdminPopupPage() {
  const router = useRouter();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPopups();
  }, []);

  async function loadPopups() {
    setLoading(true);
    try {
      const data = await getPopups();
      setPopups(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(popup: Popup) {
    if (!confirm(`이 팝업을 삭제하시겠습니까?\n이미지도 함께 삭제됩니다.`)) return;
    try {
      await deletePopup(popup.id);
      setPopups((prev) => prev.filter((p) => p.id !== popup.id));
    } catch (error) {
      console.error('팝업 삭제 에러:', error);
      alert('팝업 삭제에 실패했습니다.');
    }
  }

  const statusLabel: Record<PopupStatus, string> = {
    active: '활성',
    upcoming: '예정',
    expired: '만료',
  };

  return (
    <div className={styles.container}>
      <div className={styles.ManagerSignatureBar}>
        <Image src="/Icon_smile.svg" width={24} height={24} alt="" />
        <p>관리자</p>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>팝업 관리</h1>
          <button className={styles.addButton} onClick={() => router.push('/admin/popup/write')}>
            + 팝업 등록하기
          </button>
        </div>

        {loading ? (
          <div className={styles.stateText}>팝업을 불러오는 중...</div>
        ) : popups.length === 0 ? (
          <div className={styles.stateText}>등록된 팝업이 없습니다.</div>
        ) : (
          <div className={styles.popupGrid}>
            {popups.map((popup) => {
              const status = getStatus(popup);
              return (
                <div key={popup.id} className={styles.popupCard} onClick={() => router.push(`/admin/popup/edit/${popup.id}`)}>
                  <div className={styles.thumbnailWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={popup.imageUrl} alt="팝업 이미지" className={styles.thumbnail} />
                    <span className={`${styles.statusBadge} ${styles[status]}`}>
                      {statusLabel[status]}
                    </span>
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.period}>
                      {formatDate(popup.startDate)} ~ {formatDate(popup.endDate)}
                    </p>
                    {popup.linkUrl && (
                      <p className={styles.linkUrl} title={popup.linkUrl}>
                        {popup.linkUrl}
                      </p>
                    )}
                  </div>
                  <div className={styles.cardFooter}>
                    <button
                      className={styles.editBtn}
                      onClick={(e) => { e.stopPropagation(); router.push(`/admin/popup/edit/${popup.id}`); }}
                    >
                      수정
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => { e.stopPropagation(); handleDelete(popup); }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
