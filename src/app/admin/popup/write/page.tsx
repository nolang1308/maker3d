'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import { createPopup, PopupFormData } from '@/services/popupService';

export default function PopupWritePage() {
  const router = useRouter();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setError('');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleImageUpload(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!imageFile) { setError('이미지를 업로드해주세요.'); return; }
    if (!startDate) { setError('시작일을 입력해주세요.'); return; }
    if (!endDate)   { setError('종료일을 입력해주세요.'); return; }
    if (startDate > endDate) { setError('종료일은 시작일 이후여야 합니다.'); return; }

    setLoading(true);
    setError('');
    try {
      const formData: PopupFormData = {
        startDate,
        endDate,
        linkUrl: linkUrl.trim() || undefined,
      };
      await createPopup(formData, imageFile);
      router.push('/admin/popup');
    } catch (err) {
      console.error('팝업 등록 에러:', err);
      setError(`팝업 등록에 실패했습니다: ${(err as Error).message}`);
      setLoading(false);
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.formContainer}>
        <h1 className={styles.pageTitle}>팝업 등록</h1>

        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* 이미지 업로드 */}
        <div className={styles.section}>
          <p className={styles.label}>팝업 이미지 <span className={styles.required}>*</span></p>
          {!imagePreview ? (
            <div
              className={`${styles.uploadArea} ${dragActive ? styles.dragActive : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
              <div className={styles.uploadIcon}>🖼️</div>
              <p className={styles.uploadText}>이미지를 끌어다 놓거나 클릭해서 파일을 선택하세요.</p>
              <button type="button" className={styles.selectBtn}>파일 선택</button>
            </div>
          ) : (
            <div className={styles.previewContainer}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="미리보기" className={styles.preview} />
              <button type="button" className={styles.removeBtn} onClick={() => { setImageFile(null); setImagePreview(''); }}>
                이미지 삭제
              </button>
            </div>
          )}
        </div>

        {/* 기간 설정 */}
        <div className={styles.section}>
          <p className={styles.label}>표시 기간 <span className={styles.required}>*</span></p>
          <div className={styles.dateRow}>
            <div className={styles.dateField}>
              <span className={styles.dateLabel}>시작일</span>
              <input
                type="date"
                className={styles.dateInput}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <span className={styles.dateSep}>~</span>
            <div className={styles.dateField}>
              <span className={styles.dateLabel}>종료일</span>
              <input
                type="date"
                className={styles.dateInput}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 클릭 링크 */}
        <div className={styles.section}>
          <p className={styles.label}>클릭 링크 <span className={styles.optional}>(선택)</span></p>
          <input
            type="url"
            className={styles.textInput}
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>

        {/* 버튼 */}
        <div className={styles.buttonRow}>
          <button type="button" className={styles.cancelBtn} onClick={() => router.push('/admin/popup')}>
            취소
          </button>
          <button
            type="button"
            className={`${styles.submitBtn} ${loading ? styles.disabled : ''}`}
            onClick={loading ? undefined : handleSubmit}
            disabled={loading}
          >
            {loading ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
