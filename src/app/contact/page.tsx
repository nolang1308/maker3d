'use client';

import styles from './page.module.scss';

export default function ContactPage() {
    return (
        <div className={styles.container}>
            <div className={styles.contactContainer}>
                <h1 className={styles.title}>고객문의</h1>
                <p className={styles.subtitle}>궁금한 점이 있으시면 언제든지 문의해주세요</p>
                
                <div className={styles.content}>
                    <p className={styles.message}>
                        고객문의 페이지는 현재 준비 중입니다.<br/>
                        곧 다양한 문의 방법을 제공해드릴 예정입니다.
                    </p>
                </div>
            </div>
        </div>
    );
}