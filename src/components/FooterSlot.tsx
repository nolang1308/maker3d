'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** 푸터 없이 화면 전체를 작업 공간으로 쓰는 경로 (하위 경로 포함) */
const NO_FOOTER_PATHS = ['/cliker'];

/** 사이트 푸터가 들어가는 자리. 제작 화면처럼 푸터를 빼야 하는 경로에서는 아무것도 그리지 않는다 */
export default function FooterSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const hidden = NO_FOOTER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  return hidden ? null : <>{children}</>;
}
