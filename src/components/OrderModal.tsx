'use client';

import { useState, useEffect } from 'react';
import styles from './OrderModal.module.scss';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerInfo) => void;
  onNaverPayOrder: (data: CustomerInfo) => Promise<string>; // 주문번호 반환
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
  onNaverPayOrder,
  totalPrice,
  fileCount
}: OrderModalProps) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setOrderNumber('');
      setName('');
      setPhoneNumber('');
      setEmail('');
      setIsAgreed(false);
      setIsOrderConfirmed(false);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string) => {
    // 010-0000-0000 형식만 허용
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    return phoneRegex.test(phone);
  };

  // 전화번호 자동 포맷팅 (010-0000-0000)
  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/[^\d]/g, '');

    // 최대 11자리까지만 허용
    const limited = numbers.slice(0, 11);

    // 포맷팅
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 7) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 7)}-${limited.slice(7)}`;
    }
  };

  const handleSubmit = async () => {
    const newErrors: {[key: string]: string} = {};

    if (!name.trim()) {
      newErrors.name = '이름을 입력해주세요.';
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = '전화번호를 입력해주세요.';
    } else if (!validatePhoneNumber(phoneNumber)) {
      newErrors.phoneNumber = '010-0000-0000 형식으로 입력해주세요.';
    }

    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.';
    } else if (!validateEmail(email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요. (예: example@email.com)';
    }

    if (!isAgreed) {
      newErrors.agreement = '주문 제작 상품 동의사항에 체크해주세요.';
    }

    if (!isOrderConfirmed) {
      newErrors.orderConfirm = '주문 제작 상품 확인사항에 체크해주세요.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const resultOrderNumber = await onNaverPayOrder({ name, phoneNumber, email });
      setOrderNumber(resultOrderNumber);
      setIsSuccess(true);
    } catch (error) {
      console.error('주문 처리 오류:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 성공 모달
  if (isSuccess) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.successContent}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>견적 요청 완료</h2>
            <p className={styles.successMessage}>
              견적 요청이 성공적으로 접수되었습니다.
            </p>
            <div className={styles.orderNumberBox}>
              <span className={styles.orderNumberLabel}>주문번호</span>
              <span className={styles.orderNumberValue}>{orderNumber}</span>
            </div>
            <p className={styles.successInfo}>
              담당자가 확인 후 연락드리겠습니다.<br />
              마이페이지에서 견적 현황을 확인하실 수 있습니다.
            </p>
            <button className={styles.successBtn} onClick={onClose}>
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                  const formatted = formatPhoneNumber(e.target.value);
                  setPhoneNumber(formatted);
                  setErrors({...errors, phoneNumber: ''});
                }}
                placeholder="010-0000-0000"
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

            {/* 주문 확인 체크박스 */}
            <div className={styles.agreementSection}>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isOrderConfirmed}
                    onChange={(e) => {
                      setIsOrderConfirmed(e.target.checked);
                      setErrors({...errors, orderConfirm: ''});
                    }}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark}></span>
                  <div className={styles.agreementText}>
                    <p>
                      본 상품은 주문 제작 상품으로 결제 완료 후 제작이 시작되며 취소·환불이 제한됨을 확인하였습니다.
                    </p>
                  </div>
                </label>
              </div>
              {errors.orderConfirm && <span className={styles.errorText}>{errors.orderConfirm}</span>}
            </div>

            {/* 동의 체크박스 */}
            <div className={styles.agreementSection}>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isAgreed}
                    onChange={(e) => {
                      setIsAgreed(e.target.checked);
                      setErrors({...errors, agreement: ''});
                    }}
                    className={styles.checkbox}
                  />
                  <span className={styles.checkmark}></span>
                  <div className={styles.agreementText}>
                    <p>
                      본 상품은 주문과 동시에 제작이 진행되는 주문 제작(3D프린팅) 상품으로,
                      결제 완료 후 제작이 즉시 시작되며,
                      이에 따라 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라
                      단순 변심에 의한 취소 및 환불이 제한될 수 있음을 확인하였으며 이에 동의합니다.
                    </p>
                  </div>
                </label>
              </div>
              {errors.agreement && <span className={styles.errorText}>{errors.agreement}</span>}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            className={`${styles.submitBtn} ${(!isAgreed || !isOrderConfirmed || isSubmitting) ? styles.disabled : ''}`}
            onClick={handleSubmit}
            disabled={!isAgreed || !isOrderConfirmed || isSubmitting}
          >
            {isSubmitting ? '처리 중...' : '견적 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
