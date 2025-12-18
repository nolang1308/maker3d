'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateProfile,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getUserRole, createUserDocument, updateUserData } from '@/services/userService';

interface AuthContextType {
  user: User | null;
  userRole: 'user' | 'admin' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserProfile: (displayName: string) => Promise<void>;
  updateUserEmail: (currentPassword: string, newEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 관리자 이메일 화이트리스트
const ADMIN_EMAILS = [
  'admin@maker3d.com',
  'manager@maker3d.com',
  'suminhwang1308@gmail.com',
  // 여기에 관리자 이메일 추가
];

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);

      // 사용자 역할 설정
      if (user && user.email) {
        const isAdmin = ADMIN_EMAILS.includes(user.email);
        setUserRole(isAdmin ? 'admin' : 'user');
      } else {
        setUserRole(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('로그인 에러:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('회원가입 에러:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 에러:', error);
      throw error;
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    try {
      if (!user || !user.email) {
        throw new Error('로그인된 사용자가 없습니다.');
      }

      // 재인증 필요
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 비밀번호 업데이트
      await updatePassword(user, newPassword);
    } catch (error) {
      console.error('비밀번호 변경 에러:', error);
      throw error;
    }
  };

  const updateUserProfile = async (displayName: string) => {
    try {
      if (!user) {
        throw new Error('로그인된 사용자가 없습니다.');
      }

      await updateProfile(user, { displayName });

      // 상태 업데이트를 위해 강제로 다시 가져오기
      setUser({ ...user, displayName });
    } catch (error) {
      console.error('프로필 업데이트 에러:', error);
      throw error;
    }
  };

  const updateUserEmail = async (currentPassword: string, newEmail: string) => {
    try {
      if (!user || !user.email) {
        throw new Error('로그인된 사용자가 없습니다.');
      }

      // 재인증 필요
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 이메일 업데이트
      await updateEmail(user, newEmail);
    } catch (error) {
      console.error('이메일 변경 에러:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    userRole,
    loading,
    signIn,
    signUp,
    logout,
    updateUserPassword,
    updateUserProfile,
    updateUserEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};