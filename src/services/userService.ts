import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// 사용자 문서 생성
export async function createUserDocument(
  uid: string,
  email: string,
  displayName?: string,
  role: 'user' | 'admin' = 'user'
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const userData = {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      role,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await setDoc(userRef, userData);
    console.log('사용자 문서 생성 완료:', uid);
  } catch (error) {
    console.error('사용자 문서 생성 에러:', error);
    throw error;
  }
}

// 사용자 역할 가져오기
export async function getUserRole(uid: string): Promise<'user' | 'admin'> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      return data.role || 'user';
    }

    // 문서가 없으면 기본 user 역할로 생성
    await createUserDocument(uid, '', undefined, 'user');
    return 'user';
  } catch (error) {
    console.error('사용자 역할 가져오기 에러:', error);
    return 'user';
  }
}

// 사용자 데이터 가져오기
export async function getUserData(uid: string): Promise<UserData | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role || 'user',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      };
    }

    return null;
  } catch (error) {
    console.error('사용자 데이터 가져오기 에러:', error);
    return null;
  }
}

// 사용자 역할 업데이트 (관리자 전용)
export async function updateUserRole(
  uid: string,
  newRole: 'user' | 'admin'
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: Timestamp.now()
    });
    console.log('사용자 역할 업데이트 완료:', uid, newRole);
  } catch (error) {
    console.error('사용자 역할 업데이트 에러:', error);
    throw error;
  }
}

// 사용자 프로필 업데이트
export async function updateUserData(
  uid: string,
  data: Partial<Pick<UserData, 'displayName' | 'email'>>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: Timestamp.now()
    });
    console.log('사용자 데이터 업데이트 완료:', uid);
  } catch (error) {
    console.error('사용자 데이터 업데이트 에러:', error);
    throw error;
  }
}
