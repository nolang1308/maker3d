import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAgPyZtroqjbYzapY_Co1gDefV2rDCL2no",
  authDomain: "maker3d-rootiy.firebaseapp.com",
  projectId: "maker3d-rootiy",
  storageBucket: "maker3d-rootiy.firebasestorage.app",
  messagingSenderId: "357662818384",
  appId: "1:357662818384:web:5b8e7db4ffd96f8df41155",
  measurementId: "G-TEGGF39W0D"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 로컬 시험용 에뮬레이터 연결.
// 주소가 localhost 이고 브라우저 저장소에 m3dEmulator=1 이 있을 때만 켜진다 (운영 주소에서는 켜지지 않는다).
// 운영 데이터를 건드리지 않고 방문 통계 · 관리자 화면을 시험할 때 쓴다
function emulatorRequested(): boolean {
  if (typeof window === 'undefined') return false;
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return false;
  try {
    return window.localStorage.getItem('m3dEmulator') === '1';
  } catch {
    return false;
  }
}

export const usingEmulator = emulatorRequested();

if (usingEmulator) {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8088);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  } catch {
    // 개발 중 코드가 다시 불려 이미 연결된 경우
  }
}

export default app;
