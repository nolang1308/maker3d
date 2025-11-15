'use client';

import styles from './page.module.scss';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
    const router = useRouter();
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

    const handleSubmit = () => {
        if (isFormValid) {
            // 회원가입 로직 구현
            console.log('회원가입 데이터:', formData);
            // 성공 후 다음 페이지로 이동 또는 로그인 페이지로 이동
            router.push('/login');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.registerContainer}>
                <div className={styles.registerForm}>
                    <h1 className={styles.title}>정보입력</h1>
                    
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
                        disabled={!isFormValid}
                    >
                        가입하기
                    </button>
                </div>
            </div>
        </div>
    );
}