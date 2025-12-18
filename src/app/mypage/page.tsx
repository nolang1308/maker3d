'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { User } from 'firebase/auth';
import styles from './page.module.scss';

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
    const [activeTab, setActiveTab] = useState<'cart' | 'profile'>('cart');

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
                        className={`${styles.tab} ${activeTab === 'cart' ? styles.active : ''}`}
                        onClick={() => setActiveTab('cart')}
                    >
                        장바구니
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        개인정보수정
                    </button>
                </div>

                <div className={styles.tabContent}>
                    {activeTab === 'cart' && (
                        <div className={styles.cartSection}>
                            <p>장바구니 내용이 여기에 표시됩니다.</p>
                        </div>
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
