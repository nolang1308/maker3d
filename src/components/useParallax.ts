'use client';

import { useEffect } from 'react';

/**
 * 마우스 위치를 -1 ~ 1 로 바꿔 요소의 --px, --py 에 넣어 준다 (부드럽게 따라오도록 조금씩 다가간다).
 * 스타일에서 이 값에 서로 다른 배율을 곱해 움직이면 깊이감이 생긴다. 마우스가 있는 기기에서만 동작한다
 */
export function useParallax(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = 0;
    const tick = () => {
      x += (targetX - x) * 0.07;
      y += (targetY - y) * 0.07;
      el.style.setProperty('--px', x.toFixed(4));
      el.style.setProperty('--py', y.toFixed(4));
      frame = Math.abs(targetX - x) + Math.abs(targetY - y) > 0.002 ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      targetX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2));
      targetY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2));
      wake();
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      wake();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}
