import styles from './Header.module.scss';
import Image from 'next/image';
import Link from 'next/link';

const Header = () => {
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
                    <Link href="/login" className={styles.userAction}>로그인</Link>
                    <span className={styles.userAction}>·</span>
                    <Link href="/signup" className={styles.userAction}>회원가입</Link>
                </div>
            </div>
        </header>
    );
};

export default Header;