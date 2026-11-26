'use client';

/**
 * 로그인 안내 창 (키보드 클리커 · 쉐이프 클리커 만들기 페이지가 함께 쓴다).
 *
 * 화면 전체를 흐리게 덮고 가운데에 띄운다.
 *   entry: 로그인하지 않고 페이지에 들어왔을 때
 *   order: 로그인하지 않은 채 '주문하기'를 눌렀을 때
 * 창에 적는 글은 페이지마다 다르므로 content 로 받는다.
 * 모양(.dialog…)은 클리커 페이지의 스타일을 그대로 쓴다.
 */

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from '@/app/clicker/page.module.scss';

export type LoginDialogKind = 'entry' | 'order';

export interface LoginDialogContent {
  title: string;
  lines: ReactNode[];
  /** 로그인하러 가는 버튼 */
  primary: string;
  /** 창을 닫고 하던 일을 계속하는 버튼 */
  secondary: string;
}

const DialogIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
    <rect x="6.5" y="5.5" width="11" height="9.5" rx="2.5" />
  </svg>
);

/** Esc 는 닫기(= 두 번째 버튼)와 같다 */
export default function LoginDialog({
  kind,
  content,
  busy,
  onPrimary,
  onClose,
}: {
  kind: LoginDialogKind;
  content: LoginDialogContent;
  busy: boolean;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  // 창이 떠 있는 동안: 뒤 화면이 스크롤되지 않게 하고, 닫히면 원래 있던 곳으로 초점을 돌려준다
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    primaryRef.current?.focus({ preventScroll: true });
    return () => {
      root.style.overflow = previousOverflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [kind]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    // Tab 으로 창 뒤의 화면(머리말 등)으로 나가지 않게 창 안에서 돈다
    const buttons = Array.from(boxRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.dialogOverlay} onKeyDown={handleKeyDown}>
      <div
        ref={boxRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clicker-dialog-title"
        aria-describedby="clicker-dialog-body"
      >
        <div className={styles.dialogIcon}>
          <DialogIcon />
        </div>
        <h2 id="clicker-dialog-title" className={styles.dialogTitle}>
          {content.title}
        </h2>
        <div id="clicker-dialog-body" className={styles.dialogBody}>
          {content.lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogSecondary} onClick={onClose} disabled={busy}>
            {content.secondary}
          </button>
          <button ref={primaryRef} type="button" className={styles.dialogPrimary} onClick={onPrimary} disabled={busy}>
            {content.primary}
          </button>
        </div>
      </div>
    </div>
  );
}
