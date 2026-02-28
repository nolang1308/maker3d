import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '@/config/firebase';

export interface Popup {
  id: string;
  imageUrl: string;
  startDate: Date;
  endDate: Date;
  linkUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

function documentToPopup(docSnap: DocumentSnapshot): Popup | null {
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    imageUrl: data.imageUrl || '',
    startDate: data.startDate?.toDate() || new Date(),
    endDate: data.endDate?.toDate() || new Date(),
    linkUrl: data.linkUrl || undefined,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

async function uploadPopupImage(imageFile: File): Promise<string> {
  const fileName = `popups/${Date.now()}_${imageFile.name}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, imageFile);
  return getDownloadURL(storageRef);
}

async function deletePopupImage(imageUrl: string): Promise<void> {
  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
  } catch {
    // URL로 직접 참조가 안 될 경우 path 추출 시도
    try {
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
      if (pathMatch) {
        const decodedPath = decodeURIComponent(pathMatch[1]);
        const storageRef = ref(storage, decodedPath);
        await deleteObject(storageRef);
      }
    } catch {
      console.error('이미지 삭제 실패 (무시):', imageUrl);
    }
  }
}

export async function getPopups(): Promise<Popup[]> {
  try {
    const q = query(collection(db, 'popups'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const popups: Popup[] = [];
    snapshot.forEach((d) => {
      const p = documentToPopup(d);
      if (p) popups.push(p);
    });
    return popups;
  } catch (error) {
    console.error('팝업 목록 조회 에러:', error);
    return [];
  }
}

export async function getActivePopups(): Promise<Popup[]> {
  try {
    const all = await getPopups();
    const now = new Date();
    return all.filter((p) => p.startDate <= now && now <= p.endDate);
  } catch (error) {
    console.error('활성 팝업 조회 에러:', error);
    return [];
  }
}

export async function getPopup(id: string): Promise<Popup | null> {
  try {
    const docSnap = await getDoc(doc(db, 'popups', id));
    return documentToPopup(docSnap);
  } catch (error) {
    console.error('팝업 조회 에러:', error);
    return null;
  }
}

export interface PopupFormData {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  linkUrl?: string;
}

export async function createPopup(data: PopupFormData, imageFile: File): Promise<Popup> {
  const imageUrl = await uploadPopupImage(imageFile);
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, 'popups'), {
    imageUrl,
    startDate: Timestamp.fromDate(new Date(data.startDate)),
    endDate: Timestamp.fromDate(new Date(data.endDate + 'T23:59:59')),
    linkUrl: data.linkUrl || null,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: docRef.id,
    imageUrl,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate + 'T23:59:59'),
    linkUrl: data.linkUrl || undefined,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
}

export async function updatePopup(
  id: string,
  data: PopupFormData,
  imageFile?: File,
  existingImageUrl?: string
): Promise<void> {
  let imageUrl = existingImageUrl || '';

  if (imageFile) {
    imageUrl = await uploadPopupImage(imageFile);
    if (existingImageUrl) {
      await deletePopupImage(existingImageUrl);
    }
  }

  await updateDoc(doc(db, 'popups', id), {
    imageUrl,
    startDate: Timestamp.fromDate(new Date(data.startDate)),
    endDate: Timestamp.fromDate(new Date(data.endDate + 'T23:59:59')),
    linkUrl: data.linkUrl || null,
    updatedAt: Timestamp.now(),
  });
}

export async function deletePopup(id: string): Promise<void> {
  const popup = await getPopup(id);
  if (popup?.imageUrl) {
    await deletePopupImage(popup.imageUrl);
  }
  await deleteDoc(doc(db, 'popups', id));
}
