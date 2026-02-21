import { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  name?: string;
  phone?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// 사용자 문서 생성
export async function createUserDocument(
  uid: string,
  email: string,
  displayName?: string,
  role: 'user' | 'admin' = 'user',
  name?: string,
  phone?: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const userData: Record<string, unknown> = {
      uid,
      email,
      displayName: displayName || email.split('@')[0],
      role,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    if (name) userData.name = name;
    if (phone) userData.phone = phone;

    await setDoc(userRef, userData);
    console.log('사용자 문서 생성 완료:', uid);
  } catch (error) {
    console.error('사용자 문서 생성 에러:', error);
    throw error;
  }
}

// 이름과 전화번호로 사용자 이메일 찾기
export async function findUserByNameAndPhone(name: string, phone: string): Promise<string | null> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('name', '==', name), where('phone', '==', phone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      return data.email || null;
    }

    return null;
  } catch (error) {
    console.error('사용자 찾기 에러:', error);
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
