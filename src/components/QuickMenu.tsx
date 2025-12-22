'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './QuickMenu.module.scss';

export default function QuickMenu() {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility);
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const handleStoreClick = () => {
        router.push('/store');
    };

    const handleKakaoClick = () => {
        // TODO: 카카오톡 링크 추가 예정
        alert('카카오톡 문의 링크가 곧 추가될 예정입니다.');
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <>
            {/* 데스크톱 퀵메뉴 (1024px 이상) */}
            <div className={styles.quickMenu}>
            {/* 스토어 바로가기 */}
            <div className={styles.menuItem} onClick={handleStoreClick}>
                <Image
                    src="/quick_store.svg"
                    alt="스토어 바로가기"
                    width={30}
                    height={32}
                />
                <p className={styles.menuText}>스토어<br/>바로가기</p>
            </div>

            {/* 카카오톡 문의하기 */}
            <div className={`${styles.menuItem} ${styles.kakao}`} onClick={handleKakaoClick}>
                <Image
                    src="/quick_kakao.svg"
                    alt="카카오톡 문의하기"
                    width={40}
                    height={36}
                />
                <p className={styles.menuText}>카카오톡<br/>문의하기</p>
            </div>

            {/* 페이지 상단으로 */}
            <div className={`${styles.menuItem} ${styles.topButtonWrapper}`}>
                <div
                    className={`${styles.topButton} ${isVisible ? styles.visible : ''}`}
                    onClick={scrollToTop}
                >
                    <Image
                        src="/quick_arrow.svg"
                        alt="페이지 상단으로"
                        width={24}
                        height={24}
                    />
                </div>
            </div>
        </div>

        {/* 모바일 퀵메뉴 (1024px 미만) */}
        <div className={styles.mobileQuickMenu}>
            {/* 메뉴 버튼들 */}
            <div className={`${styles.mobileMenuItems} ${isMenuOpen ? styles.open : ''}`}>
                {/* 스토어 바로가기 */}
                <div className={styles.mobileMenuItem} onClick={handleStoreClick}>
                    <Image
                        src="/quick_store.svg"
                        alt="스토어 바로가기"
                        width={24}
                        height={24}
                    />
                </div>

                {/* 카카오톡 문의하기 */}
                <div className={`${styles.mobileMenuItem} ${styles.kakao}`} onClick={handleKakaoClick}>
                    <Image
                        src="/quick_kakao.svg"
                        alt="카카오톡 문의하기"
                        width={28}
                        height={24}
                    />
                </div>

                {/* 페이지 상단으로 */}
                {isVisible && (
                    <div className={styles.mobileMenuItem} onClick={scrollToTop}>
                        <Image
                            src="/quick_arrow.svg"
                            alt="페이지 상단으로"
                            width={18}
                            height={18}
                        />
                    </div>
                )}
            </div>

            {/* 퀵 버튼 */}
            <div className={`${styles.quickButton} ${isMenuOpen ? styles.active : ''}`} onClick={toggleMenu}>
                <div className={styles.hamburger}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
        </>
    );
}
