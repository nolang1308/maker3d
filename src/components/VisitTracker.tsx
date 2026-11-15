'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { recordPageView, setTrackingBlocked } from '@/utils/visitStats/tracker';

// 방문 통계: 페이지가 바뀔 때마다 한 번씩 기록한다. 화면에는 아무것도 그리지 않는다
export default function VisitTracker() {
  const pathname = usePathname();
  const { loading, userRole } = useAuth();
  const counted = useRef<string | null>(null);

  useEffect(() => {
    // 관리자인지 확인이 끝난 뒤에 센다 (관리자가 둘러본 것은 통계에 넣지 않는다)
    if (loading || !pathname) return;
    setTrackingBlocked(userRole === 'admin');
    if (userRole === 'admin') return;
    // 같은 주소에서 로그인 상태만 바뀐 경우에는 다시 세지 않는다
    if (counted.current === pathname) return;
    counted.current = pathname;

    if (document.visibilityState === 'visible') {
      recordPageView(pathname);
      return;
    }
    // 뒤쪽 탭에서 열린 페이지는 실제로 볼 때 센다
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', onVisible);
      recordPageView(pathname);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [pathname, loading, userRole]);

  return null;
}
