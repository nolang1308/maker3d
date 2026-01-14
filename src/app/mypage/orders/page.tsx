'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.scss';
import { db } from '@/config/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import Image from 'next/image';

interface OrderItem {
  productId: string;
  productName: string;
  option: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image?: string;
}

interface Order {
  id: string;
  orderId: string;
  orderItems: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  paymentStatus: string;
  orderStatus: string;
  paymentMethod: string;
  createdAt: any;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  shippingInfo: {
    receiverName: string;
    address: string;
    phone: string;
  };
}

export default function MyOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('전체');

  const statusOptions = ['전체', '결제완료', '제작중', '제작완료', '배송중', '배송완료', '취소'];

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Firestore에서 사용자의 주문 내역 가져오기
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('customerInfo.email', '==', user.email),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersData: Order[] = [];
      querySnapshot.forEach((doc) => {
        ordersData.push({
          id: doc.id,
          ...doc.data()
        } as Order);
      });
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error('주문 내역 조회 오류:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  // 주문 상태별 필터링
  const filteredOrders = orders.filter(order => {
    if (selectedStatus === '전체') return true;
    return order.orderStatus === selectedStatus;
  });

  // 주문 상태에 따른 표시 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'PAYMENT_COMPLETED': return '결제완료';
      case 'PRODUCTION_STARTED': return '제작중';
      case 'PRODUCTION_COMPLETED': return '제작완료';
      case 'SHIPPING': return '배송중';
      case 'DELIVERED': return '배송완료';
      case 'CANCELLED': return '취소';
      default: return status;
    }
  };

  // 주문 상태에 따른 색상 클래스
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'PAYMENT_COMPLETED': return styles.statusPaid;
      case 'PRODUCTION_STARTED': return styles.statusProduction;
      case 'PRODUCTION_COMPLETED': return styles.statusCompleted;
      case 'SHIPPING': return styles.statusShipping;
      case 'DELIVERED': return styles.statusDelivered;
      case 'CANCELLED': return styles.statusCancelled;
      default: return styles.statusDefault;
    }
  };

  // 날짜 포맷팅
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerContainer}>
          <div className={styles.loadingSection}>
            <div className={styles.spinner}></div>
            <p>주문 내역을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.innerContainer}>
        <h1 className={styles.pageTitle}>주문 내역</h1>

        {/* 상태 필터 */}
        <div className={styles.filterSection}>
          <div className={styles.statusFilters}>
            {statusOptions.map(status => (
              <button
                key={status}
                className={`${styles.statusFilter} ${selectedStatus === status ? styles.active : ''}`}
                onClick={() => setSelectedStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* 주문 목록 */}
        <div className={styles.ordersSection}>
          {filteredOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>주문 내역이 없습니다</h3>
              <p>스토어에서 마음에 드는 상품을 주문해보세요!</p>
              <button 
                className={styles.goShoppingButton}
                onClick={() => router.push('/store')}
              >
                쇼핑하러 가기
              </button>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderInfo}>
                    <h3>주문번호: {order.orderId}</h3>
                    <p>주문일시: {formatDate(order.createdAt)}</p>
                  </div>
                  <div className={styles.orderStatus}>
                    <span className={`${styles.statusBadge} ${getStatusClass(order.orderStatus)}`}>
                      {getStatusText(order.orderStatus)}
                    </span>
                  </div>
                </div>

                <div className={styles.orderItems}>
                  {order.orderItems?.map((item, index) => (
                    <div key={index} className={styles.orderItem}>
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.productName}
                          width={80}
                          height={80}
                          className={styles.itemImage}
                        />
                      )}
                      <div className={styles.itemDetails}>
                        <h4>{item.productName}</h4>
                        <p>옵션: {item.option}</p>
                        <p>수량: {item.quantity}개</p>
                      </div>
                      <div className={styles.itemPrice}>
                        ₩{item.totalPrice?.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.orderSummary}>
                  <div className={styles.summaryRow}>
                    <span>상품금액</span>
                    <span>₩{(order.totalAmount - (order.shippingFee || 0)).toLocaleString()}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>배송비</span>
                    <span>₩{(order.shippingFee || 0).toLocaleString()}</span>
                  </div>
                  <div className={styles.summaryTotal}>
                    <span>총 결제금액</span>
                    <span>₩{order.totalAmount?.toLocaleString()}</span>
                  </div>
                </div>

                <div className={styles.orderActions}>
                  <button className={styles.detailButton}>
                    주문 상세보기
                  </button>
                  {order.orderStatus === 'PAYMENT_COMPLETED' && (
                    <button className={styles.cancelButton}>
                      주문 취소
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}