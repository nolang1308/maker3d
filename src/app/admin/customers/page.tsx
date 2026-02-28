'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.scss';
import Image from 'next/image';
import { db } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { UserData, UserAgreements } from '@/services/userService';
import * as XLSX from 'xlsx';

interface CustomerOrder {
    orderNumber: string;
    totalPrice: number;
    paymentStatus: string;
    workStatus: string;
    orderDate: string;
    orderTime: string;
    fileCount: number;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<UserData[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<UserData | null>(null);
    const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'info' | 'orders'>('info');
    const [loading, setLoading] = useState(true);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportFilters, setExportFilters] = useState({ marketing: false, message: false, email: false });

    // 고객 목록 실시간 로드
    useEffect(() => {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData: UserData[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                usersData.push({
                    uid: data.uid,
                    email: data.email,
                    displayName: data.displayName,
                    name: data.name,
                    phone: data.phone,
                    role: data.role || 'user',
                    agreements: data.agreements ? {
                        ...data.agreements,
                        agreedAt: data.agreements.agreedAt?.toDate() || new Date()
                    } as UserAgreements : undefined,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    updatedAt: data.updatedAt?.toDate() || new Date()
                });
            });
            setCustomers(usersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 선택된 고객의 주문 내역 실시간 로드
    useEffect(() => {
        if (!selectedCustomer) {
            setCustomerOrders([]);
            return;
        }

        setOrdersLoading(true);
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orders: CustomerOrder[] = [];
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                const email = data.orderEmail || data.userEmail || data.email || '';
                if (email !== selectedCustomer.email) return;

                let paymentStatusText = '대기중';
                if (data.paymentStatus === 'payment_pending') paymentStatusText = '결제대기';
                else if (data.paymentStatus === 'completed') paymentStatusText = '결제 완료';
                else if (data.paymentStatus === 'failed') paymentStatusText = '실패';

                let workStatusText = '대기중';
                if (data.workStatus === 'processing') workStatusText = '처리중';
                else if (data.workStatus === 'completed') workStatusText = '처리완료';
                else if (data.workStatus === 'cancelled') workStatusText = '취소됨';

                orders.push({
                    orderNumber: docSnapshot.id,
                    totalPrice: data.totalPrice || 0,
                    paymentStatus: paymentStatusText,
                    workStatus: workStatusText,
                    orderDate: data.orderDate || '',
                    orderTime: data.orderTime || '',
                    fileCount: (data.fileUrls || []).length
                });
            });
            setCustomerOrders(orders);
            setOrdersLoading(false);
        });

        return () => unsubscribe();
    }, [selectedCustomer]);

    const filteredCustomers = customers.filter((customer) => {
        const term = searchTerm.toLowerCase();
        return (
            (customer.name || '').toLowerCase().includes(term) ||
            customer.email.toLowerCase().includes(term)
        );
    });

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatPrice = (price: number) => `₩${price.toLocaleString()}`;

    const getAvatarLetter = (customer: UserData) =>
        (customer.name || customer.email || '?')[0].toUpperCase();

    const getFilteredCustomers = (filters: typeof exportFilters) => {
        let filtered = customers;
        if (filters.marketing) filtered = filtered.filter(c => c.agreements?.marketing === true);
        if (filters.message)   filtered = filtered.filter(c => c.agreements?.message === true);
        if (filters.email)     filtered = filtered.filter(c => c.agreements?.email === true);
        return filtered;
    };

    const exportToExcel = (filters: typeof exportFilters) => {
        const filtered = getFilteredCustomers(filters);

        const rows = filtered.map((c) => ({
            '이름': c.name || '-',
            '이메일': c.email,
            '연락처': c.phone || '-',
            '역할': c.role === 'admin' ? '관리자' : '일반 회원',
            '가입일': formatDate(c.createdAt),
            '이용약관 동의': c.agreements ? (c.agreements.terms ? 'O' : 'X') : '-',
            '개인정보 수집 및 이용동의': c.agreements ? (c.agreements.privacy ? 'O' : 'X') : '-',
            '마케팅 활용 동의 및 광고 수신 동의': c.agreements ? (c.agreements.marketing ? 'O' : 'X') : '-',
            '메시지 수신 동의': c.agreements ? (c.agreements.message ? 'O' : 'X') : '-',
            'E-Mail 수신 동의': c.agreements ? (c.agreements.email ? 'O' : 'X') : '-',
            '만 14세 이상': c.agreements ? (c.agreements.ageVerified ? 'O' : 'X') : '-',
            '동의 일시': c.agreements ? formatDate(c.agreements.agreedAt) : '-',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '고객정보');

        // 컬럼 너비 자동 조정
        const colWidths = Object.keys(rows[0] || {}).map((key) => ({
            wch: Math.max(key.length + 2, 14)
        }));
        worksheet['!cols'] = colWidths;

        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `고객정보_${today}.xlsx`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.ManagerSignatureBar}>
                <Image src="/Icon_smile.svg" width={24} height={24} alt="" />
                <p>관리자</p>
            </div>

            {/* 좌측 고객 목록 패널 */}
            <div className={styles.customerListPanel}>
                <div className={styles.panelHeader}>
                    <Image
                        src="/logo.svg"
                        alt="MAKER 3D Logo"
                        width={185}
                        height={20}
                        className={styles.logoIcon}
                    />
                    <p className={styles.panelTitle}>고객 관리</p>
                    <p className={styles.customerCount}>{customers.length}명의 고객</p>
                    <button
                        className={styles.exportButton}
                        onClick={() => setIsExportModalOpen(true)}
                        disabled={customers.length === 0}
                    >
                        엑셀 내보내기
                    </button>
                </div>

                <div className={styles.searchBox}>
                    <input
                        type="text"
                        placeholder="이름 또는 이메일 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.customerList}>
                    {loading ? (
                        <p className={styles.stateText}>불러오는 중...</p>
                    ) : filteredCustomers.length === 0 ? (
                        <p className={styles.stateText}>고객이 없습니다.</p>
                    ) : (
                        filteredCustomers.map((customer) => (
                            <div
                                key={customer.uid}
                                className={`${styles.customerItem} ${selectedCustomer?.uid === customer.uid ? styles.selected : ''}`}
                                onClick={() => {
                                    setSelectedCustomer(customer);
                                    setActiveTab('info');
                                }}
                            >
                                <div className={styles.customerAvatar}>
                                    {getAvatarLetter(customer)}
                                </div>
                                <div className={styles.customerMeta}>
                                    <p className={styles.customerName}>{customer.name || '이름 없음'}</p>
                                    <p className={styles.customerEmail}>{customer.email}</p>
                                </div>
                                {customer.role === 'admin' && (
                                    <span className={styles.adminBadge}>관리자</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 엑셀 내보내기 필터 모달 */}
            {isExportModalOpen && (
                <div
                    className={styles.exportModalOverlay}
                    onClick={() => setIsExportModalOpen(false)}
                >
                    <div
                        className={styles.exportModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className={styles.exportModalTitle}>엑셀 내보내기 설정</p>
                        <ul className={styles.filterList}>
                            {([
                                { key: 'marketing', label: '마케팅 활용 동의' },
                                { key: 'message',   label: '메시지 수신 동의' },
                                { key: 'email',     label: 'E-Mail 수신 동의' },
                            ] as const).map(({ key, label }) => (
                                <li key={key} className={styles.filterItem}>
                                    <span className={styles.filterLabel}>{label}</span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={exportFilters[key]}
                                        className={`${styles.toggleTrack} ${exportFilters[key] ? styles.toggleOn : ''}`}
                                        onClick={() => setExportFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                                    >
                                        <span className={styles.toggleThumb} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p className={styles.filterCount}>
                            예상 인원: {getFilteredCustomers(exportFilters).length}명
                            {!exportFilters.marketing && !exportFilters.message && !exportFilters.email && ' (전체)'}
                        </p>
                        <div className={styles.exportModalFooter}>
                            <button
                                className={styles.exportCancelBtn}
                                onClick={() => setIsExportModalOpen(false)}
                            >
                                취소
                            </button>
                            <button
                                className={styles.exportConfirmBtn}
                                onClick={() => {
                                    exportToExcel(exportFilters);
                                    setIsExportModalOpen(false);
                                    setExportFilters({ marketing: false, message: false, email: false });
                                }}
                            >
                                내보내기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 우측 고객 상세 패널 */}
            <div className={styles.detailPanel}>
                {!selectedCustomer ? (
                    <div className={styles.emptyDetail}>
                        <div className={styles.emptyIcon}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round"/>
                                <circle cx="12" cy="7" r="4" stroke="#C7C7CC" strokeWidth="2"/>
                            </svg>
                        </div>
                        <p className={styles.emptyDetailText}>고객을 선택하세요</p>
                        <p className={styles.emptyDetailSub}>좌측 목록에서 고객을 클릭하면 상세 정보를 확인할 수 있습니다.</p>
                    </div>
                ) : (
                    <>
                        {/* 고객 헤더 */}
                        <div className={styles.detailHeader}>
                            <div className={styles.detailAvatar}>
                                {getAvatarLetter(selectedCustomer)}
                            </div>
                            <div className={styles.detailHeaderInfo}>
                                <h1 className={styles.detailName}>{selectedCustomer.name || '이름 없음'}</h1>
                                <p className={styles.detailEmail}>{selectedCustomer.email}</p>
                            </div>
                        </div>

                        {/* 탭바 */}
                        <div className={styles.tabBar}>
                            <button
                                className={`${styles.tab} ${activeTab === 'info' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('info')}
                            >
                                고객 정보
                            </button>
                            <button
                                className={`${styles.tab} ${activeTab === 'orders' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('orders')}
                            >
                                주문 이력
                                {customerOrders.length > 0 && (
                                    <span className={styles.orderCountBadge}>{customerOrders.length}</span>
                                )}
                            </button>
                        </div>

                        {/* 탭 콘텐츠 */}
                        <div className={styles.tabContent}>
                            {activeTab === 'info' ? (
                                <div className={styles.infoGrid}>
                                    {/* 기본 정보 */}
                                    <div className={styles.infoSection}>
                                        <h2 className={styles.sectionTitle}>기본 정보</h2>
                                        <div className={styles.infoRows}>
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>이름</span>
                                                <span className={styles.infoValue}>{selectedCustomer.name || '-'}</span>
                                            </div>
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>이메일</span>
                                                <span className={styles.infoValue}>{selectedCustomer.email}</span>
                                            </div>
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>연락처</span>
                                                <span className={styles.infoValue}>{selectedCustomer.phone || '-'}</span>
                                            </div>
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>역할</span>
                                                <span className={`${styles.infoValue} ${selectedCustomer.role === 'admin' ? styles.roleAdmin : styles.roleUser}`}>
                                                    {selectedCustomer.role === 'admin' ? '관리자' : '일반 회원'}
                                                </span>
                                            </div>
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>가입일</span>
                                                <span className={styles.infoValue}>{formatDate(selectedCustomer.createdAt)}</span>
                                            </div>
                                            <div className={styles.infoRow}>
                                                <span className={styles.infoLabel}>최근 수정일</span>
                                                <span className={styles.infoValue}>{formatDate(selectedCustomer.updatedAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 약관 동의 정보 */}
                                    <div className={styles.infoSection}>
                                        <h2 className={styles.sectionTitle}>약관 동의 정보</h2>
                                        {selectedCustomer.agreements ? (
                                            <div className={styles.infoRows}>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>
                                                        이용약관 동의 <span className={styles.requiredTag}>(필수)</span>
                                                    </span>
                                                    <span className={`${styles.infoValue} ${selectedCustomer.agreements.terms ? styles.agreed : styles.notAgreed}`}>
                                                        {selectedCustomer.agreements.terms ? '동의' : '미동의'}
                                                    </span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>
                                                        개인정보 수집 및 이용동의 <span className={styles.requiredTag}>(필수)</span>
                                                    </span>
                                                    <span className={`${styles.infoValue} ${selectedCustomer.agreements.privacy ? styles.agreed : styles.notAgreed}`}>
                                                        {selectedCustomer.agreements.privacy ? '동의' : '미동의'}
                                                    </span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>마케팅 활용 동의 및 광고 수신 동의</span>
                                                    <span className={`${styles.infoValue} ${selectedCustomer.agreements.marketing ? styles.agreed : styles.notAgreed}`}>
                                                        {selectedCustomer.agreements.marketing ? '동의' : '미동의'}
                                                    </span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>
                                                        메시지 수신 동의 <span className={styles.optionalTag}>(선택)</span>
                                                    </span>
                                                    <span className={`${styles.infoValue} ${selectedCustomer.agreements.message ? styles.agreed : styles.notAgreed}`}>
                                                        {selectedCustomer.agreements.message ? '동의' : '미동의'}
                                                    </span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>
                                                        E-Mail 수신 동의 <span className={styles.optionalTag}>(선택)</span>
                                                    </span>
                                                    <span className={`${styles.infoValue} ${selectedCustomer.agreements.email ? styles.agreed : styles.notAgreed}`}>
                                                        {selectedCustomer.agreements.email ? '동의' : '미동의'}
                                                    </span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>
                                                        만 14세 이상 <span className={styles.requiredTag}>(필수)</span>
                                                    </span>
                                                    <span className={`${styles.infoValue} ${selectedCustomer.agreements.ageVerified ? styles.agreed : styles.notAgreed}`}>
                                                        {selectedCustomer.agreements.ageVerified ? '확인' : '미확인'}
                                                    </span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>동의 일시</span>
                                                    <span className={styles.infoValue}>
                                                        {formatDate(selectedCustomer.agreements.agreedAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className={styles.noDataText}>동의 정보가 없습니다. (이전 가입 회원)</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* 주문 이력 탭 */
                                <div className={styles.ordersTab}>
                                    {ordersLoading ? (
                                        <p className={styles.noDataText}>주문 내역 불러오는 중...</p>
                                    ) : customerOrders.length === 0 ? (
                                        <div className={styles.emptyOrders}>
                                            <p>주문 내역이 없습니다.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={styles.orderListHeader}>
                                                <span>주문번호</span>
                                                <span>주문일</span>
                                                <span>파일 수</span>
                                                <span>결제금액</span>
                                                <span>결제상태</span>
                                                <span>작업상태</span>
                                            </div>
                                            <div className={styles.orderItems}>
                                                {customerOrders.map((order) => (
                                                    <div key={order.orderNumber} className={styles.orderItem}>
                                                        <span className={styles.orderNumber}>{order.orderNumber}</span>
                                                        <span>{order.orderDate} {order.orderTime}</span>
                                                        <span>{order.fileCount}개</span>
                                                        <span className={styles.orderPrice}>{formatPrice(order.totalPrice)}</span>
                                                        <span className={`${styles.statusBadge} ${
                                                            order.paymentStatus === '결제 완료' ? styles.badgeSuccess :
                                                            order.paymentStatus === '실패' ? styles.badgeError :
                                                            styles.badgePending
                                                        }`}>
                                                            {order.paymentStatus}
                                                        </span>
                                                        <span className={`${styles.statusBadge} ${
                                                            order.workStatus === '처리완료' ? styles.badgeSuccess :
                                                            order.workStatus === '취소됨' ? styles.badgeError :
                                                            order.workStatus === '처리중' ? styles.badgeProcessing :
                                                            styles.badgePending
                                                        }`}>
                                                            {order.workStatus}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
