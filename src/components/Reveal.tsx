'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import styles from './Reveal.module.scss';

/**
 * 처음에는 살짝 아래에 흐리게 있다가, 화면에 들어오면 제자리로 올라오며 나타난다 (한 번만).
 * 안쪽 요소가 따로 움직여야 할 때는 data-shown="true" 를 보고 스타일을 건다.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  style,
  plain = false,
}: {
  children: ReactNode;
  className?: string;
  /** 나타나기 시작할 때까지 기다리는 시간 (초). 여러 개가 차례로 나타나게 할 때 쓴다 */
  delay?: number;
  style?: CSSProperties;
  /** 이 상자 자체는 움직이지 않고, 화면에 들어왔다는 표시(data-shown)만 한다 (안쪽 요소가 저마다 움직일 때) */
  plain?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={`${plain ? '' : styles.reveal} ${!plain && shown ? styles.shown : ''} ${className}`}
      style={{ ...style, '--reveal-delay': `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}
