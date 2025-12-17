'use client';

import React from 'react';
import styles from './index.module.scss';

interface OrderListItemProps {
    orderNumber: string;
    customerName: string;
    phoneNumber: string;
    email: string;
    fileUrls: string[];
    paymentAmount: number;
    paymentStatus: string;
    orderDate: string;
    orderTime: string;
    workStatus: number; // 0: 처리시작, 1: 처리중, 2: 배송완료
}

export default function OrderListItem({
    orderNumber,
    customerName,
    phoneNumber,
    email,
    fileUrls,
    paymentAmount,
    paymentStatus,
    orderDate,
    orderTime,
    workStatus
}: OrderListItemProps) {

    // 주문 시간으로부터 경과 시간 계산
    const getElapsedTime = () => {
        const orderDateTime = new Date(`${orderDate} ${orderTime}`);
        const now = new Date();
        const diffMs = now.getTime() - orderDateTime.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}일 전`;
        } else if (diffHours > 0) {
            return `${diffHours}시간 전`;
        } else {
            return '방금 전';
        }
    };

    // 작업 상태 텍스트 및 스타일
    const getWorkStatusInfo = () => {
        switch (workStatus) {
            case 0:
                return { text: '처리시작', className: styles.statusStart };
            case 1:
                return { text: '처리중', className: styles.statusInProgress };
            case 2:
                return { text: '배송완료', className: styles.statusCompleted };
            default:
                return { text: '처리시작', className: styles.statusStart };
        }
    };

    const statusInfo = getWorkStatusInfo();

    // 금액 포맷팅
    const formatAmount = (amount: number) => {
        return `₩ ${amount.toLocaleString()}`;
    };

    // 파일 다운로드 핸들러
    const handleDownload = () => {
        // 파일 다운로드 로직
        console.log('Download files:', fileUrls);
    };

    // 취소 핸들러
    const handleCancel = () => {
        // 주문 취소 로직
        console.log('Cancel order:', orderNumber);
    };

    return (
        <div className={styles.orderItem}>
            <div className={styles.statusColorBar}></div>


            {/* 주문번호 컬럼 */}
            <div className={styles.orderNumberColumn}>
                <p className={styles.orderNumber}>{orderNumber}</p>
                {workStatus === 2 ? (
                    <p className={styles.completedText}>✓ 완료</p>
                ) : (
                    <p className={styles.elapsedTime}>{getElapsedTime()}</p>
                )}
            </div>

            {/* 고객 정보 컬럼 */}
            <div className={styles.customerColumn}>
                <p className={styles.customerName}>{customerName}</p>
                <p className={styles.customerPhone}>{phoneNumber}</p>
                <p className={styles.customerEmail}>{email}</p>
            </div>

            {/* 파일 컬럼 */}
            <div className={styles.fileColumn}>
                <div className={styles.fileChip} onClick={handleDownload}>
                    <span className={styles.fileCount}>{fileUrls.length}개 파일</span>
                    <button className={styles.downloadBtn}>
                        다운로드
                    </button>
                </div>
            </div>

            {/* 결제 금액 컬럼 */}
            <div className={styles.paymentColumn}>
                <p className={styles.paymentAmount}>{formatAmount(paymentAmount)}</p>
                <p className={styles.paymentStatus}>{paymentStatus}</p>
            </div>

            {/* 주문 시간 컬럼 */}
            <div className={styles.timeColumn}>
                <p className={styles.orderDate}>{orderDate}</p>
                <p className={styles.orderTime}>{orderTime}</p>
            </div>

            {/* 작업 상태 컬럼 */}
            <div className={styles.workColumn}>
                <div className={`${styles.workStatus} ${statusInfo.className}`}>
                    {statusInfo.text}
                </div>
            </div>

            {/* 취소 버튼 */}
            <div className={styles.actionColumn}>
                <button className={styles.cancelBtn} onClick={handleCancel}>
                    취소
                </button>
            </div>
        </div>
    );
}