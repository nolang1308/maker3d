'use client';

import {useState, useEffect} from 'react';
import {useRouter} from 'next/navigation';
import styles from './page.module.scss';
import Pagination from '../../../components/Pagination';
import {getNotices, deleteNotice, Notice} from '@/services/noticeService';
import Image from "next/image";
import OrderListItem from '../../../components/OrderListItem';

interface NoticeItem extends Notice {
    isSelected: boolean; // 선택 체크박스 상태
}

export default function NoticePage() {
    const router = useRouter();
    const [selectedChip, setSelectedChip] = useState<string>('전체');
    const [currentPage, setCurrentPage] = useState<'order' | 'delivery'>('order');

    // 페이지별 칩 설정
    const orderChips = ['전체', '대기중', '처리중'];
    const deliveryChips = ['전체', '배송완료'];
    
    const chips = currentPage === 'order' ? orderChips : deliveryChips;

    // 칩과 작업 상태 매핑
    const getWorkStatusFromChip = (chipName: string): number | null => {
        switch (chipName) {
            case '대기중':
                return 0; // 처리시작
            case '처리중':
                return 1; // 처리중
            case '배송완료':
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
                title: '배송 완료 주문',
                subtitle: '성공적으로 배송 완료된 주문 내역을 관리합니다.'
            };
        }
    };

    // 페이지 변경 핸들러
    const handlePageChange = (page: 'order' | 'delivery') => {
        setCurrentPage(page);
        setSelectedChip('전체'); // 페이지 변경 시 칩 초기화
    };

    // 샘플 주문 데이터
    const sampleOrders = [
        {
            orderNumber: '#MK-2025-0001',
            customerName: '김민수',
            phoneNumber: '010-1234-5678',
            email: 'minsu.kim@email.com',
            fileUrls: ['file1.stl', 'file2.obj'],
            paymentAmount: 21000,
            paymentStatus: '결제 완료',
            orderDate: '2025.10.28',
            orderTime: '14:30',
            workStatus: 1
        },
        {
            orderNumber: '#MK-2025-0002',
            customerName: '이영희',
            phoneNumber: '010-9876-5432',
            email: 'younghee.lee@email.com',
            fileUrls: ['model.stl'],
            paymentAmount: 150000,
            paymentStatus: '결제 완료',
            orderDate: '2025.10.28',
            orderTime: '15:20',
            workStatus: 0
        },
        {
            orderNumber: '#MK-2025-0003',
            customerName: '박철수',
            phoneNumber: '010-5555-1234',
            email: 'chulsoo.park@email.com',
            fileUrls: ['design1.obj', 'design2.stl', 'texture.png'],
            paymentAmount: 320000,
            paymentStatus: '결제 완료',
            orderDate: '2025.10.27',
            orderTime: '09:15',
            workStatus: 2
        }
    ];

    // 현재 페이지와 칩에 따라 주문 리스트 필터링
    const filteredOrders = () => {
        let orders = sampleOrders;
        
        // 페이지별 필터링
        if (currentPage === 'delivery') {
            orders = orders.filter(order => order.workStatus === 2); // 배송완료만
        } else {
            orders = orders.filter(order => order.workStatus !== 2); // 배송완료 제외
        }
        
        // 칩별 필터링
        const filterStatus = getWorkStatusFromChip(selectedChip);
        if (filterStatus !== null) {
            orders = orders.filter(order => order.workStatus === filterStatus);
        }
        
        return orders;
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
                    배송 완료
                </div>

            </div>
            <div className={styles.mainWrapper}>

                <p className={styles.title}>{getPageContent().title}</p>
                <p className={styles.subTitle}>{getPageContent().subtitle}</p>
                <div className={styles.orderStatusWrapper}>
                    <div className={styles.todayOrder}>
                        <p>오늘 주문</p>
                        <p className={styles.olderCount}>12</p>
                    </div>
                    <div className={styles.todayOrder}>
                        <p>대기중</p>
                        <div className={styles.readyCountWrapper}>
                            <p className={styles.readyCount}>12</p>
                            <p className={styles.urgentText}>즉시 처리 필요</p>
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
                    {filteredOrders().map((order, index) => (
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
                        />
                    ))}
                </div>

            </div>



        </div>
    );
}