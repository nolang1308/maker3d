'use client';

import styles from './page.module.scss';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import termsContent from '@/constants/agreements/terms';
import privacyContent from '@/constants/agreements/privacy';
import marketingContent from '@/constants/agreements/marketing';

export default function SignupPage() {
    const router = useRouter();
    const [agreements, setAgreements] = useState({
        allAgree: false,
        termsRequired: false,
        privacyRequired: false,
        marketingOptional: false,
        messageOptional: false,
        emailOptional: false,
        ageRequired: false
    });

    const handleAllAgree = (checked: boolean) => {
        setAgreements({
            allAgree: checked,
            termsRequired: checked,
            privacyRequired: checked,
            marketingOptional: checked,
            messageOptional: checked,
            emailOptional: checked,
            ageRequired: checked
        });
    };

    const handleIndividualAgree = (key: string, checked: boolean) => {
        const newAgreements = { ...agreements, [key]: checked };
        
        // 전체 동의 체크박스 업데이트
        const allRequired = newAgreements.termsRequired && newAgreements.privacyRequired && newAgreements.ageRequired;
        const allOptional = newAgreements.marketingOptional && newAgreements.messageOptional && newAgreements.emailOptional;
        newAgreements.allAgree = allRequired && allOptional;
        
        setAgreements(newAgreements);
    };

    const isFormValid = agreements.termsRequired && agreements.privacyRequired && agreements.ageRequired;

    const [viewModal, setViewModal] = useState<{ title: string; content: string } | null>(null);

    const agreementModals = {
        terms: { title: '이용약관 동의', content: termsContent },
        privacy: { title: '개인정보 수집 및 이용 동의', content: privacyContent },
        marketing: { title: '마케팅 활용 동의 및 광고 수신 동의', content: marketingContent },
    };

    return (
        <>
        <div className={styles.container}>
            <div className={styles.signupContainer}>
                <div className={styles.signupForm}>
                    <h1 className={styles.title}>회원가입</h1>
                    
                    <div className={styles.agreementSection}>
                        <div className={styles.checkboxGroup}>
                            <input 
                                type="checkbox" 
                                id="allAgree"
                                checked={agreements.allAgree}
                                onChange={(e) => handleAllAgree(e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="allAgree" className={styles.checkboxLabel}>
                                이용약관, 개인정보 수집 및 이용에 모두 동의합니다.
                            </label>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input 
                                type="checkbox" 
                                id="termsRequired"
                                checked={agreements.termsRequired}
                                onChange={(e) => handleIndividualAgree('termsRequired', e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="termsRequired" className={styles.checkboxLabel}>
                                이용약관 동의 <span className={styles.required}>(필수)</span>

                            </label>
                        </div>
                        <div className={styles.textBoxWrapper}>
                            <div className={styles.textBox}>
                                <pre>{termsContent}</pre>
                            </div>
                            <button className={styles.viewAllBtn} onClick={() => setViewModal(agreementModals.terms)}>
                                전체보기
                            </button>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="privacyRequired"
                                checked={agreements.privacyRequired}
                                onChange={(e) => handleIndividualAgree('privacyRequired', e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="privacyRequired" className={styles.checkboxLabel}>
                                개인정보 수집 및 이용 동의 <span className={styles.required}>(필수)</span>
                            </label>
                        </div>
                        <div className={styles.textBoxWrapper}>
                            <div className={styles.textBox}>
                                <pre>{privacyContent}</pre>
                            </div>
                            <button className={styles.viewAllBtn} onClick={() => setViewModal(agreementModals.privacy)}>
                                전체보기
                            </button>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="marketingOptional"
                                checked={agreements.marketingOptional}
                                onChange={(e) => handleIndividualAgree('marketingOptional', e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="marketingOptional" className={styles.checkboxLabel}>
                                마케팅 활용 동의 및 광고 수신 동의
                            </label>
                        </div>
                        <div className={styles.textBoxWrapper}>
                            <div className={styles.textBox}>
                                <pre>{marketingContent}</pre>
                            </div>
                            <button className={styles.viewAllBtn} onClick={() => setViewModal(agreementModals.marketing)}>
                                전체보기
                            </button>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="messageOptional"
                                checked={agreements.messageOptional}
                                onChange={(e) => handleIndividualAgree('messageOptional', e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="messageOptional" className={styles.checkboxLabel}>
                                메시지 수신 동의 <span className={styles.optional}>(선택)</span>
                            </label>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input 
                                type="checkbox" 
                                id="emailOptional"
                                checked={agreements.emailOptional}
                                onChange={(e) => handleIndividualAgree('emailOptional', e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="emailOptional" className={styles.checkboxLabel}>
                                E-Mail 수신 동의 <span className={styles.optional}>(선택)</span>
                            </label>
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input 
                                type="checkbox" 
                                id="ageRequired"
                                checked={agreements.ageRequired}
                                onChange={(e) => handleIndividualAgree('ageRequired', e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="ageRequired" className={styles.checkboxLabel}>
                                만 14세 이상입니다. <span className={styles.required}>(필수)</span>
                            </label>
                        </div>
                    </div>

                    <div className={styles.buttonGroup}>
                        <button 
                            className={styles.cancelButton}
                            onClick={() => router.back()}
                        >
                            취소
                        </button>
                        <button
                            className={`${styles.submitButton} ${isFormValid ? styles.active : ''}`}
                            disabled={!isFormValid}
                            onClick={() => {
                                sessionStorage.setItem('agreements', JSON.stringify({
                                    terms: agreements.termsRequired,
                                    privacy: agreements.privacyRequired,
                                    marketing: agreements.marketingOptional,
                                    message: agreements.messageOptional,
                                    email: agreements.emailOptional,
                                    ageVerified: agreements.ageRequired
                                }));
                                router.push('/register');
                            }}
                        >
                            가입하기
                        </button>
                    </div>
                </div>
            </div>
        </div>

            {/* 전체보기 모달 */}
            {viewModal && (
                <div className={styles.modalOverlay} onClick={() => setViewModal(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>{viewModal.title}</h2>
                            <button className={styles.modalCloseBtn} onClick={() => setViewModal(null)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <pre>{viewModal.content}</pre>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}