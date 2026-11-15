'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './QuoteDialog.module.scss';

type Tone = 'info' | 'warn' | 'danger';

interface QuoteDialogProps {
  tone: Tone;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

const ICON_PATHS: Record<Tone, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17v.5" />
    </>
  ),
  danger: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16v.5" />
    </>
  ),
};

// 견적 페이지의 안내 창(크기 초과 · 용량 초과 · 계산 오류 · 로그인 안내)이 같이 쓰는 틀
export default function QuoteDialog({ tone, title, children, onClose }: QuoteDialogProps) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // 창이 열리면 초점을 창 안으로 옮기고, 닫히면 원래 있던 곳으로 돌려 놓는다
    const before = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      before?.focus?.();
    };
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={`${styles.icon} ${styles[tone]}`} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ICON_PATHS[tone]}
          </svg>
        </span>
        <h3 id={titleId} className={styles.title}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
