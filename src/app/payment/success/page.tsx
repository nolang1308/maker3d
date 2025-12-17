'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './page.module.scss';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const processPaymentResult = async () => {
      try {
        // URL 파라미터에서 결제 정보 추출
        const paymentId = searchParams.get('paymentId');
        const merchantPayKey = searchParams.get('merchantPayKey');
        const resultCode = searchParams.get('resultCode');
        const resultMessage = searchParams.get('resultMessage');

        if (!paymentId || !merchantPayKey) {
          throw new Error('결제 정보가 누락되었습니다.');
        }

        // 서버에 결제 완료 처리 요청
        const response = await fetch('/api/payment/success', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId,
            merchantPayKey,
            resultCode,
            resultMessage,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setOrderInfo({
            orderId: result.orderId,
            message: result.message,
          });
        } else {
          throw new Error(result.message || '주문 처리에 실패했습니다.');
        }
      } catch (err) {
        console.error('결제 완료 처리 오류:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    processPaymentResult();
  }, [searchParams]);

  const handleGoToHome = () => {
    router.push('/');
  };

  const handleGoToOrders = () => {
    router.push('/mypage/orders'); // 주문 내역 페이지로 이동
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSection}>
          <div className={styles.spinner}></div>
          <h2>결제 처리 중...</h2>
          <p>잠시만 기다려주세요.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorSection}>
          <div className={styles.errorIcon}>❌</div>
          <h2>결제 처리 실패</h2>
          <p>{error}</p>
          <div className={styles.buttonSection}>
            <button onClick={handleGoToHome} className={styles.primaryButton}>
              홈으로 이동
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.successSection}>
        <div className={styles.successIcon}>✅</div>
        <h2>결제가 완료되었습니다!</h2>
        <p>{orderInfo?.message}</p>
        
        <div className={styles.orderInfo}>
          <h3>주문 정보</h3>
          <div className={styles.infoRow}>
            <span>주문번호:</span>
            <span>{orderInfo?.orderId}</span>
          </div>
          <div className={styles.infoRow}>
            <span>결제수단:</span>
            <span>네이버페이</span>
          </div>
        </div>

        <div className={styles.buttonSection}>
          <button onClick={handleGoToOrders} className={styles.primaryButton}>
            주문 내역 확인
          </button>
          <button onClick={handleGoToHome} className={styles.secondaryButton}>
            홈으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loadingSection}>
          <div className={styles.spinner}></div>
          <h2>페이지 로딩 중...</h2>
          <p>잠시만 기다려주세요.</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}