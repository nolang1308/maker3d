'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';
import Image from "next/image";
import OrderListItem from '../../../components/OrderListItem';
import ConfirmModal from '../../../components/ConfirmModal';
import { db } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';

interface Order {
    orderNumber: string;
    customerName: string;
    phoneNumber: string;
    email: string;
    fileUrls: string[];
    paymentAmount: number;
    paymentStatus: string;
    orderDate: string;
    orderTime: string;
    workStatus: number;
}

export default function NoticePage() {
    const router = useRouter();
    const [selectedChip, setSelectedChip] = useState<string>('전체');
    const [currentPage, setCurrentPage] = useState<'order' | 'delivery'>('order');
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [cancelOrder, setCancelOrder] = useState<Order | null>(null);

    // 페이지별 칩 설정
    const orderChips = ['전체', '대기중', '처리중'];
    const deliveryChips = ['전체', '처리완료'];
    
    const chips = currentPage === 'order' ? orderChips : deliveryChips;

    // Firestore에서 주문 데이터 가져오기 (실시간)
    useEffect(() => {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const ordersData: Order[] = [];
            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();

                // 취소된 주문은 제외
                if (data.workStatus === 'cancelled') {
                    return;
                }

                // workStatus를 숫자로 변환
                let statusNumber = 0;
                if (data.workStatus === 'pending') statusNumber = 0;
                else if (data.workStatus === 'processing') statusNumber = 1;
                else if (data.workStatus === 'completed') statusNumber = 2;

                // paymentStatus 한글 변환
                let paymentStatusText = '결제 완료';
                if (data.paymentStatus === 'pending') paymentStatusText = '대기중';
                else if (data.paymentStatus === 'failed') paymentStatusText = '실패';
                else if (data.paymentStatus === 'completed') paymentStatusText = '결제 완료';

                ordersData.push({
                    orderNumber: docSnapshot.id,
                    customerName: data.customerName || '',
                    phoneNumber: data.phoneNumber || '',
                    email: data.email || '',
                    fileUrls: data.fileUrls || [],
                    paymentAmount: data.totalPrice || 0,
                    paymentStatus: paymentStatusText,
                    orderDate: data.orderDate ? data.orderDate.split(' ')[0] : '',
                    orderTime: data.orderTime || '',
                    workStatus: statusNumber
                });
            });
            setOrders(ordersData);
            setLoading(false);
        }, (error) => {
            console.error('주문 데이터 로드 오류:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 칩과 작업 상태 매핑
    const getWorkStatusFromChip = (chipName: string): number | null => {
        switch (chipName) {
            case '대기중':
                return 0; // 처리시작
            case '처리중':
                return 1; // 처리중
            case '처리완료':
                return 2; // 배송완료
            case '전체':
            default:
                return null; // 전체 보기
        }
    };

    // 페이지별 제목과 설명
    const getPageContent = () => {
        if (currentPage === 'order') {
            return {
                title: '신규 주문 관리',
                subtitle: '실시간으로 들어오는 3D 프린팅 주문을 관리합니다'
            };
        } else {
            return {
                title: '처리 완료 주문',
                subtitle: '성공적으로 출력이 완료된 주문 내역을 관리합니다.'
            };
        }
    };

    // 페이지 변경 핸들러
    const handlePageChange = (page: 'order' | 'delivery') => {
        setCurrentPage(page);
        setSelectedChip('전체'); // 페이지 변경 시 칩 초기화
    };

    // 현재 페이지와 칩에 따라 주문 리스트 필터링
    const filteredOrders = () => {
        let filtered = orders;

        // 페이지별 필터링
        if (currentPage === 'delivery') {
            filtered = filtered.filter(order => order.workStatus === 2); // 배송완료만
        } else {
            filtered = filtered.filter(order => order.workStatus !== 2); // 배송완료 제외
        }

        // 칩별 필터링
        const filterStatus = getWorkStatusFromChip(selectedChip);
        if (filterStatus !== null) {
            filtered = filtered.filter(order => order.workStatus === filterStatus);
        }

        return filtered;
    };

    // 오늘 주문 개수 계산 (취소된 주문 제외)
    const getTodayOrderCount = () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        return orders.filter(order => order.orderDate === todayStr).length;
    };

    // 대기중 주문 개수 계산 (취소된 주문 제외)
    const getPendingOrderCount = () => {
        return orders.filter(order => order.workStatus === 0).length;
    };

    // 처리시작 버튼 클릭 핸들러
    const handleStartProcessing = (order: Order) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    // 모달 확인 버튼 핸들러
    const handleConfirm = async () => {
        if (!selectedOrder) return;

        try {
            const orderRef = doc(db, 'orders', selectedOrder.orderNumber);
            await updateDoc(orderRef, {
                workStatus: 'processing'
            });

            setIsModalOpen(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('주문 상태 변경 오류:', error);
            alert('주문 상태 변경에 실패했습니다.');
        }
    };

    // 모달 취소 버튼 핸들러
    const handleCancel = () => {
        setIsModalOpen(false);
        setSelectedOrder(null);
    };

    // 주문 취소 버튼 클릭 핸들러
    const handleCancelOrder = (order: Order) => {
        setCancelOrder(order);
        setIsCancelModalOpen(true);
    };

    // 주문 취소 확인 핸들러
    const handleConfirmCancel = async () => {
        if (!cancelOrder) return;

        try {
            const orderRef = doc(db, 'orders', cancelOrder.orderNumber);
            await updateDoc(orderRef, {
                workStatus: 'cancelled'
            });

            setIsCancelModalOpen(false);
            setCancelOrder(null);
        } catch (error) {
            console.error('주문 취소 오류:', error);
            alert('주문 취소에 실패했습니다.');
        }
    };

    // 취소 모달 닫기 핸들러
    const handleCancelModalClose = () => {
        setIsCancelModalOpen(false);
        setCancelOrder(null);
    };

    return (
        <div className={styles.container}>
            <div className={styles.ManagerSignatureBar}>
                <Image src={"/Icon_smile.svg"} width={24} height={24} alt={""}/>
                <p>관리자</p>
            </div>
            <div className={styles.menuBar}>
                <Image
                    src="/logo.svg"
                    alt="MAKER 3D Logo"
                    width={32}
                    height={32}
                    className={styles.logoIcon}
                />
                <div 
                    className={`${styles.orderBtn} ${currentPage === 'order' ? styles.active : ''}`}
                    onClick={() => handlePageChange('order')}
                >
                    신규 주문
                </div>
                <div 
                    className={`${styles.completeBtn} ${currentPage === 'delivery' ? styles.active : ''}`}
                    onClick={() => handlePageChange('delivery')}
                >
                    처리 완료
                </div>

            </div>
            <div className={styles.mainWrapper}>

                <p className={styles.title}>{getPageContent().title}</p>
                <p className={styles.subTitle}>{getPageContent().subtitle}</p>
                <div className={styles.orderStatusWrapper}>
                    <div className={styles.todayOrder}>
                        <p>오늘 주문</p>
                        <p className={styles.olderCount}>{getTodayOrderCount()}</p>
                    </div>
                    <div className={styles.todayOrder}>
                        <p>대기중</p>
                        <div className={styles.readyCountWrapper}>
                            <p className={styles.readyCount}>{getPendingOrderCount()}</p>
                            {getPendingOrderCount() > 0 && (
                                <p className={styles.urgentText}>즉시 처리 필요</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.chipWrapper}>
                    {chips.map((chip) => (
                        <div 
                            key={chip}
                            className={`${styles.chip} ${selectedChip === chip ? styles.chipSelected : ''}`}
                            onClick={() => setSelectedChip(chip)}
                        >
                            {chip}
                        </div>
                    ))}
                </div>
                <div className={styles.listHeader}>
                    <p>주문번호</p>
                    <p>고객 정보</p>
                    <p>파일</p>
                    <p>결제 금액</p>
                    <p>주문 시간</p>
                    <p>작업</p>
                    <p></p>
                </div>
                
                {/* 주문 리스트 */}
                <div className={styles.orderList}>
                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                            주문 데이터를 불러오는 중...
                        </div>
                    ) : filteredOrders().length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                            주문이 없습니다.
                        </div>
                    ) : (
                        filteredOrders().map((order) => (
                            <OrderListItem
                                key={order.orderNumber}
                                orderNumber={order.orderNumber}
                                customerName={order.customerName}
                                phoneNumber={order.phoneNumber}
                                email={order.email}
                                fileUrls={order.fileUrls}
                                paymentAmount={order.paymentAmount}
                                paymentStatus={order.paymentStatus}
                                orderDate={order.orderDate}
                                orderTime={order.orderTime}
                                workStatus={order.workStatus}
                                onStartProcessing={() => handleStartProcessing(order)}
                                onCancelOrder={() => handleCancelOrder(order)}
                            />
                        ))
                    )}
                </div>

            </div>

            {/* 처리 시작 확인 모달 */}
            <ConfirmModal
                isOpen={isModalOpen}
                title="주문 처리 확인"
                message="해당 주문을 진행하시겠습니까?"
                orderNumber={selectedOrder?.orderNumber || ''}
                customerName={selectedOrder?.customerName || ''}
                phoneNumber={selectedOrder?.phoneNumber || ''}
                email={selectedOrder?.email || ''}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                confirmButtonText="확인"
                confirmButtonColor="primary"
            />

            {/* 주문 취소 확인 모달 */}
            <ConfirmModal
                isOpen={isCancelModalOpen}
                title="주문 취소 확인"
                message="해당 주문을 취소하시겠습니까?"
                orderNumber={cancelOrder?.orderNumber || ''}
                customerName={cancelOrder?.customerName || ''}
                phoneNumber={cancelOrder?.phoneNumber || ''}
                email={cancelOrder?.email || ''}
                onConfirm={handleConfirmCancel}
                onCancel={handleCancelModalClose}
                confirmButtonText="취소하기"
                confirmButtonColor="danger"
            />

        </div>
    );
}