'use client';

import styles from './page.module.scss';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
    const router = useRouter();
    const { signUp } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        phone: '',
        birthYear: '',
        birthMonth: '',
        birthDay: ''
    });

    const formatPhoneNumber = (value: string) => {
        // 숫자만 추출
        const numbers = value.replace(/[^\d]/g, '');
        
        // 형식에 맞게 변환
        if (numbers.length <= 3) {
            return numbers;
        } else if (numbers.length <= 7) {
            return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        } else {
            return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
        }
    };

    const handleInputChange = (field: string, value: string) => {
        if (field === 'phone') {
            value = formatPhoneNumber(value);
        }
        
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const isFormValid = 
        formData.email.trim() !== '' &&
        validateEmail(formData.email) &&
        formData.password.trim() !== '' &&
        formData.confirmPassword.trim() !== '' &&
        formData.name.trim() !== '' &&
        formData.phone.trim() !== '' &&
        formData.password === formData.confirmPassword;

    const handleSubmit = async () => {
        if (!isFormValid) return;

        setLoading(true);
        setError('');

        try {
            await signUp(formData.email, formData.password);
            
            // 회원가입 성공 시 추가 사용자 정보를 저장할 수 있습니다.
            // 예: Firestore에 사용자 프로필 정보 저장
            
            console.log('회원가입 성공:', formData);
            alert('회원가입이 완료되었습니다!');
            router.push('/login');
        } catch (error: any) {
            console.error('회원가입 에러:', error);
            
            // Firebase 에러 메시지 한국어로 변환
            let errorMessage = '회원가입에 실패했습니다.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = '이미 사용 중인 이메일입니다.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = '비밀번호는 6자 이상이어야 합니다.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = '올바르지 않은 이메일 형식입니다.';
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.registerContainer}>
                <div className={styles.registerForm}>
                    <h1 className={styles.title}>정보입력</h1>
                    
                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}
                    
                    <div className={styles.inputGroup}>
                        <input 
                            type="email" 
                            className={styles.input}
                            placeholder="이메일"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                        />
                        {formData.email && !validateEmail(formData.email) && (
                            <div className={styles.errorMessage}>
                                올바른 이메일 형식을 입력해주세요.
                            </div>
                        )}
                    </div>
                    
                    <div className={styles.inputGroup}>
                        <input 
                            type="password" 
                            className={styles.input}
                            placeholder="비밀번호"
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                        />
                    </div>
                    
                    <div className={styles.inputGroup}>
                        <input 
                            type="password" 
                            className={styles.input}
                            placeholder="비밀번호 확인"
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        />
                        {formData.confirmPassword && formData.password && formData.password !== formData.confirmPassword && (
                            <div className={styles.errorMessage}>
                                비밀번호가 일치하지 않습니다.
                            </div>
                        )}
                    </div>

                    <div className={styles.sectionTitle}>이름</div>
                    <div className={styles.inputGroup}>
                        <input 
                            type="text" 
                            className={styles.input}
                            placeholder="이름을 입력하세요."
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                        />
                    </div>

                    <div className={styles.sectionTitle}>연락처</div>
                    <div className={styles.inputGroup}>
                        <input 
                            type="tel" 
                            className={styles.input}
                            placeholder="010-0000-0000"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            maxLength={13}
                        />
                    </div>

                    <div className={styles.sectionTitle}>생년월일</div>
                    <div className={styles.birthdateGroup}>
                        <select 
                            className={styles.select}
                            value={formData.birthYear}
                            onChange={(e) => handleInputChange('birthYear', e.target.value)}
                        >
                            <option value="" disabled hidden>년</option>
                            {Array.from({length: 60}, (_, i) => 2024 - i).map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                        
                        <select 
                            className={styles.select}
                            value={formData.birthMonth}
                            onChange={(e) => handleInputChange('birthMonth', e.target.value)}
                        >
                            <option value="" disabled hidden>월</option>
                            {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>{month}</option>
                            ))}
                        </select>
                        
                        <select 
                            className={styles.select}
                            value={formData.birthDay}
                            onChange={(e) => handleInputChange('birthDay', e.target.value)}
                        >
                            <option value="" disabled hidden>일</option>
                            {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                    </div>
                    
                    <button 
                        className={`${styles.registerButton} ${isFormValid ? styles.active : ''}`}
                        onClick={handleSubmit}
                        disabled={!isFormValid || loading}
                    >
                        {loading ? '가입 중...' : '가입하기'}
                    </button>
                </div>
            </div>
        </div>
    );
}