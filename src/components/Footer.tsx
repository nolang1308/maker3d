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
                        width={36}
                        height={36}
                        className={styles.logoIcon}
                    />
                </div>

                <div className={styles.companyInfo}>
                    <div className={styles.infoSection}>
                        <h4 className={styles.sectionTitle}>개인정보처리방침<span style={{marginLeft: 20}} className={styles.contactRow_}>|       <span
                            style={{marginLeft: 20}}>이용약관</span></span>
                        </h4>
                        <div className={styles.sectionTitle}>고객센터 / 전자금융거래분쟁담당</div>
                    </div>

                    <div className={styles.contactInfo}>
                        <div className={styles.contactRow}>
                            <span>대표이사 : 장재영 | 주소 : 경상북도 구미시 수출대로 225-40, 2층   <span style={{marginLeft: 95}}></span>평일 8시 30분 ~ 19시 00분 | Mail : 3dstore@bittech3d.com</span>
                            <span>사업자번호 : 299-86-02451 | 통신판매번호 : 2023-경북구미-0868호</span>
                            <span style={{marginLeft: 20}}></span>Tel: 054-462 - 4140 | Fax: 054 - 463 - 4140
                            <span>COPYRIGHT © 2025. BIT Tech. all rights reserved.
</span>
                        </div>

                    </div>
                </div>
            </div>
        </footer>
);
};

export default Footer;