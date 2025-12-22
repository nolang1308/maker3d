'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './OrderModal.module.scss';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerInfo) => void;
  totalPrice: number;
  fileCount: number;
}

export interface CustomerInfo {
  name: string;
  phoneNumber: string;
  email: string;
}

export default function OrderModal({
  isOpen,
  onClose,
  onSubmit,
  totalPrice,
  fileCount
}: OrderModalProps) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
    return phoneRegex.test(phone);
  };

  const handleSubmit = () => {
    const newErrors: {[key: string]: string} = {};

    if (!name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = '전화번호를 입력해주세요.';
    } else if (!validatePhoneNumber(phoneNumber)) {
      newErrors.phoneNumber = '올바른 전화번호 형식을 입력해주세요.';
    }

    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!validateEmail(email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({ name, phoneNumber, email });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>주문 정보 입력</h2>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.orderSummary}>
            <p className={styles.summaryTitle}>주문 요약</p>
            <div className={styles.summaryItem}>
              <span>파일 개수</span>
              <span>{fileCount}개</span>
            </div>
            <div className={styles.summaryItem}>
              <span>총 금액</span>
              <span className={styles.price}>₩ {totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.form}>
            <div className={styles.inputGroup}>
              <label>이름 <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({...errors, name: ''});
                }}
                placeholder="이름을 입력해주세요"
                className={errors.name ? styles.error : ''}
              />
              {errors.name && <span className={styles.errorText}>{errors.name}</span>}
            </div>

            <div className={styles.inputGroup}>
              <label>전화번호 <span className={styles.required}>*</span></label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setErrors({...errors, phoneNumber: ''});
                }}
                placeholder="010-1234-5678"
                className={errors.phoneNumber ? styles.error : ''}
              />
              {errors.phoneNumber && <span className={styles.errorText}>{errors.phoneNumber}</span>}
            </div>

            <div className={styles.inputGroup}>
              <label>이메일 <span className={styles.required}>*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({...errors, email: ''});
                }}
                placeholder="example@email.com"
                className={errors.email ? styles.error : ''}
              />
              {errors.email && <span className={styles.errorText}>{errors.email}</span>}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            style={{ background: '#00de5a' }}
          >
            <Image
              src="/btn_npaygr_paying.svg"
              alt="주문하기"
              width={200}
              height={50}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
