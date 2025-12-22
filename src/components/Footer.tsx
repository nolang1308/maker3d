import styles from './Footer.module.scss';
import Image from 'next/image';

const Footer = () => {
    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.logo}>
                    <Image
                        src="/logo.svg"
                        alt="MAKER 3D Logo"
                        width={185}
                        height={20}
                        className={styles.logoIcon}
                    />
                </div>

                <div className={styles.companyInfo}>
                    <div className={styles.mainContent}>
                        {/* 왼쪽: 링크 + 회사정보 */}
                        <div className={styles.leftSection}>
                            <div className={styles.links}>
                                <span className={styles.link}>개인정보처리방침</span>
                                <span className={styles.divider}>|</span>
                                <span className={styles.link}>이용약관</span>
                            </div>
                            <div className={styles.infoDetails}>
                                <div className={styles.infoRow}>
                                    <span>상호명 : (주)비트텍</span>
                                    <span>대표이사 : 장재영</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span>주소 : 경상북도 구미시 수출대로 225-40, 2층</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span>사업자번호 : 299-86-02451</span>
                                    <span>통신판매번호 : 2023-경북구미-0868호</span>
                                </div>
                            </div>
                        </div>

                        {/* 오른쪽: 고객센터 + 연락처 */}
                        <div className={styles.rightSection}>
                            <div className={styles.customerServiceTitle}>
                                고객센터 / 전자금융거래분쟁담당
                            </div>
                            <div className={styles.contactDetails}>
                                <div className={styles.contactRow}>
                                    <span>평일 8시 30분 ~ 19시 00분</span>
                                    <span className={styles.divider}>|</span>
                                    <span>Mail : 3dstore@bittech3d.com</span>
                                </div>
                                <div className={styles.contactRow}>
                                    <span>Tel : 054-462-4140</span>
                                    <span className={styles.divider}>|</span>
                                    <span>Fax : 054-463-4140</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 저작권 */}
                    <div className={styles.copyright}>
                        COPYRIGHT © 2025. BIT Tech. all rights reserved.
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;