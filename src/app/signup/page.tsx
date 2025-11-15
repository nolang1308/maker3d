'use client';

import styles from './page.module.scss';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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

    return (
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
                        <div className={styles.textBox}>
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
                        <div className={styles.textBox}>

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
                        <div className={styles.textBox}>
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
                            onClick={() => router.push('/register')}
                        >
                            가입하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}