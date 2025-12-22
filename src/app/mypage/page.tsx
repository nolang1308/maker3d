'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User } from 'firebase/auth';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import styles from './page.module.scss';

interface Order {
    orderNumber: string;
    customerName: string;
    phoneNumber: string;
    orderEmail: string; // 주문 시 입력한 이메일
    userEmail: string; // 로그인한 사용자의 계정 이메일
    files: {
        fileName: string;
        material: string;
        color: string;
        quantity: number;
        price: number;
    }[];
    totalPrice: number;
    orderDate: string;
    paymentStatus: string;
    workStatus: string;
}

// 내가 요청한 견적 섹션 컴포넌트
function OrdersSection({ userEmail }: { userEmail: string }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const ordersRef = collection(db, 'orders');
                const q = query(
                    ordersRef,
                    where('userEmail', '==', userEmail)
                );

                const querySnapshot = await getDocs(q);
                const ordersData: Order[] = [];

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    ordersData.push({
                        orderNumber: doc.id,
                        customerName: data.customerName,
                        phoneNumber: data.phoneNumber,
                        orderEmail: data.orderEmail,
                        userEmail: data.userEmail,
                        files: data.files || [],
                        totalPrice: data.totalPrice,
                        orderDate: data.orderDate,
                        paymentStatus: data.paymentStatus,
                        workStatus: data.workStatus
                    });
                });

                // 클라이언트 사이드에서 정렬
                ordersData.sort((a, b) => {
                    const dateA = new Date(a.orderDate).getTime();
                    const dateB = new Date(b.orderDate).getTime();
                    return dateB - dateA; // 최신순
                });

                setOrders(ordersData);
            } catch (error) {
                console.error('주문 내역 불러오기 오류:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [userEmail]);

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending': return '대기중';
            case 'processing': return '처리중';
            case 'completed': return '완료';
            case 'cancelled': return '취소됨';
            default: return status;
        }
    };

    const getPaymentStatusText = (status: string) => {
        switch (status) {
            case 'pending': return '결제대기';
            case 'paid': return '결제완료';
            case 'cancelled': return '취소됨';
            default: return status;
        }
    };

    if (loading) {
        return <div className={styles.loading}>주문 내역을 불러오는 중...</div>;
    }

    if (orders.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>요청한 견적이 없습니다.</p>
                <p className={styles.hint}>견적 페이지에서 견적을 요청해보세요!</p>
            </div>
        );
    }

    return (
        <div className={styles.ordersSection}>
            {orders.map((order) => (
                <div key={order.orderNumber} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                        <div className={styles.orderInfo}>
                            <h3 className={styles.orderNumber}>주문번호: {order.orderNumber}</h3>
                            <p className={styles.orderDate}>
                                {new Date(order.orderDate).toLocaleString('ko-KR')}
                            </p>
                        </div>
                        <div className={styles.statusBadges}>
                            <span className={`${styles.badge} ${styles[order.workStatus]}`}>
                                {getStatusText(order.workStatus)}
                            </span>
                            <span className={`${styles.badge} ${styles[order.paymentStatus]}`}>
                                {getPaymentStatusText(order.paymentStatus)}
                            </span>
                        </div>
                    </div>

                    <div className={styles.orderDetails}>
                        <div className={styles.customerInfo}>
                            <p><strong>주문자:</strong> {order.customerName}</p>
                            <p><strong>연락처:</strong> {order.phoneNumber}</p>
                        </div>

                        <div className={styles.filesList}>
                            <h4>주문 파일</h4>
                            {order.files.map((file, index) => (
                                <div key={index} className={styles.fileItem}>
                                    <div className={styles.fileInfo}>
                                        <span className={styles.fileName}>{file.fileName}</span>
                                        <span className={styles.fileDetails}>
                                            {file.material} | {file.color} | 수량: {file.quantity}개
                                        </span>
                                    </div>
                                    <span className={styles.filePrice}>
                                        ₩{(file.price * file.quantity).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className={styles.totalPrice}>
                            <strong>총 금액:</strong>
                            <span>₩{order.totalPrice.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// 개인정보 수정 섹션 컴포넌트
function ProfileSection({
    user,
    updateUserPassword,
    updateUserProfile
}: {
    user: User | null;
    updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
    updateUserProfile: (displayName: string) => Promise<void>;
}) {
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            if (!displayName.trim()) {
                setError('이름을 입력해주세요.');
                return;
            }

            await updateUserProfile(displayName.trim());
            setMessage('프로필이 성공적으로 업데이트되었습니다.');
        } catch (error: any) {
            console.error('프로필 업데이트 에러:', error);
            setError(error.message || '프로필 업데이트에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            if (!currentPassword || !newPassword || !confirmPassword) {
                setError('모든 비밀번호 필드를 입력해주세요.');
                return;
            }

            if (newPassword !== confirmPassword) {
                setError('새 비밀번호가 일치하지 않습니다.');
                return;
            }

            if (newPassword.length < 6) {
                setError('새 비밀번호는 최소 6자 이상이어야 합니다.');
                return;
            }

            await updateUserPassword(currentPassword, newPassword);
            setMessage('비밀번호가 성공적으로 변경되었습니다.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            console.error('비밀번호 변경 에러:', error);
            if (error.code === 'auth/wrong-password') {
                setError('현재 비밀번호가 올바르지 않습니다.');
            } else if (error.code === 'auth/weak-password') {
                setError('새 비밀번호가 너무 약합니다.');
            } else {
                setError(error.message || '비밀번호 변경에 실패했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.profileSection}>
            <h2 className={styles.sectionTitle}>개인정보 수정</h2>

            {message && <div className={styles.successMessage}>{message}</div>}
            {error && <div className={styles.errorMessage}>{error}</div>}

            {/* 이메일 표시 */}
            <div className={styles.formGroup}>
                <label className={styles.label}>이메일</label>
                <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className={styles.input}
                />
                <p className={styles.hint}>이메일은 변경할 수 없습니다.</p>
            </div>

            {/* 표시 이름 변경 */}
            <form onSubmit={handleUpdateProfile} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>이름</label>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="이름을 입력하세요"
                        className={styles.input}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className={styles.submitButton}
                >
                    {loading ? '저장 중...' : '프로필 저장'}
                </button>
            </form>

            <div className={styles.divider}></div>

            {/* 비밀번호 변경 */}
            <h3 className={styles.subsectionTitle}>비밀번호 변경</h3>
            <form onSubmit={handleUpdatePassword} className={styles.form}>
                <div className={styles.formGroup}>
                    <label className={styles.label}>현재 비밀번호</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="현재 비밀번호"
                        className={styles.input}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>새 비밀번호</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="새 비밀번호 (최소 6자)"
                        className={styles.input}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>새 비밀번호 확인</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="새 비밀번호 확인"
                        className={styles.input}
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className={styles.submitButton}
                >
                    {loading ? '변경 중...' : '비밀번호 변경'}
                </button>
            </form>
        </div>
    );
}

export default function MyPage() {
    const router = useRouter();
    const { user, loading: authLoading, updateUserPassword, updateUserProfile } = useAuth();
    const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');

    // 로그인 체크
    useEffect(() => {
        if (!authLoading && !user) {
            alert('로그인이 필요합니다.');
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // 로딩 중이거나 로그인하지 않은 경우
    if (authLoading || !user) {
        return (
            <div className={styles.container}>
                <div className={styles.content}>
                    <p style={{ textAlign: 'center', marginTop: '100px' }}>로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <h1 className={styles.title}>마이페이지</h1>

                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
                        onClick={() => setActiveTab('orders')}
                    >
                        내가 요청한 견적
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        개인정보수정
                    </button>
                </div>

                <div className={styles.tabContent}>
                    {activeTab === 'orders' && (
                        <OrdersSection userEmail={user.email || ''} />
                    )}

                    {activeTab === 'profile' && (
                        <ProfileSection
                            user={user}
                            updateUserPassword={updateUserPassword}
                            updateUserProfile={updateUserProfile}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
