'use client';

import styles from './page.module.scss';
import { useState } from 'react';

export default function LoginPage() {
    const [isChecked, setIsChecked] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const isFormValid = email.trim() !== '' && password.trim() !== '';

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
                    
                    <button className={`${styles.loginButton} ${isFormValid ? styles.active : ''}`}>
                        로그인
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