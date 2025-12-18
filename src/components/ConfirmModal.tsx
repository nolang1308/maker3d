'use client';

import React from 'react';
import styles from './ConfirmModal.module.scss';

interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message?: string;
    orderNumber: string;
    customerName: string;
    phoneNumber: string;
    email: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmButtonText?: string;
    confirmButtonColor?: 'primary' | 'danger';
}

export default function ConfirmModal({
    isOpen,
    title = '주문 처리 확인',
    message = '해당 주문을 진행하시겠습니까?',
    orderNumber,
    customerName,
    phoneNumber,
    email,
    onConfirm,
    onCancel,
    confirmButtonText = '확인',
    confirmButtonColor = 'primary'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>{title}</h2>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.infoSection}>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>주문 번호</span>
                            <span className={styles.value}>{orderNumber}</span>
                        </div>
                        <div className={styles.divider}></div>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>고객명</span>
                            <span className={styles.value}>{customerName}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>전화번호</span>
                            <span className={styles.value}>{phoneNumber}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>이메일</span>
                            <span className={styles.value}>{email}</span>
                        </div>
                    </div>

                    <p className={styles.confirmMessage}>
                        {message}
                    </p>
                </div>

                <div className={styles.modalFooter}>
                    <button
                        className={styles.cancelButton}
                        onClick={onCancel}
                    >
                        취소
                    </button>
                    <button
                        className={`${styles.confirmButton} ${confirmButtonColor === 'danger' ? styles.dangerButton : ''}`}
                        onClick={onConfirm}
                    >
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
}
