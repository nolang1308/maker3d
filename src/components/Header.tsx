'use client';

import styles from './Header.module.scss';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
    const { user, userRole, logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            console.log('로그아웃 성공');
        } catch (error) {
            console.error('로그아웃 에러:', error);
        }
    };
    return (
        <header className={styles.header}>
            <div className={styles.container}>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className={styles.logo}>
                    <Image
                        src="/logo.svg"
                        alt="MAKER 3D Logo"
                        width={32}
                        height={32}
                        className={styles.logoIcon}
                    />
                </a>

                <nav className={styles.navigation}>
                    <Link href="/intro" className={styles.navItem}>소개</Link>
                    <Link href="/portfolio" className={styles.navItem}>포트폴리오</Link>
                    <div className={styles.dropdown}>
                        <Link href="/notice" className={styles.navItem}>공지사항</Link>
                        <div className={styles.dropdownMenu}>
                            <Link href="/notice" className={styles.dropdownItem}>공지사항</Link>
                            <Link href="/freenoticeboard" className={styles.dropdownItem}>자유게시판</Link>
                        </div>
                    </div>
                    <Link href="/contact" className={styles.navItem}>고객문의</Link>
                </nav>

                <div className={styles.authButtons}>
                    <Link href="/quote" className={styles.checkQuoteButton}>실시간 견적 확인</Link>
                    <Link href="/store" className={styles.storeButton}>스토어</Link>
                </div>

                <div className={styles.userActions}>
                    {user ? (
                        <>
                            <Link href="/mypage" className={styles.userAction}>
                                {user.email?.split('@')[0]}님
                            </Link>
                            <span className={styles.userAction}>·</span>
                            <button
                                onClick={handleLogout}
                                className={styles.userAction}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                            >
                                로그아웃
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className={styles.userAction}>로그인</Link>
                            <span className={styles.userAction}>·</span>
                            <Link href="/signup" className={styles.userAction}>회원가입</Link>
                        </>
                    )}
                    {userRole === 'admin' && (
                        <div className={styles.dropdown}>
                            <Link href="/admin/order" className={styles.navItem} style={{ color: '#FF6B00', fontWeight: '600' }}>
                                관리자페이지
                            </Link>
                            <div className={styles.dropdownMenu}>
                                <Link href="/admin/order" className={styles.dropdownItem}>주문관리</Link>
                                <Link href="/admin/portfolio" className={styles.dropdownItem}>포트폴리오</Link>
                                <Link href="/admin/notice" className={styles.dropdownItem}>공지사항</Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;