'use client';

import styles from './page.module.scss';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { findUserByNameAndPhone } from '@/services/userService';

type Tab = 'email' | 'password';

function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    const masked = local.slice(0, 2) + '***';
    return `${masked}@${domain}`;
}

function formatPhoneNumber(value: string): string {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
}

export default function FindAccountPage() {
    const { sendPasswordReset } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('email');

    // 이메일 찾기 상태
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [emailResult, setEmailResult] = useState<string | null>(null);
    const [emailError, setEmailError] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);

    // 비밀번호 찾기 상태
    const [resetEmail, setResetEmail] = useState('');
    const [resetSuccess, setResetSuccess] = useState(false);
    const [resetError, setResetError] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const handlePhoneChange = (value: string) => {
        setPhone(formatPhoneNumber(value));
    };

    const isEmailFormValid = name.trim() !== '' && phone.trim() !== '';

    const handleFindEmail = async () => {
        if (!isEmailFormValid) return;
        setEmailLoading(true);
        setEmailError('');
        setEmailResult(null);

        try {
            const found = await findUserByNameAndPhone(name.trim(), phone.trim());
            if (found) {
                setEmailResult(maskEmail(found));
            } else {
                setEmailError('일치하는 계정을 찾을 수 없습니다.');
            }
        } catch {
            setEmailError('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setEmailLoading(false);
        }
    };

    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isResetFormValid = resetEmail.trim() !== '' && validateEmail(resetEmail);

    const handlePasswordReset = async () => {
        if (!isResetFormValid) return;
        setResetLoading(true);
        setResetError('');
        setResetSuccess(false);

        try {
            await sendPasswordReset(resetEmail.trim());
            setResetSuccess(true);
        } catch (error: any) {
            let message = '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
            if (error.code === 'auth/user-not-found') {
                message = '등록되지 않은 이메일입니다.';
            } else if (error.code === 'auth/invalid-email') {
                message = '올바르지 않은 이메일 형식입니다.';
            } else if (error.code === 'auth/too-many-requests') {
                message = '너무 많은 요청이 있었습니다. 잠시 후 다시 시도해주세요.';
            }
            setResetError(message);
        } finally {
            setResetLoading(false);
        }
    };

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        setEmailResult(null);
        setEmailError('');
        setResetSuccess(false);
        setResetError('');
    };

    return (
        <div className={styles.container}>
            <div className={styles.innerContainer}>
                <h1 className={styles.pageTitle}>계정찾기</h1>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'email' ? styles.activeTab : ''}`}
                        onClick={() => handleTabChange('email')}
                    >
                        이메일 찾기
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'password' ? styles.activeTab : ''}`}
                        onClick={() => handleTabChange('password')}
                    >
                        비밀번호 찾기
                    </button>
                </div>

                {activeTab === 'email' && (
                    <div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>이름</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="이름을 입력해주세요."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>전화번호</label>
                            <input
                                type="tel"
                                className={styles.input}
                                placeholder="010-0000-0000"
                                value={phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                maxLength={13}
                            />
                        </div>

                        {emailError && (
                            <div className={styles.errorMessage}>{emailError}</div>
                        )}

                        {emailResult && (
                            <div className={styles.successMessage}>
                                가입된 이메일을 찾았습니다.
                                <div className={styles.foundEmail}>{emailResult}</div>
                            </div>
                        )}

                        <button
                            className={`${styles.submitButton} ${isEmailFormValid ? styles.active : ''}`}
                            onClick={handleFindEmail}
                            disabled={!isEmailFormValid || emailLoading}
                        >
                            {emailLoading ? '조회 중...' : '확인'}
                        </button>
                    </div>
                )}

                {activeTab === 'password' && (
                    <div>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>이메일</label>
                            <input
                                type="email"
                                className={styles.input}
                                placeholder="가입한 이메일을 입력해주세요."
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                            />
                        </div>

                        {resetError && (
                            <div className={styles.errorMessage}>{resetError}</div>
                        )}

                        {resetSuccess && (
                            <div className={styles.successMessage}>
                                비밀번호 재설정 링크를 이메일로 발송했습니다.<br />
                                받은편지함을 확인해주세요.<br />
                                이메일이 보이지 않는다면 <strong>스팸함</strong>도 확인해주세요.
                            </div>
                        )}

                        <button
                            className={`${styles.submitButton} ${isResetFormValid ? styles.active : ''}`}
                            onClick={handlePasswordReset}
                            disabled={!isResetFormValid || resetLoading}
                        >
                            {resetLoading ? '발송 중...' : '재설정 링크 보내기'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
