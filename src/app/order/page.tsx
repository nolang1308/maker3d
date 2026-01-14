'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.scss';
import { useAuth } from '@/contexts/AuthContext';
import { requestNaverPay, PaymentData } from '@/utils/naverPay';

interface CartItem {
  id: string;
  name: string;
  image: string;
  option: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderForm {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerZipcode: string;
  buyerAddress: string;
  buyerDetailAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverZipcode: string;
  receiverAddress: string;
  receiverDetailAddress: string;
  orderMemo: string;
  sameAsOrderer: boolean;
}

function OrderPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  
  const [orderForm, setOrderForm] = useState<OrderForm>({
    buyerName: '',
    buyerEmail: '',
    buyerPhone: '',
    buyerZipcode: '',
    buyerAddress: '',
    buyerDetailAddress: '',
    receiverName: '',
    receiverPhone: '',
    receiverZipcode: '',
    receiverAddress: '',
    receiverDetailAddress: '',
    orderMemo: '',
    sameAsOrderer: true
  });

  // URL 파라미터에서 직접 주문 정보 가져오기
  useEffect(() => {
    const directOrderData = searchParams.get('directOrder');
    if (directOrderData) {
      try {
        const orderData = JSON.parse(decodeURIComponent(directOrderData));
        setCartItems([orderData]);
        setIsDirectOrder(true);
      } catch (error) {
        console.error('직접 주문 데이터 파싱 오류:', error);
      }
    } else {
      // 장바구니에서 주문
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    }

    // 사용자 정보가 있으면 자동으로 채우기
    if (user) {
      setOrderForm(prev => ({
        ...prev,
        buyerName: user.displayName || '',
        buyerEmail: user.email || ''
      }));
    }
  }, [searchParams, user]);

  // 총 주문 금액 계산
  const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = 3000; // 기본 배송비
  const finalAmount = totalAmount + shippingFee;

  // 폼 입력 핸들러
  const handleInputChange = (field: keyof OrderForm, value: string | boolean) => {
    setOrderForm(prev => ({
      ...prev,
      [field]: value
    }));

    // 주문자와 동일 체크시 배송지 정보 복사
    if (field === 'sameAsOrderer' && value === true) {
      setOrderForm(prev => ({
        ...prev,
        receiverName: prev.buyerName,
        receiverPhone: prev.buyerPhone,
        receiverZipcode: prev.buyerZipcode,
        receiverAddress: prev.buyerAddress,
        receiverDetailAddress: prev.buyerDetailAddress
      }));
    }
  };

  // 주문 유효성 검사
  const validateOrder = (): boolean => {
    if (!orderForm.buyerName || !orderForm.buyerEmail || !orderForm.buyerPhone) {
      alert('주문자 정보를 모두 입력해 주세요.');
      return false;
    }

    if (!orderForm.buyerAddress || !orderForm.buyerDetailAddress) {
      alert('주문자 주소를 입력해 주세요.');
      return false;
    }

    if (!orderForm.receiverName || !orderForm.receiverPhone) {
      alert('받는분 정보를 모두 입력해 주세요.');
      return false;
    }

    if (!orderForm.receiverAddress || !orderForm.receiverDetailAddress) {
      alert('배송지 주소를 입력해 주세요.');
      return false;
    }

    return true;
  };

  // 결제 처리
  const handlePayment = async () => {
    if (!validateOrder()) return;
    
    if (cartItems.length === 0) {
      alert('주문할 상품이 없습니다.');
      return;
    }

    try {
      setIsPaymentLoading(true);

      // 주문 상품명 생성
      const productNames = cartItems.map(item => 
        `${item.name}(${item.option})`
      );
      const mainProductName = productNames[0];
      const productName = productNames.length > 1 
        ? `${mainProductName} 외 ${productNames.length - 1}건`
        : mainProductName;

      // 네이버페이 결제 데이터 준비
      const paymentData: PaymentData = {
        productId: cartItems[0].id,
        productName: productName,
        quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
        totalPayAmount: finalAmount,
        customerName: orderForm.buyerName,
        customerPhone: orderForm.buyerPhone,
        customerEmail: orderForm.buyerEmail
      };

      // 주문 정보를 sessionStorage에 저장 (결제 완료 후 사용)
      sessionStorage.setItem('orderInfo', JSON.stringify({
        orderForm,
        cartItems,
        totalAmount,
        shippingFee,
        finalAmount
      }));

      // 네이버페이 결제 요청
      const naverPayResult = await requestNaverPay(paymentData);

      if (naverPayResult.success) {
        console.log('네이버페이 결제 요청 성공:', naverPayResult.orderId);
        
        // 장바구니에서 주문한 경우 장바구니 비우기
        if (!isDirectOrder) {
          localStorage.removeItem('cart');
        }
      }

    } catch (error) {
      console.error('결제 처리 중 오류:', error);
      alert('결제 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <div className={styles.emptyCart}>
            <h2>주문할 상품이 없습니다.</h2>
            <button onClick={() => router.push('/store')}>스토어로 이동</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <h1 className={styles.pageTitle}>주문서 작성</h1>

        {/* 주문 상품 정보 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>주문 상품</h2>
          <div className={styles.productList}>
            {cartItems.map((item, index) => (
              <div key={index} className={styles.productItem}>
                <div className={styles.productInfo}>
                  <img src={item.image} alt={item.name} className={styles.productImage} />
                  <div className={styles.productDetails}>
                    <h3>{item.name}</h3>
                    <p>옵션: {item.option}</p>
                    <p>수량: {item.quantity}개</p>
                  </div>
                </div>
                <div className={styles.productPrice}>
                  ₩{item.totalPrice.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 주문자 정보 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>주문자 정보</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>이름 *</label>
              <input
                type="text"
                value={orderForm.buyerName}
                onChange={(e) => handleInputChange('buyerName', e.target.value)}
                placeholder="이름을 입력하세요"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>이메일 *</label>
              <input
                type="email"
                value={orderForm.buyerEmail}
                onChange={(e) => handleInputChange('buyerEmail', e.target.value)}
                placeholder="이메일을 입력하세요"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>휴대폰 번호 *</label>
              <input
                type="tel"
                value={orderForm.buyerPhone}
                onChange={(e) => handleInputChange('buyerPhone', e.target.value)}
                placeholder="휴대폰 번호를 입력하세요"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>우편번호</label>
              <input
                type="text"
                value={orderForm.buyerZipcode}
                onChange={(e) => handleInputChange('buyerZipcode', e.target.value)}
                placeholder="우편번호"
              />
            </div>
            <div className={styles.formGroup}>
              <label>주소 *</label>
              <input
                type="text"
                value={orderForm.buyerAddress}
                onChange={(e) => handleInputChange('buyerAddress', e.target.value)}
                placeholder="주소를 입력하세요"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>상세주소 *</label>
              <input
                type="text"
                value={orderForm.buyerDetailAddress}
                onChange={(e) => handleInputChange('buyerDetailAddress', e.target.value)}
                placeholder="상세주소를 입력하세요"
                required
              />
            </div>
          </div>
        </div>

        {/* 배송지 정보 */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>배송지 정보</h2>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={orderForm.sameAsOrderer}
                onChange={(e) => handleInputChange('sameAsOrderer', e.target.checked)}
              />
              주문자 정보와 동일
            </label>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>받는분 *</label>
              <input
                type="text"
                value={orderForm.receiverName}
                onChange={(e) => handleInputChange('receiverName', e.target.value)}
                placeholder="받는분 이름"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>휴대폰 번호 *</label>
              <input
                type="tel"
                value={orderForm.receiverPhone}
                onChange={(e) => handleInputChange('receiverPhone', e.target.value)}
                placeholder="받는분 휴대폰 번호"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>우편번호</label>
              <input
                type="text"
                value={orderForm.receiverZipcode}
                onChange={(e) => handleInputChange('receiverZipcode', e.target.value)}
                placeholder="우편번호"
              />
            </div>
            <div className={styles.formGroup}>
              <label>배송지 주소 *</label>
              <input
                type="text"
                value={orderForm.receiverAddress}
                onChange={(e) => handleInputChange('receiverAddress', e.target.value)}
                placeholder="배송지 주소"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>상세주소 *</label>
              <input
                type="text"
                value={orderForm.receiverDetailAddress}
                onChange={(e) => handleInputChange('receiverDetailAddress', e.target.value)}
                placeholder="상세주소"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>배송 메모</label>
              <textarea
                value={orderForm.orderMemo}
                onChange={(e) => handleInputChange('orderMemo', e.target.value)}
                placeholder="배송시 요청사항을 입력하세요"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* 결제 정보 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>결제 정보</h2>
          <div className={styles.paymentSummary}>
            <div className={styles.summaryRow}>
              <span>상품금액</span>
              <span>₩{totalAmount.toLocaleString()}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>배송비</span>
              <span>₩{shippingFee.toLocaleString()}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.total}>총 결제금액</span>
              <span className={styles.total}>₩{finalAmount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 결제 버튼 */}
        <div className={styles.paymentSection}>
          <button
            className={styles.paymentButton}
            onClick={handlePayment}
            disabled={isPaymentLoading}
          >
            {isPaymentLoading ? '결제 진행 중...' : `₩${finalAmount.toLocaleString()} 네이버페이로 결제하기`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div style={{textAlign: 'center', padding: '2rem'}}>주문 페이지 로딩 중...</div>}>
      <OrderPageContent />
    </Suspense>
  );
}