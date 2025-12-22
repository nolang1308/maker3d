'use client';

import styles from './page.module.scss';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [isChecked, setIsChecked] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const isFormValid = email.trim() !== '' && password.trim() !== '' && validateEmail(email);

    const handleLogin = async () => {
        if (!isFormValid) return;

        setLoading(true);
        setError('');

        try {
            await signIn(email, password);
            router.push('/'); // 메인 페이지로 이동
        } catch (error: any) {
            console.error('로그인 에러:', error);
            
            // Firebase 에러 메시지 한국어로 변환
            let errorMessage = '로그인에 실패했습니다.';
            if (error.code === 'auth/user-not-found') {
                errorMessage = '등록되지 않은 이메일입니다.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = '비밀번호가 올바르지 않습니다.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = '올바르지 않은 이메일 형식입니다.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginContainer}>
                <div className={styles.loginForm}>
                    <p className={styles.title}>이메일과 비밀번호를</p>
                    <p className={styles.title}>입력해주세요.</p>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>이메일</label>
                        <input 
                            type="email" 
                            className={styles.input}
                            placeholder="이메일을 입력해주세요."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        {email && !validateEmail(email) && (
                            <div className={styles.fieldError}>
                                올바른 이메일 형식을 입력해주세요.
                            </div>
                        )}
                    </div>
                    
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>비밀번호</label>
                        <input 
                            type="password" 
                            className={styles.input}
                            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}
                    
                    <button 
                        className={`${styles.loginButton} ${isFormValid ? styles.active : ''}`}
                        onClick={handleLogin}
                        disabled={!isFormValid || loading}
                    >
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                    
                    <div className={styles.bottomRow}>
                        <div className={styles.checkmarkContainer}>
                            <input 
                                type="checkbox" 
                                id="autoLogin"
                                checked={isChecked}
                                onChange={(e) => setIsChecked(e.target.checked)}
                                className={styles.checkbox}
                            />
                            <label htmlFor="autoLogin" className={styles.checkText}>자동 로그인</label>
                        </div>
                        <div className={styles.accountActions}>
                            <span className={styles.accountLink}>계정찾기</span>
                            <span className={styles.separator}>|</span>
                            <a href="/signup" className={styles.accountLink}>회원가입</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}