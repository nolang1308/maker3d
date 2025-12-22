'use client';

import { useState, useEffect } from 'react';
import styles from './layout.module.scss';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        // 초기 체크
        checkScreenSize();

        // 리사이즈 이벤트 리스너
        window.addEventListener('resize', checkScreenSize);

        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    if (isMobile) {
        return (
            <div className={styles.mobileWarning}>
                <div className={styles.warningContent}>
                    <div className={styles.icon}>
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="#FF6B6B"/>
                        </svg>
                    </div>
                    <h1 className={styles.title}>PC 환경에서 접속해주세요</h1>
                    <p className={styles.message}>
                        관리자 페이지는 PC 환경에서만 이용 가능합니다.
                    </p>

                </div>
            </div>
        );
    }

    return <>{children}</>;
}
