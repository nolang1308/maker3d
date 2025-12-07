'use client';

import styles from './page.module.scss';
import QnACard from '@/components/QnACard';

export default function ContactPage() {
    const qnaData = [
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },
        {
            question: "테스트 질문입니다. 테스트 질문입니다.",
            answer: "테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. 테스트 답변입니다. ",
            date: "00.00.00"
        },

    ];

    return (
        <div className={styles.container}>
            <div className={styles.contactContainer}>
                <p className={styles.title_1}>안녕하세요?</p>
                <p className={styles.title_2}>Maker 3D는 고객 입장으로 생각합니다.</p>
                <p className={styles.title_3}>무엇을 도와드릴까요?</p>
                <div className={styles.line}></div>

                <div className={styles.qnaSection}>
                    <div className={styles.qnaList}>
                        {qnaData.map((qna, index) => (
                            <QnACard
                                key={index}
                                question={qna.question}
                                answer={qna.answer}
                                date={qna.date}
                            />
                        ))}
                    </div>
                </div>

                <div className={styles.customerServiceSection}>
                    <div className={styles.serviceHeader}>
                        <span className={styles.serviceTitle}>고객센터</span>
                        <span className={styles.serviceTime}>10:00 ~ 18:00</span>
                    </div>
                    
                    <div className={styles.serviceContent}>
                        <div className={styles.serviceInfo}>
                            <div className={styles.serviceInfoItem}>
                                &nbsp;&nbsp;• 주말/공휴일에는 고객센터 휴무입니다.
                            </div>
                            <div className={styles.serviceInfoItem}>
                                &nbsp;&nbsp;• 휴일 및 점심 시간(12:00 ~ 13:00)에는<br/>
                                &nbsp;&nbsp;&nbsp;&nbsp;고객센터를 운영하지 않습니다.
                            </div>
                        </div>
                        
                        <div className={styles.serviceButtons}>
                            <button className={styles.consultButton}>
                                1:1 문의
                            </button>
                            <div className={styles.phoneNumber}>
                                054 - 1234 - 1234
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}